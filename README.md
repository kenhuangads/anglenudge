# AngleNudge 📐📷 拍照輔助神器

> 喬好角度、抓對光線，一鍵拍出好照片。

AngleNudge 是一款「拍照教練」——依照拍攝情境（食物、人像、自拍、風景、寵物、商品、街拍建築）即時偵測手機角度、水平與光線，用最直覺的提示帶你完成好構圖。所有分析都在裝置端即時完成，**不上傳任何影像**。

以純 Web（PWA）打造、零依賴、零建置，未來可直接用 Capacitor 打包上架 App Store / Google Play。

## ✨ 功能特色

| 模式 | 建議角度 | 預設構圖線 | 特別功能 |
|------|----------|-----------|----------|
| 🍜 食物 | 45° 斜角 / 90° 俯拍 | 三分法 | 俯拍自動切換「氣泡水平儀」 |
| 🧍 人像 | 與眼同高 | 三分法 | 眼睛擺上 1/3 線提示 |
| 🤳 自拍 | 略高於眼睛 | 三分法 | 自動前鏡頭＋鏡像預覽 |
| 🌄 風景 | 地平線水平 | 三分法 | 高精度水平儀（±1.5°） |
| 🐱 寵物 | 與寵物同高 | 三分法 | 低角度拍攝秘訣 |
| 📦 商品 | 45° / 90° 俯拍 | 中心對稱 | 俯拍氣泡水平儀 |
| 🏙️ 街拍建築 | 手機打直 | 對角線 | 前後傾偵測，避免建築變形 |

- **即時角度提示**：由陀螺儀換算 roll / pitch，水平儀變綠再按快門；俯拍時自動出現氣泡水平儀
- **構圖輔助線**：三分法、黃金比例、黃金螺旋（可切換方向）、中心對稱、對角線
- **光線偵測**：即時亮度分析，偏暗 / 過曝立即提醒
- **拍攝檢查清單**：水平、角度、光線一目瞭然，全部打勾就是快門時機
- **每個模式的專屬拍攝秘訣**：點 💡 隨時查看
- **倒數計時**（3s / 10s）、前後鏡頭切換、拍照預覽與下載
- **PWA**：可加入主畫面、離線開啟；**示範模式**沒有相機也能體驗完整流程

## 🚀 快速開始

### 直接用（手機建議走這條）

**<https://kenhuangads.github.io/anglenudge/>**

GitHub Pages 部署，已強制 HTTPS，相機與動作感應器可正常授權。手機開啟後可「加入主畫面」當獨立 App 使用；想先看示範模式：<https://kenhuangads.github.io/anglenudge/?demo=1>

> 📱 iOS 請用 Safari（動作感應器授權最穩定），Android 用 Chrome。
> 首次進入會**依序**詢問動作感應器與相機權限，兩者都要允許。

### 本機開發

```bash
git clone https://github.com/kenhuangads/anglenudge.git
cd anglenudge
python3 -m http.server 8123
```

打開 <http://localhost:8123> 即可使用；示範模式：<http://localhost:8123/?demo=1>

> ⚠️ 相機與動作感應器需要 **secure context**（HTTPS 或 localhost）。
> 手機連區網 IP（`http://192.168.x.x:8123`）畫面會出來，但相機黑屏、角度提示消失。
> 要在手機測「尚未推送」的本機修改，用 `cloudflared tunnel --url http://localhost:8123` 或 `ngrok http 8123` 開臨時 HTTPS 網址。

推送到 `main` 後 Pages 會自動重建（約 30 秒～1 分鐘）；Service Worker 採網路優先策略，手機重新整理即取得新版。

## 🧭 使用方式

1. 點「開啟相機開始」（iOS 會依序詢問動作感應器與相機權限）
2. 底部選擇拍攝情境模式
3. 跟著畫面提示喬角度——水平儀變綠、檢查清單打勾
4. 按快門，點右下縮圖預覽與下載

## 🧱 技術架構

純 Vanilla JS（ES Modules）＋零依賴、零建置：

| 檔案 | 職責 |
|------|------|
| `js/app.js` | 狀態管理、UI 綁定、提示引擎 |
| `js/modes.js` | 7 種情境模式資料（角度目標、構圖線、秘訣） |
| `js/sensors.js` | DeviceOrientation → roll / pitch 換算與平滑 |
| `js/camera.js` | getUserMedia、示範場景（canvas captureStream）、拍照擷取 |
| `js/exposure.js` | 影格亮度取樣（過暗 / 過曝偵測） |
| `js/guides.js` | SVG 構圖輔助線（含黃金螺旋弧線） |
| `sw.js` | Service Worker（網路優先、離線備援） |

角度計算原理：只用 `deviceorientation` 的 β/γ 還原重力向量在裝置座標的方向，
`roll = atan2(gx, -gy)` 得到水平偏差、`pitch = atan2(-gz, √(gx²+gy²))` 得到俯仰角
（0° = 鏡頭朝前、90° = 正俯拍），與 alpha（指南針）無關，因此不受磁場干擾。

## 📦 上架 App Store 路線圖

程式碼已是可打包狀態，建議路線：

1. `npm install @capacitor/core @capacitor/cli && npx cap init AngleNudge com.kenhuang.anglenudge --web-dir .`
2. `npx cap add ios`（Android 則 `npx cap add android`）
3. 在 Xcode 專案的 `Info.plist` 加入 `NSCameraUsageDescription` 與 `NSMotionUsageDescription` 說明文字
4. 走 TestFlight 內測 → App Store 審核；付費模式可選「付費下載」或免費＋IAP 解鎖進階模式

後續 Roadmap：

- [ ] AI 構圖評分與主體偵測（TensorFlow.js / Core ML）
- [ ] 人臉偵測輔助（眼睛位置自動對線）
- [ ] 濾鏡與基本編修
- [ ] 相簿管理與拍攝紀錄
- [ ] 多語系（英/日）

## 🔒 隱私

全程在裝置端處理：無伺服器、無追蹤、不上傳任何影像與感應器資料。

## ⚠️ 已知限制

- 桌機瀏覽器多半沒有陀螺儀，會自動隱藏角度提示（構圖線與測光照常運作）
- 少數機型感應器方向相反，可調整 `js/sensors.js` 的 `ROLL_DIR`
- iOS Safari 下載照片會存到「檔案」App；正式上架版將改用原生相簿儲存

## 版權

© 2026 Ken Huang. All rights reserved.

本專案為商業產品開發用途，**不採用開源授權**。原始碼公開僅供展示、測試與評估；
未經書面同意，不得重製、修改、散布，或用於任何產品或服務。完整條款見 [LICENSE](LICENSE)。
