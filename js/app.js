// AngleNudge 主程式：狀態、UI 綁定與即時提示引擎。

import { MODES, GRIDS, getMode } from './modes.js';
import { startCamera, stopCamera, startDemoScene, capturePhoto } from './camera.js';
import { startSensors, getSensors } from './sensors.js';
import { analyzeExposure } from './exposure.js';
import { renderGuides } from './guides.js';
import { feedback } from './feedback.js';
import { startVision, getVision } from './vision.js';

const $ = s => document.querySelector(s);
const el = {
  startScreen: $('#start-screen'),
  cameraScreen: $('#camera-screen'),
  stage: $('#stage'),
  video: $('#video'),
  guides: $('#guides'),
  horizon: $('#horizon'),
  horizonLine: $('#horizon-line'),
  horizonDeg: $('#horizon-deg'),
  bubble: $('#bubble'),
  bubbleDot: $('.bubble-dot'),
  modeTitle: $('#mode-title'),
  checklist: $('#checklist'),
  hintText: $('#hint-text'),
  countdown: $('#countdown'),
  flash: $('#flash'),
  demoBadge: $('#demo-badge'),
  modes: $('#modes'),
  backdrop: $('#backdrop'),
  gridMenu: $('#grid-menu'),
  gridOptions: $('#grid-options'),
  tipsSheet: $('#tips-sheet'),
  tipsTitle: $('#tips-title'),
  tipsList: $('#tips-list'),
  photoView: $('#photo-view'),
  photoImg: $('#photo-img'),
  btnSave: $('#btn-save'),
  btnShare: $('#btn-share'),
  toast: $('#toast'),
  btnThumb: $('#btn-thumb'),
  btnTimer: $('#btn-timer'),
  btnSound: $('#btn-sound'),
  btnAuto: $('#btn-auto'),
  btnShutter: $('#btn-shutter'),
  score: $('#score'),
};

const TOPDOWN_ENTER = 68;  // pitch 超過此值進入俯拍氣泡模式
const TOPDOWN_EXIT = 62;   // 低於此值離開（遲滯避免跳動）
const BUBBLE_OK = 0.045;   // 重力平面分量 < 此值視為已放平（約 2.6°）

const state = {
  mode: MODES[0],
  gridOverrides: {},      // { modeId: gridId }
  spiralFlip: 0,
  facing: 'environment',
  timer: 0,               // 0 / 3 / 10 秒
  demo: false,
  bubbleOn: false,
  expo: { status: 'na' },
  lastPhoto: null,
  lastBlob: null,
  busy: false,
  running: false,
  sound: true,            // 對齊提示音（Guided Frame 式）
  auto: false,            // 自動快門
};

/* ---------- 儲存偏好 ---------- */
function loadPrefs() {
  try {
    const g = JSON.parse(localStorage.getItem('an_grids') || '{}');
    if (g && typeof g === 'object') state.gridOverrides = g;
    const m = localStorage.getItem('an_mode');
    if (m) state.mode = getMode(m);
    const t = Number(localStorage.getItem('an_timer') || 0);
    if ([0, 3, 10].includes(t)) state.timer = t;
    const snd = localStorage.getItem('an_sound');
    if (snd != null) state.sound = snd === '1';
    state.auto = localStorage.getItem('an_auto') === '1';
  } catch { /* 私密模式等情況直接用預設值 */ }
}
function savePrefs() {
  try {
    localStorage.setItem('an_grids', JSON.stringify(state.gridOverrides));
    localStorage.setItem('an_mode', state.mode.id);
    localStorage.setItem('an_timer', String(state.timer));
    localStorage.setItem('an_sound', state.sound ? '1' : '0');
    localStorage.setItem('an_auto', state.auto ? '1' : '0');
  } catch { }
}

function currentGrid() {
  return state.gridOverrides[state.mode.id] ?? state.mode.grid;
}

