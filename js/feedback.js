// 多感官對齊回饋引擎（Guided Frame 式雙通道設計）：
// 越接近目標角度，提示音節奏越快、音高越高；完全對齊的瞬間給一聲 THUD 與震動。
// 強光下看不清螢幕、或高舉/貼地盲拍時，靠聽覺與觸覺就能完成對齊。
//
// 音量設計：手機喇叭在 ~400Hz 以下衰減嚴重，THUD 採「中頻可聽層 + 低頻層」雙層；
// 全部經過 DynamicsCompressor 母線，增益可以拉高而不破音。
//
// iOS 注意：AudioContext 必須在使用者手勢內建立（unlock()）；
// 實體靜音撥桿開啟時系統會靜音 Web Audio；navigator.vibrate 僅 Android 支援。

let ac = null;
let bus = null;            // 母線（壓縮器），所有聲音經此輸出
let lastTick = 0;
let wasAligned = false;
let unalignedAt = 0;
let armed = true;          // 避免在容差邊緣抖動時連環 THUD

function ensureContext() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      bus = ac.createDynamicsCompressor();
      bus.threshold.value = -20;
      bus.knee.value = 20;
      bus.ratio.value = 8;
      bus.attack.value = 0.002;
      bus.release.value = 0.15;
      bus.connect(ac.destination);
    } catch { ac = null; bus = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => { });
}

// 短促提示音：freq 音高、dur 秒、gain 音量
function blip(freq, dur = 0.03, gain = 0.22, type = 'triangle') {
  if (!ac || !bus || ac.state !== 'running') return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 對齊確認 THUD：中頻下滑層（喇叭聽得到）＋低頻層（耳機/震膜有感）
function thud() {
  if (ac && bus && ac.state === 'running') {
    const t = ac.currentTime;
    const o1 = ac.createOscillator();
    const g1 = ac.createGain();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(520, t);
    o1.frequency.exponentialRampToValueAtTime(160, t + 0.12);
    g1.gain.setValueAtTime(0.4, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o1.connect(g1).connect(bus);
    o1.start(t); o1.stop(t + 0.18);

    const o2 = ac.createOscillator();
    const g2 = ac.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(150, t);
    o2.frequency.exponentialRampToValueAtTime(60, t + 0.14);
    g2.gain.setValueAtTime(0.55, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o2.connect(g2).connect(bus);
    o2.start(t); o2.stop(t + 0.2);
  }
  navigator.vibrate?.(60);
}

export const feedback = {
  // 必須在使用者手勢的呼叫堆疊內執行一次
  unlock() { ensureContext(); },

  // 每一幀由 app 呼叫。dev = { active, aligned, worst(超出容差的度數) }
  update(dev, enabled) {
    if (!enabled || !dev.active) { wasAligned = false; return; }
    const now = performance.now();

    if (dev.aligned) {
      if (!wasAligned && armed) { thud(); armed = false; }
      wasAligned = true;
      return;
    }
    if (wasAligned) { wasAligned = false; unalignedAt = now; }
    if (!armed && now - unalignedAt > 600) armed = true;

    if (dev.worst > 10) return;              // 離目標太遠時保持安靜，不吵人
    const r = dev.worst / 10;                // 0（貼近容差）～ 1（差 10°）
    const interval = 130 + r * 520;          // 越接近節奏越快
    if (now - lastTick < interval) return;
    lastTick = now;
    blip(940 - r * 420);                     // 越接近音高越高
    if (dev.worst < 3) navigator.vibrate?.(8);
  },

  // 快門音（拍照與自動快門觸發時）
  shutterCue() {
    blip(1500, 0.02, 0.25, 'square');
    setTimeout(() => blip(700, 0.04, 0.25, 'square'), 40);
  },
};
