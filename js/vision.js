// 裝置端畫面分析（零依賴、全程本機）：
//   1. 雜亂度（減法原則）：Sobel 邊緣密度——邊緣越多代表競爭元素越多
//   2. 地平線偵測：邊緣方向直方圖找「畫面中最強的近水平線條」與其傾斜角，
//      依 S = 100 - (θ/30)×100 給水平構圖分數（θ 為偏離水平的度數）
//   3. 臉部眼線（漸進增強）：支援 Shape Detection API 的裝置上偵測主要臉部，
//      估出眼睛在畫面中的相對高度，供「眼睛擺上 1/3 線」提示使用
//
// 成本控制：約 120px 寬的縮圖、每 350ms 一輪、臉部隔輪偵測；分頁隱藏時完全暫停。

const SAMPLE_W = 120;
const EDGE_T = 90;          // Sobel 梯度門檻（|gx|+|gy|，灰階 0–255）
const HORIZON_SPAN = 35;    // 只統計 ±35° 內的近水平線條

const cv = document.createElement('canvas');
const ctx = cv.getContext('2d', { willReadFrequently: true });

const state = {
  ready: false,
  clutter: null,            // 0–1 邊緣密度
  subject: null,            // 0–1 主體存在感（中央區域邊緣密度，越高代表有明顯主體）
  horizon: null,            // { tilt: 度, score: 0–100 } 或 null（畫面中無明顯水平線）
  face: null,               // { present, eyeRel: 眼睛相對高度 0(頂)–1(底) } 或 null
};

let video = null;
let cfgFn = null;
let timer = 0;
let gray = null;
let detector = null;
let faceBusy = false;
let faceFail = 0;
let tickN = 0;

export function getVision() { return state; }

export function startVision(v, getCfg) {
  video = v;
  cfgFn = getCfg;
  if ('FaceDetector' in window && !detector) {
    try { detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 }); }
    catch { detector = null; }
  }
  if (!timer) timer = setInterval(analyze, 350);
}

function analyze() {
  if (document.hidden || !video || !video.videoWidth) return;
  const cfg = cfgFn ? (cfgFn() || {}) : {};

  const W = SAMPLE_W;
  const H = Math.min(220, Math.max(48, Math.round(W * video.videoHeight / video.videoWidth)));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }

  let d;
  try {
    ctx.drawImage(video, 0, 0, W, H);
    d = ctx.getImageData(0, 0, W, H).data;
  } catch { return; }

  if (!gray || gray.length !== W * H) gray = new Float32Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }

  // Sobel 邊緣 + 近水平線條方向直方圖（1° 一格）
  const bins = new Float32Array(HORIZON_SPAN * 2 + 1);
  let edges = 0, energy = 0, centerEdges = 0;
  const total = (W - 2) * (H - 2);
  // 主體區：中央偏上（人像的臉、食物商品的主角通常落在這一帶）
  const cx0 = Math.round(W * 0.22), cx1 = Math.round(W * 0.78);
  const cy0 = Math.round(H * 0.12), cy1 = Math.round(H * 0.72);
  const centerPix = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
  for (let y = 1; y < H - 1; y++) {
    const r0 = (y - 1) * W, r1 = y * W, r2 = (y + 1) * W;
    const inY = y >= cy0 && y <= cy1;
    for (let x = 1; x < W - 1; x++) {
      const gx = (gray[r0 + x + 1] + 2 * gray[r1 + x + 1] + gray[r2 + x + 1])
               - (gray[r0 + x - 1] + 2 * gray[r1 + x - 1] + gray[r2 + x - 1]);
      const gy = (gray[r2 + x - 1] + 2 * gray[r2 + x] + gray[r2 + x + 1])
               - (gray[r0 + x - 1] + 2 * gray[r0 + x] + gray[r0 + x + 1]);
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag <= EDGE_T) continue;
      edges++;
      if (inY && x >= cx0 && x <= cx1) centerEdges++;
      // 線條方向 = 梯度方向 + 90°，正規化到 (-90, 90]
      let la = Math.atan2(gy, gx) * 57.29578 + 90;
      if (la > 90) la -= 180;
      if (la < -90) la += 180;
      if (Math.abs(la) <= HORIZON_SPAN) {
        bins[Math.round(la) + HORIZON_SPAN] += mag;
        energy += mag;
      }
    }
  }
  state.clutter = edges / total;
  // 主體存在感：中央區邊緣密度 0.012（空景）→ 0.05（明顯主體）線性映射
  const cd = centerEdges / centerPix;
  state.subject = Math.max(0, Math.min(1, (cd - 0.012) / 0.038));

  // 找最強方向（3 格平滑），需同時具備足夠能量與方向集中度才視為有效地平線
  if (cfg.horizon) {
    let best = -1, bv = 0;
    for (let i = 1; i < bins.length - 1; i++) {
      const v2 = bins[i - 1] + bins[i] + bins[i + 1];
      if (v2 > bv) { bv = v2; best = i; }
    }
    if (best >= 0 && bv > 1500 && bv > energy * 0.22 && edges > total * 0.015) {
      const tilt = best - HORIZON_SPAN;
      const score = Math.max(0, Math.min(100, 100 - Math.abs(tilt) / 30 * 100));
      state.horizon = { tilt, score };
    } else {
      state.horizon = null;
    }
  } else {
    state.horizon = null;
  }

  state.ready = true;

  tickN++;
  if (cfg.eyeline && detector && !faceBusy && faceFail < 5 && (tickN & 1) === 0) {
    detectFace();
  }
  if (!cfg.eyeline) state.face = null;
}

async function detectFace() {
  faceBusy = true;
  try {
    const faces = await detector.detect(video);
    if (faces && faces.length) {
      const f = faces.reduce((a, b) => (b.boundingBox.width > a.boundingBox.width ? b : a));
      const bb = f.boundingBox;
      let eyeY = bb.top + bb.height * 0.38;   // 沒有 landmark 時以臉框比例估計眼睛位置
      const eyes = (f.landmarks || []).filter(l => l.type === 'eye');
      if (eyes.length) {
        let sum = 0, n = 0;
        for (const l of eyes) {
          const loc = l.locations ? l.locations[0] : l.location;
          if (loc && typeof loc.y === 'number') { sum += loc.y; n++; }
        }
        if (n) eyeY = sum / n;
      }
      state.face = { present: true, eyeRel: eyeY / video.videoHeight };
    } else {
      state.face = { present: false, eyeRel: null };
    }
  } catch {
    faceFail++;
    if (faceFail >= 5) state.face = null;   // 此裝置的 FaceDetector 不可用，安靜停用
  }
  faceBusy = false;
}