/* ---------- 進入拍攝 ---------- */
async function enterCamera() {
  // 先要感應器權限（iOS 必須在手勢堆疊內），再開相機
  await startSensors({ demo: false });
  try {
    await startCamera(el.video, state.mode.facing);
    state.demo = false;
    state.facing = state.mode.facing;
    showCameraScreen();
  } catch (err) {
    const denied = err && err.name === 'NotAllowedError';
    enterDemo(denied
      ? '相機權限被拒絕，先以示範模式體驗；可到瀏覽器設定重新允許'
      : '無法開啟相機（需要 HTTPS 或 localhost），先以示範模式體驗');
  }
}

function enterDemo(message) {
  state.demo = true;
  startDemoScene(el.video);
  startSensors({ demo: true });
  el.demoBadge.classList.remove('hidden');
  showCameraScreen();
  if (message) toast(message, 3200);
}

function showCameraScreen() {
  el.startScreen.hidden = true;
  el.cameraScreen.hidden = false;
  applyMode(state.mode, { restartCamera: false });
  if (!state.running) {
    state.running = true;
    startVision(el.video, () => state.mode.vision || {});
    requestAnimationFrame(tick);
    setInterval(() => { state.expo = analyzeExposure(el.video); }, 700);
    setInterval(updateHint, 1200);
    updateHint();
  }
  // 螢幕保持喚醒（支援的裝置才有）
  navigator.wakeLock?.request?.('screen').catch(() => { });
}

/* ---------- 模式 ---------- */
function applyMode(mode, { restartCamera = true } = {}) {
  state.mode = mode;
  el.modeTitle.textContent = `${mode.emoji} ${mode.name}`;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.id === mode.id));

  const facing = mode.facing || 'environment';
  if (!state.demo && restartCamera && facing !== state.facing) {
    state.facing = facing;
    startCamera(el.video, facing).catch(() => toast('切換鏡頭失敗'));
  }
  el.video.classList.toggle('mirror', state.facing === 'user' && !state.demo);

  drawGuides();
  renderGridMenu();
  savePrefs();
}

function drawGuides() {
  const ok = renderGuides(el.guides, currentGrid(), state.spiralFlip);
  if (!ok) requestAnimationFrame(drawGuides); // 佈局尚未完成時下一幀再畫
}

function buildModeBar() {
  el.modes.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button');
    b.className = 'mode-btn' + (m.id === state.mode.id ? ' active' : '');
    b.dataset.id = m.id;
    b.innerHTML = `<span>${m.emoji}</span>${m.name}`;
    b.addEventListener('click', () => applyMode(m));
    el.modes.appendChild(b);
  }
}

/* ---------- 構圖線選單 ---------- */
function renderGridMenu() {
  el.gridOptions.innerHTML = '';
  const cur = currentGrid();
  for (const g of GRIDS) {
    const b = document.createElement('button');
    b.className = 'grid-opt' + (g.id === cur ? ' active' : '');
    b.textContent = g.name;
    b.addEventListener('click', () => {
      if (g.id === 'spiral' && cur === 'spiral') {
        state.spiralFlip = (state.spiralFlip + 1) % 4; // 再點一次換螺旋方向
      }
      state.gridOverrides[state.mode.id] = g.id;
      drawGuides();
      renderGridMenu();
      savePrefs();
    });
    el.gridOptions.appendChild(b);
  }
}

