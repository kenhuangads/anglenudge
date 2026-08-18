// 光線偵測：定期把影格縮小取樣，計算平均亮度與過暗/過曝比例。

const cv = document.createElement('canvas');
cv.width = 64; cv.height = 36;
const ctx = cv.getContext('2d', { willReadFrequently: true });

// 回傳 status: 'na' | 'dark' | 'bright' | 'ok'
export function analyzeExposure(video) {
  if (!video.videoWidth) return { status: 'na', mean: 0 };
  try {
    ctx.drawImage(video, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const n = cv.width * cv.height;
    let sum = 0, dark = 0, bright = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += y;
      if (y < 28) dark++;
      else if (y > 232) bright++;
    }
    const mean = sum / n;
    let status = 'ok';
    if (mean < 62 || dark / n > 0.55) status = 'dark';
    else if (mean > 195 || bright / n > 0.30) status = 'bright';
    return { status, mean };
  } catch {
    return { status: 'na', mean: 0 };
  }
}
