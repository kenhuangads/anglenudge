// 拍攝模式與構圖線設定：純資料，新增情境模式只要在 MODES 加一筆。

export const GRIDS = [
  { id: 'none',   name: '無' },
  { id: 'thirds', name: '三分法' },
  { id: 'phi',    name: '黃金比例' },
  { id: 'spiral', name: '黃金螺旋' },
  { id: 'center', name: '中心對稱' },
  { id: 'diag',   name: '對角線' },
];

// angle.kind 說明：
//   level   → 只要求水平（roll ≈ 0）
//   dual    → 有兩個建議俯仰角（例如食物 45° 斜角 / 90° 俯拍），俯拍時自動切換氣泡水平儀
//   upright → 要求手機打直（roll ≈ 0 且 pitch ≈ 0），避免建築透視變形
export const MODES = [
  {
    id: 'food', name: '食物', emoji: '🍜', grid: 'thirds', facing: 'environment',
    vision: { clutter: true, subject: true },
    angle: { kind: 'dual', rollTol: 2.5, targets: [
      { pitch: 45, tol: 10, label: '45° 斜角' },
      { pitch: 90, tol: 6,  label: '90° 俯拍' },
    ] },
    tips: [
      '45° 斜角是萬用角度：湯麵、飲品、有高度的料理都適用',
      '平面擺盤（早午餐、火鍋料）改用 90° 正俯拍，跟著氣泡水平儀對準',
      '關閉閃光燈，靠窗用自然側光，質感立刻提升',
      '讓主角佔畫面六到七成，餐具或配菜露一角當前景',
      '熱氣、淋醬、筷子夾起的瞬間最誘人，趁熱拍',
      '桌面雜物先清空，適度留白也是構圖',
    ],
  },
  {
    id: 'portrait', name: '人像', emoji: '🧍', grid: 'thirds', facing: 'environment',
    vision: { eyeline: true, clutter: true, subject: true },
    angle: { kind: 'level', rollTol: 2 },
    tips: [
      '鏡頭與對方眼睛同高最自然；拍全身時鏡頭放低到腰部以下顯腿長',
      '把眼睛放在畫面上 1/3 線附近，頭頂留一點空間',
      '拍全身讓腳貼近畫面下緣，比例立刻變好',
      '請對方側身 45°、下巴微收，比正面直拍更上相',
      '逆光時對人臉點測光，或利用黃昏側光打出輪廓',
      '多連拍幾張抓自然表情，不要只拍一張',
    ],
  },
  {
    id: 'selfie', name: '自拍', emoji: '🤳', grid: 'thirds', facing: 'user',
    vision: { eyeline: true, subject: true },
    angle: { kind: 'level', rollTol: 2.5 },
    tips: [
      '鏡頭稍微高於眼睛 10～15°，臉型最好看',
      '面向窗戶讓光源在臉的前方，避免頂光和底光',
      '手臂伸遠一點或用廣角端，臉比較不變形',
      '眼睛看「鏡頭」而不是看螢幕，眼神更有神',
      '善用 3 秒倒數，按完快門有時間擺好表情',
    ],
  },
  {
    id: 'landscape', name: '風景', emoji: '🌄', grid: 'thirds', facing: 'environment',
    vision: { horizon: true },
    angle: { kind: 'level', rollTol: 1.5 },
    tips: [
      '地平線一定要水平——盯著水平儀變綠再按快門',
      '天空精彩就讓天空佔 2/3；前景精彩就讓地面佔 2/3，避免對半切',
      '找個前景（岩石、花、人影）增加層次感',
      '日出後與日落前一小時是魔幻時刻，光線最柔',
      '畫面太空就走近一點，或找道路、河流當引導線',
    ],
  },
  {
    id: 'pet', name: '寵物', emoji: '🐱', grid: 'thirds', facing: 'environment',
    vision: { subject: true },
    angle: { kind: 'level', rollTol: 3 },
    tips: [
      '蹲下來！鏡頭與寵物眼睛同高，世界感立刻不同',
      '用零食或玩具把視線吸引到鏡頭上方',
      '用連拍抓奔跑、歪頭的瞬間',
      '自然光下毛色最真實，閃光燈容易嚇到毛孩',
      '對焦在眼睛，糊了就再拍一張',
    ],
  },
  {
    id: 'product', name: '商品', emoji: '📦', grid: 'center', facing: 'environment',
    vision: { clutter: true, subject: true },
    angle: { kind: 'dual', rollTol: 2, targets: [
      { pitch: 45, tol: 10, label: '45° 斜角' },
      { pitch: 90, tol: 5,  label: '90° 俯拍' },
    ] },
    tips: [
      '置中對稱或 90° 正俯拍最有質感，搭配中心輔助線',
      '用白紙或素色布捲成 L 型無縫背景',
      '兩側放白紙反光補光，減少生硬陰影',
      '多拍幾個角度：正面、45°、細節特寫',
      '對焦點放在 LOGO 或材質細節上',
    ],
  },
  {
    id: 'street', name: '街拍建築', emoji: '🏙️', grid: 'diag', facing: 'environment',
    vision: { horizon: true },
    angle: { kind: 'upright', rollTol: 2, pitchTol: 6 },
    tips: [
      '手機打直（垂直地面），大樓才不會往後倒',
      '拍對稱：正對建築中線，開啟中心對稱輔助線',
      '對角線構圖讓街道更有動感',
      '等一個路人走進畫面的黃金點再按快門',
      '陰天沒有硬陰影，反而是拍建築細節的好日子',
    ],
  },
];

export function getMode(id) {
  return MODES.find(m => m.id === id) || MODES[0];
}