/* ---------- 即時儀表（每一幀） ---------- */
function tick() {
  const s = getSensors();
  const a = state.mode.angle;

  // 俯拍氣泡模式（含遲滯）
  if (a.kind === 'dual' && s.available) {
    if (!state.bubbleOn && s.pitch > TOPDOWN_ENTER) state.bubbleOn = true;
    else if (state.bubbleOn && s.pitch < TOPDOWN_EXIT) state.bubbleOn = false;
  } else {
    state.bubbleOn = false;
  }

  // 水平儀
  const showHorizon = s.available && !state.bubbleOn;
  el.horizon.classList.toggle('hidden', !showHorizon);
  if (showHorizon) {
    const roll = s.roll;
    el.horizonLine.style.transform = `rotate(${-roll}deg)`;
    el.horizonDeg.textContent = `${Math.abs(roll).toFixed(1)}°`;
    const tol = a.rollTol || 2;
    el.horizon.className = Math.abs(roll) <= tol ? 'lv-ok'
      : Math.abs(roll) <= tol + 3 ? 'lv-warn' : 'lv-bad';
  }

  // 氣泡
  el.bubble.classList.toggle('hidden', !state.bubbleOn);
  if (state.bubbleOn) {
    const k = 480;
    const bx = Math.max(-54, Math.min(54, s.gx * k));
    const by = Math.max(-54, Math.min(54, s.gy * k));
    el.bubbleDot.style.transform = `translate(${bx}px, ${by}px)`;
    el.bubble.classList.toggle('ok', Math.hypot(s.gx, s.gy) < BUBBLE_OK);
  }

  const chips = chipDefs();
  updateChecklist(chips);

  // 新子系統（回饋/自動快門/評分）故障時不得拖垮核心儀表迴圈
  try {
    const quiet = el.photoView.classList.contains('hidden') &&
      el.backdrop.classList.contains('hidden') && !document.hidden;
    feedback.update(alignDeviations(s), quiet && state.sound && !state.busy);
    maybeAutoShutter(chips, s);
    updateScore(s);
  } catch { }
  requestAnimationFrame(tick);
}

function nearestTarget(a, pitch) {
  return a.targets.reduce((best, t) =>
    Math.abs(pitch - t.pitch) < Math.abs(pitch - best.pitch) ? t : best);
}

// 目前模式所有角度約束中「超出容差的最大度數」；0 = 全數對齊
function alignDeviations(s) {
  if (!s.available) return { active: false, aligned: false, worst: 0 };
  const a = state.mode.angle;
  let worst = 0;
  if (state.bubbleOn) {
    worst = Math.max(0, (Math.hypot(s.gx, s.gy) - BUBBLE_OK) * 57.3);
  } else {
    worst = Math.max(0, Math.abs(s.roll) - (a.rollTol || 2));
    if (a.kind === 'dual') {
      const t = nearestTarget(a, s.pitch);
      worst = Math.max(worst, Math.abs(s.pitch - t.pitch) - t.tol);
    }
    if (a.kind === 'upright') {
      worst = Math.max(worst, Math.abs(s.pitch) - a.pitchTol);
    }
  }
  return { active: true, aligned: worst <= 0, worst };
}

function chipDefs() {
  const s = getSensors();
  const a = state.mode.angle;
  const chips = [];
  if (s.available) {
    if (state.bubbleOn) {
      chips.push({ label: '俯平', ok: Math.hypot(s.gx, s.gy) < BUBBLE_OK });
    } else {
      chips.push({ label: '水平', ok: Math.abs(s.roll) <= (a.rollTol || 2) });
    }
    if (a.kind === 'dual' && !state.bubbleOn) {
      const t = nearestTarget(a, s.pitch);
      chips.push({ label: `角度 ${t.pitch}°`, ok: Math.abs(s.pitch - t.pitch) <= t.tol });
    }
    if (a.kind === 'upright') {
      chips.push({ label: '打直', ok: Math.abs(s.pitch) <= a.pitchTol });
    }
  }
  if (state.auto && s.available) {
    chips.push({ label: '穩定', ok: !!s.stable });
  }
  chips.push({ label: '光線', ok: state.expo.status === 'ok' });
  return chips;
}

let lastChipsKey = '';
function updateChecklist(chips = chipDefs()) {
  const key = chips.map(c => c.label + (c.ok ? 1 : 0)).join('|');
  if (key === lastChipsKey) return;
  lastChipsKey = key;
  el.checklist.innerHTML = chips.map(c =>
    `<span class="chip${c.ok ? ' ok' : ''}">${c.ok ? '✓' : '○'} ${c.label}</span>`).join('');
}

