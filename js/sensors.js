// 動作感應器：把 deviceorientation 的 (beta, gamma) 轉成拍照有用的兩個角度。
//
// 原理：只用 beta/gamma 就能還原重力在「裝置座標系」的方向（alpha 與重力無關）：
//   gx =  cosβ·sinγ   （螢幕 x 軸，向右為正）
//   gy = -sinβ        （螢幕 y 軸，向上為正）
//   gz = -cosβ·cosγ   （螢幕法線，朝外為正）
// 由此得到：
//   roll  = atan2(gx, -gy)：畫面左右傾斜（0 = 水平），用於水平儀
//   pitch = atan2(-gz, √(gx²+gy²))：0 = 鏡頭朝正前方，90 = 鏡頭朝正下方（俯拍）
//
// 若某些機型 roll 方向與直覺相反，把 ROLL_DIR 改成 -1 即可。
const ROLL_DIR = 1;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const state = {
  available: false,   // 是否收得到感應器資料（或示範模式）
  simulated: false,
  roll: 0,            // 度，0 = 水平
  pitch: 0,           // 度，0 = 朝前，90 = 俯拍
  gx: 0, gy: 0,       // 正規化重力（螢幕平面分量），供氣泡水平儀使用
  jitter: 0,          // 原始角度的幀間變化量（度，EMA 平滑），衡量手震程度
  stable: true,       // 手持是否穩定（自動快門的門檻之一）
};

let listening = false;
let demoRaf = 0;
let gotEvent = false;
let prevRoll = null, prevPitch = 0;

export function getSensors() {
  return state;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpAngle(a, b, t) {
  let d = ((b - a + 540) % 360) - 180; // 取最短弧向
  return a + d * t;
}

function screenAngle() {
  return (screen.orientation && typeof screen.orientation.angle === 'number')
    ? screen.orientation.angle
    : (typeof window.orientation === 'number' ? window.orientation : 0);
}

function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  gotEvent = true;
  state.available = true;

  const b = e.beta * D2R;
  const g = e.gamma * D2R;
  let gx = Math.cos(b) * Math.sin(g);
  let gy = -Math.sin(b);
  const gz = -Math.cos(b) * Math.cos(g);

  // 螢幕若被旋轉（橫向），把重力分量轉回目前螢幕座標
  const sa = screenAngle() * D2R;
  const sgx = gx * Math.cos(sa) + gy * Math.sin(sa);
  const sgy = -gx * Math.sin(sa) + gy * Math.cos(sa);

  const roll = ROLL_DIR * Math.atan2(sgx, -sgy) * R2D;
  const pitch = Math.atan2(-gz, Math.hypot(sgx, sgy)) * R2D;

  // 穩定度：用「平滑前」的原始角度差衡量手震
  if (prevRoll != null) {
    const j = Math.abs(roll - prevRoll) + Math.abs(pitch - prevPitch);
    state.jitter = lerp(state.jitter, j, 0.12);
    state.stable = state.jitter < 0.45;
  }
  prevRoll = roll; prevPitch = pitch;

  state.roll = lerpAngle(state.roll, roll, 0.25);
  state.pitch = lerp(state.pitch, pitch, 0.25);
  state.gx = lerp(state.gx, sgx, 0.3);
  state.gy = lerp(state.gy, sgy, 0.3);
}

function runDemo() {
  const t0 = performance.now();
  const tick = () => {
    const t = (performance.now() - t0) / 1000;
    // 模擬手持晃動：roll 緩慢收斂、pitch 在 45°/90° 兩個目標間巡弋
    state.roll = 9 * Math.sin(t * 0.42) * Math.exp(-t / 40);
    state.pitch = 52 + 46 * Math.sin(t * 0.16);
    state.gx = 0.10 * Math.sin(t * 0.45);
    state.gy = 0.10 * Math.cos(t * 0.33);
    state.jitter = 0.15;
    state.stable = true;
    demoRaf = requestAnimationFrame(tick);
  };
  tick();
}

// 必須在使用者手勢的呼叫堆疊內執行（iOS 的權限限制）。
export async function startSensors({ demo = false } = {}) {
  if (demoRaf) { cancelAnimationFrame(demoRaf); demoRaf = 0; }

  if (demo) {
    state.simulated = true;
    state.available = true;
    runDemo();
    return true;
  }

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return false;
    } catch {
      return false;
    }
  }

  if (!listening) {
    window.addEventListener('deviceorientation', onOrient);
    listening = true;
    // 2.5 秒內沒有任何事件（多為桌機）→ 視為無感應器
    setTimeout(() => { if (!gotEvent) state.available = false; }, 2500);
  }
  return true;
}
