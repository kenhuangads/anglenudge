// 構圖輔助線：依目前舞台尺寸產生 SVG 內容。

// 黃金螺旋：以 1000×618 黃金矩形內的六段四分之一圓弧定義，
// 再以非等比縮放鋪滿畫面（與主流相機 App 的顯示方式一致）。
const SPIRAL_D = [
  'M 0 618',
  'A 618 618 0 0 1 618 0',
  'A 382 382 0 0 1 1000 382',
  'A 236 236 0 0 1 764 618',
  'A 146 146 0 0 1 618 472',
  'A 90 90 0 0 1 708 382',
  'A 56 56 0 0 1 764 438',
].join(' ');

export function renderGuides(svg, gridId, spiralFlip = 0) {
  const W = svg.clientWidth, H = svg.clientHeight;
  if (W < 10 || H < 10) return false;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const L = (x1, y1, x2, y2, cls = 'gl') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;

  let out = '';
  switch (gridId) {
    case 'thirds':
      out += L(W / 3, 0, W / 3, H) + L(W * 2 / 3, 0, W * 2 / 3, H);
      out += L(0, H / 3, W, H / 3) + L(0, H * 2 / 3, W, H * 2 / 3);
      break;

    case 'phi': {
      const a = 0.382, b = 0.618;
      out += L(W * a, 0, W * a, H) + L(W * b, 0, W * b, H);
      out += L(0, H * a, W, H * a) + L(0, H * b, W, H * b);
      break;
    }

    case 'center': {
      const r = Math.min(W, H) / 5;
      out += L(W / 2, 0, W / 2, H) + L(0, H / 2, W, H / 2);
      out += `<circle cx="${W / 2}" cy="${H / 2}" r="${r}" class="gl"/>`;
      out += `<circle cx="${W / 2}" cy="${H / 2}" r="3.5" class="gl-dot"/>`;
      break;
    }

    case 'diag':
      out += L(0, 0, W, H) + L(W, 0, 0, H);
      out += L(0, H / 2, W / 2, 0, 'gl gl-faint') + L(W / 2, 0, W, H / 2, 'gl gl-faint');
      out += L(0, H / 2, W / 2, H, 'gl gl-faint') + L(W / 2, H, W, H / 2, 'gl gl-faint');
      break;

    case 'spiral': {
      const fx = (spiralFlip & 1) ? -1 : 1;
      const fy = (spiralFlip & 2) ? -1 : 1;
      const flip = `translate(${fx < 0 ? W : 0} ${fy < 0 ? H : 0}) scale(${fx} ${fy})`;
      out += `<g transform="${flip}"><g transform="scale(${W / 1000} ${H / 618})">` +
        `<path d="${SPIRAL_D}" class="gl-spiral" vector-effect="non-scaling-stroke"/>` +
        `</g></g>`;
      break;
    }

    case 'none':
    default:
      break;
  }
  svg.innerHTML = out;
  return true;
}