/* ---------- 構圖評分（IAA 輕量版）與自動快門 ---------- */
let scoreAt = 0, scoreShown = -1;
function updateScore(s) {
  const now = performance.now();
  if (now - scoreAt < 300) return;
  scoreAt = now;

  const a = state.mode.angle;
  const vm = state.mode.vision || {};
  const v = getVision();
  let sc = 100;
  if (s.available) {
    if (state.bubbleOn) {
      sc -= Math.min(30, Math.max(0, (Math.hypot(s.gx, s.gy) - BUBBLE_OK) * 57.3) * 6);
    } else {
      sc -= Math.min(30, Math.max(0, Math.abs(s.roll) - (a.rollTol || 2)) * 6);
      if (a.kind === 'dual') {
        const t = nearestTarget(a, s.pitch);
        sc -= Math.min(25, Math.max(0, Math.abs(s.pitch - t.pitch) - t.tol) * 2.5);
      }
      if (a.kind === 'upright') {
        sc -= Math.min(25, Math.max(0, Math.abs(s.pitch) - a.pitchTol) * 2.5);
      }
    }
    if (!s.stable) sc -= 8;
  }
  if (state.expo.status === 'dark' || state.expo.status === 'bright') sc -= 18;
  if (vm.clutter && v.clutter != null) sc -= Math.min(14, Math.max(0, v.clutter - 0.30) * 90);
  if (vm.subject && v.subject != null) sc -= Math.round((1 - v.subject) * 25);
  if (vm.eyeline && v.face && v.face.present === false) sc = Math.min(sc, 70);
  if (vm.horizon && v.horizon && !state.bubbleOn) sc -= (100 - v.horizon.score) * 0.12;

  sc = Math.max(0, Math.round(sc));
  if (sc === scoreShown) return;
  scoreShown = sc;
  el.score.textContent = `構圖 ${sc}`;
  el.score.className = sc >= 85 ? 's-ok' : sc >= 65 ? 's-warn' : 's-bad';
}

const AUTO_HOLD = 900;        // 全數就緒需維持的毫秒數
let armStart = 0, autoCooldownUntil = 0, autoNeedsReset = false;
function maybeAutoShutter(chips, s) {
  if (!state.auto || state.busy) { armStart = 0; return; }
  const ready = s.available && chips.length > 1 && chips.every(c => c.ok);
  if (!ready) { armStart = 0; autoNeedsReset = false; return; }
  if (autoNeedsReset) return;               // 拍完需先離開就緒狀態才會再拍
  const now = performance.now();
  if (now < autoCooldownUntil) { armStart = 0; return; }
  if (!armStart) armStart = now;
  if (now - armStart >= AUTO_HOLD) {
    armStart = 0;
    autoCooldownUntil = now + 3000;
    autoNeedsReset = true;
    snap();
  }
}

/* ---------- 提示引擎（每 1.2 秒） ---------- */
function computeHint() {
  const s = getSensors();
  const m = state.mode;
  const a = m.angle;
  const exp = state.expo.status;

  if (!s.available) {
    return { ok: false, text: '以構圖線輔助取景（此裝置未提供動作感應器）' };
  }
  if (a.kind === 'dual') {
    if (state.bubbleOn) {
      if (Math.hypot(s.gx, s.gy) >= BUBBLE_OK) {
        return { ok: false, text: '⚪ 俯拍中：讓金色圓點對準中心，手機放平' };
      }
    } else {
      const t = nearestTarget(a, s.pitch);
      if (Math.abs(s.pitch - t.pitch) > t.tol) {
        const dir = s.pitch < t.pitch ? '再往下壓低一點' : '稍微立起來一點';
        return { ok: false, text: `📱 ${dir}（目標 ${t.label}，目前 ${Math.round(s.pitch)}°）` };
      }
    }
  }
  if (a.kind === 'upright' && Math.abs(s.pitch) > a.pitchTol) {
    return { ok: false, text: `🏛 手機打直別前後傾（目前 ${Math.round(Math.abs(s.pitch))}°），避免建築變形` };
  }
  if (!state.bubbleOn && Math.abs(s.roll) > (a.rollTol || 2)) {
    const dir = s.roll > 0 ? '向左' : '向右';
    return { ok: false, text: `📐 ${dir}轉正 ${Math.abs(s.roll).toFixed(1)}°` };
  }
  if (exp === 'dark') return { ok: false, text: '💡 光線偏暗：靠近窗邊、開燈或換個亮一點的位置' };
  if (exp === 'bright') return { ok: false, text: '☀️ 小心過曝：避開直射強光，或稍微換個角度' };

  const v = getVision();
  const vm = m.vision || {};
  if (vm.subject && v.subject != null && v.subject < 0.35) {
    return { ok: false, text: '🎯 畫面沒有明顯主體：讓主角靠近一點、佔比大一點' };
  }
  if (vm.eyeline && v.face && v.face.present && v.face.eyeRel != null) {
    const dy = v.face.eyeRel - 1 / 3;
    if (dy > 0.10) return { ok: false, text: '👀 鏡頭放低（或往下傾）一點，讓眼睛升到上 1/3 線' };
    if (dy < -0.10) return { ok: false, text: '👀 鏡頭抬高一點，讓眼睛落在上 1/3 線附近' };
  }
  if (vm.horizon && v.horizon && !state.bubbleOn && Math.abs(v.horizon.tilt) > 4 &&
      Math.abs(s.roll) <= (a.rollTol || 2)) {
    return { ok: false, text: `🌅 畫面裡的地平線仍斜約 ${Math.abs(v.horizon.tilt).toFixed(0)}°，試著對齊實際景物` };
  }
  if (vm.clutter && v.clutter != null && v.clutter > 0.34) {
    return { ok: false, text: '🧹 背景有點雜亂：湊近主角或清掉雜物，畫面更聚焦（減法原則）' };
  }

  const pool = ['✅ 構圖就緒——按下快門！', ...m.tips.slice(0, 2).map(t => '💡 ' + t)];
  return { ok: true, text: pool[Math.floor(Date.now() / 5000) % pool.length] };
}

