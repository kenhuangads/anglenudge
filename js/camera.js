// 相機串流、示範場景與拍照擷取。

let stream = null;
let demoRaf = 0;

export async function startCamera(video, facing = 'environment') {
  stopCamera(video);
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: facing,
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
  video.srcObject = stream;
  try { await video.play(); } catch { /* 自動播放被擋時使用者再點一下即可 */ }
  return true;
}

export function stopCamera(video) {
  if (demoRaf) { cancelAnimationFrame(demoRaf); demoRaf = 0; }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (video) video.srcObject = null;
}

// 示範模式：畫一個動態場景丟進 <video>，讓整條管線（預覽/測光/拍照）不需相機也能運作。
export function startDemoScene(video) {
  stopCamera(video);
  const cv = document.createElement('canvas');
  cv.width = 720; cv.height = 1280;
  const ctx = cv.getContext('2d');
  const t0 = performance.now();
  const draw = () => {
    paintScene(ctx, cv.width, cv.height, (performance.now() - t0) / 1000);
    demoRaf = requestAnimationFrame(draw);
  };
  draw();
  stream = cv.captureStream(30);
  video.srcObject = stream;
  video.play?.().catch(() => {});
}

function paintScene(ctx, W, H, t) {
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#7cc3f2');
  sky.addColorStop(1, '#fbe8c8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.62);

  // 太陽
  ctx.fillStyle = 'rgba(255, 220, 130, 0.55)';
  ctx.beginPath(); ctx.arc(W * 0.74, H * 0.15, 84, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd977';
  ctx.beginPath(); ctx.arc(W * 0.74, H * 0.15, 56, 0, Math.PI * 2); ctx.fill();

  // 雲（會移動，證明畫面是活的）
  const cx = ((t * 26) % (W + 320)) - 160;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  blob(ctx, cx, H * 0.12, 70, 26);
  blob(ctx, cx + 70, H * 0.10, 90, 30);
  blob(ctx, cx + 160, H * 0.13, 60, 22);

  // 遠山與近丘
  ctx.fillStyle = '#6f8fae';
  poly(ctx, [[0, H * 0.62], [W * 0.22, H * 0.45], [W * 0.42, H * 0.60], [W * 0.66, H * 0.42], [W, H * 0.58], [W, H * 0.62]]);
  ctx.fillStyle = '#4e7a63';
  poly(ctx, [[0, H * 0.70], [0, H * 0.62], [W * 0.35, H * 0.55], [W * 0.7, H * 0.66], [W, H * 0.60], [W, H * 0.70]]);

  // 草地與木桌
  ctx.fillStyle = '#3c6b4f';
  ctx.fillRect(0, H * 0.62, W, H * 0.10);
  ctx.fillStyle = '#7a4f2c';
  ctx.fillRect(0, H * 0.67, W, H * 0.33);
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 3;
  for (let y = H * 0.70; y < H; y += 46) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 餐盤與料理（前景主角）
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, W * 0.42, H * 0.855, 205, 92);
  ctx.fillStyle = '#f3efe8';
  ellipse(ctx, W * 0.42, H * 0.84, 200, 90);
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, W * 0.42, H * 0.835, 168, 74);
  ctx.fillStyle = '#d96f32';
  ellipse(ctx, W * 0.42, H * 0.83, 126, 54);
  ctx.fillStyle = '#b34d1f';
  ellipse(ctx, W * 0.36, H * 0.82, 40, 18);
  ctx.fillStyle = '#e8a04c';
  ellipse(ctx, W * 0.5, H * 0.845, 44, 18);
  ctx.fillStyle = '#4c8b3f';
  for (const [dx, dy] of [[-60, -20], [10, -30], [60, 0], [-10, 22]]) {
    ellipse(ctx, W * 0.42 + dx, H * 0.83 + dy, 10, 5);
  }

  // 熱氣（隨時間搖曳）
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const bx = W * (0.36 + i * 0.12);
    const sway = Math.sin(t * 1.6 + i) * 14;
    ctx.beginPath();
    ctx.moveTo(bx, H * 0.78);
    ctx.quadraticCurveTo(bx + sway, H * 0.73, bx - sway * 0.6, H * 0.685);
    ctx.stroke();
  }

  // 暗角
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function blob(ctx, x, y, rx, ry) { ellipse(ctx, x, y, rx, ry); }
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.closePath(); ctx.fill();
}

// 拍照：把目前影格畫進 canvas，回傳 JPEG dataURL。自拍預覽是鏡像的，擷取時同步翻轉以吻合預覽。
export function capturePhoto(video, mirrored = false) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return null;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.92);
}