function updateHint() {
  const h = computeHint();
  if (el.hintText.textContent !== h.text) el.hintText.textContent = h.text;
  el.hintText.parentElement.classList.toggle('good', h.ok);
  updateChecklist(); // rAF 被節流（背景分頁、低電量模式）時的保險更新
}

/* ---------- 快門 ---------- */
async function onShutter() {
  if (state.busy) return;
  if (state.timer > 0) {
    state.busy = true;
    el.countdown.classList.remove('hidden');
    for (let n = state.timer; n > 0; n--) {
      el.countdown.textContent = n;
      await sleep(1000);
    }
    el.countdown.classList.add('hidden');
    state.busy = false;
  }
  snap();
}

function snap() {
  const mirrored = el.video.classList.contains('mirror');
  const url = capturePhoto(el.video, mirrored);
  if (!url) { toast('畫面尚未就緒，再試一次'); return; }
  state.lastPhoto = url;
  state.lastBlob = null;
  fetch(url).then(r => r.blob()).then(b => { state.lastBlob = b; }).catch(() => { });
  el.flash.classList.remove('go');
  void el.flash.offsetWidth; // 重新觸發動畫
  el.flash.classList.add('go');
  navigator.vibrate?.(20);
  if (state.sound) feedback.shutterCue();
  el.btnThumb.classList.remove('empty');
  el.btnThumb.style.backgroundImage = `url(${url})`;
  toast('已拍下 📸 點右下縮圖可預覽與下載');
}

function openPhoto() {
  if (!state.lastPhoto) { toast('還沒有照片，先拍一張吧！'); return; }
  el.photoImg.src = state.lastPhoto;
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  el.btnSave.href = state.lastPhoto;
  el.btnSave.download = `AngleNudge_${ts}.jpg`;
  // 支援檔案分享的裝置（iOS/Android）：主按鈕改為「存到相簿」，下載退居備用
  const canShare = typeof navigator.share === 'function';
  el.btnShare.classList.toggle('hidden', !canShare);
  el.btnSave.className = canShare ? 'btn-ghost' : 'btn-primary';
  el.photoView.classList.remove('hidden');
}

// 透過系統分享面板存入相簿（iOS 選「儲存影像」、Android 選「相片」）。
// Blob 已在拍照時預先轉好，這裡同步取用，確保 share() 落在手勢有效期內。
function sharePhoto() {
  const b = state.lastBlob;
  if (!b || !(navigator.canShare)) { el.btnSave.click(); return; }
  const file = new File([b], el.btnSave.download || 'AngleNudge.jpg', { type: 'image/jpeg' });
  if (!navigator.canShare({ files: [file] })) { el.btnSave.click(); return; }
  navigator.share({ files: [file] })
    .then(() => toast('✅ 完成！選了「儲存影像」就已存入相簿'))
    .catch(err => { if (err && err.name !== 'AbortError') toast('分享失敗，可改用下載'); });
}

/* ---------- 底部面板 / 雜項 ---------- */
function openSheet(sheet) {
  el.backdrop.classList.remove('hidden');
  sheet.classList.add('open');
}
function closeSheets() {
  el.backdrop.classList.add('hidden');
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'));
}

function openTips() {
  el.tipsTitle.textContent = `${state.mode.emoji} ${state.mode.name}｜拍攝秘訣`;
  el.tipsList.innerHTML = state.mode.tips.map(t => `<li>${t}</li>`).join('');
  openSheet(el.tipsSheet);
}

let toastTimer = 0;
function toast(msg, ms = 2000) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms);
}

function cycleTimer() {
  state.timer = state.timer === 0 ? 3 : state.timer === 3 ? 10 : 0;
  el.btnTimer.textContent = state.timer === 0 ? '⏱ 關' : `⏱ ${state.timer}s`;
  savePrefs();
}

function toggleSound() {
  state.sound = !state.sound;
  el.btnSound.textContent = state.sound ? '🔊' : '🔇';
  if (state.sound) feedback.unlock();
  toast(state.sound ? '🔊 對齊提示音開啟：越接近目標，節奏越快、音高越高' : '對齊提示音關閉', 2400);
  savePrefs();
}

function toggleAuto() {
  state.auto = !state.auto;
  el.btnAuto.classList.toggle('on', state.auto);
  el.btnShutter.classList.toggle('armed', state.auto);
  toast(state.auto ? '🤖 自動快門：水平、角度、光線、穩定全數就緒後自動拍攝' : '自動快門關閉', 2600);
  savePrefs();
}

async function flipCamera() {
  if (state.demo) { toast('示範模式無法切換鏡頭'); return; }
  state.facing = state.facing === 'user' ? 'environment' : 'user';
  try {
    await startCamera(el.video, state.facing);
    el.video.classList.toggle('mirror', state.facing === 'user');
  } catch { toast('切換鏡頭失敗'); }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 啟動 ---------- */
function init() {
  loadPrefs();
  buildModeBar();
  el.btnTimer.textContent = state.timer === 0 ? '⏱ 關' : `⏱ ${state.timer}s`;
  el.btnSound.textContent = state.sound ? '🔊' : '🔇';
  el.btnAuto.classList.toggle('on', state.auto);
  el.btnShutter.classList.toggle('armed', state.auto);

  $('#btn-start').addEventListener('click', () => { feedback.unlock(); enterCamera(); });
  $('#btn-demo').addEventListener('click', () => { feedback.unlock(); enterDemo(); });
  $('#btn-shutter').addEventListener('click', onShutter);
  $('#btn-grid').addEventListener('click', () => openSheet(el.gridMenu));
  $('#btn-tips').addEventListener('click', openTips);
  $('#btn-tips-close').addEventListener('click', closeSheets);
  $('#btn-timer').addEventListener('click', cycleTimer);
  el.btnSound.addEventListener('click', toggleSound);
  el.btnAuto.addEventListener('click', toggleAuto);
  $('#btn-flip').addEventListener('click', flipCamera);
  $('#btn-thumb').addEventListener('click', openPhoto);
  $('#btn-photo-close').addEventListener('click', () => el.photoView.classList.add('hidden'));
  el.btnShare.addEventListener('click', sharePhoto);
  el.backdrop.addEventListener('click', closeSheets);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !el.cameraScreen.hidden) { e.preventDefault(); onShutter(); }
  });

  new ResizeObserver(() => drawGuides()).observe(el.stage);

  if (new URLSearchParams(location.search).get('demo') === '1') {
    enterDemo();
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
}

init();
