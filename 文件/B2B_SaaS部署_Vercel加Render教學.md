# AI WMS 2.0 - 零成本起步 B2B SaaS 雲端部署教學 (Vercel + Render)

這套架構專為「不想被公司主機綁死、初期不想花大錢租伺服器、但又想賣給多家工廠」的開發者設計。
我們將前端託管在免費且極速的 **Vercel**，把含有資料庫 (SQLite) 的後端放上支援持久化硬碟的 **Render**。

---

## 為什麼選這兩個平台？

| 平台 | 負責項目 | 費用 | 優勢與特色 |
| :--- | :--- | :--- | :--- |
| **Vercel** | 前端 (`client` 資料夾) | **永久免費** | 專為 React/Vite 打造，全球 CDN 極速載入。自動綁定 SSL 憑證，零設定成本。 |
| **Render** | 後端 (`server` 資料夾 + SQLite) | **$0 ~ $7 美金/月** | 支援 **Disk (持久化硬碟)**，重啟機器 SQLite 檔案也不會消失。支援將你的 `Dockerfile` 一鍵跑起來。 |

🎯 **成果**：程式碼只存在你自己的 GitHub 上，客戶完全碰不到；你隨時可以離職帶走這套系統繼續賺錢。

---

## 部署流程概述

### 步驟 1：準備 GitHub 儲存庫
1. 在你自己的 GitHub 帳號建立一個 Private (私有) 儲存庫。
2. 將目前的 `AI_WMS_2.0` 完整程式碼 Push 上去。

---

### 步驟 2：部署前端 (Vercel)
Vercel 接管你打包好的網頁畫面，並負責處理你想開給不同客戶的「專屬網址」。

1. 前往 [Vercel](https://vercel.com/) 註冊並綁定 GitHub。
2. 點擊 **"Add New Project"**，選擇剛剛上傳的 Git Repo。
3. **重要設定 (Build & Development Settings)**:
   - Framework Preset: 選擇 `Vite` (Vercel 通常會自動偵測到)
   - Root Directory: 輸入 `client` （告訴 Vercel 前端程式碼在這個資料夾）
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 點擊 **Deploy**。不用幾分鐘，Vercel 就會給你一個超長的網址，你的前端就上線了！

#### 👉 如何購買與綁定主網域？

1.  **選擇註冊商 (Registrar)**：推薦 **Cloudflare** (價格透明、無隱藏費) 或 **GoDaddy** (客服好、有中文介面)。
2.  **搜尋喜歡的名稱**：在註冊商官網搜尋你想買的網址（例如 `xxx-wms.com`）。
3.  **結帳與驗證**：刷卡購買後，你會拿到一個「網域管理後台」。
4.  **在 Vercel 綁定**：
    - 去 Vercel > **Domains**：輸入 `你的網域.com`。
    - Vercel 會給你兩組資料 (A Record 或 CNAME)。
5.  **在註冊商後台設定 (DNS)**：
    - 回到你買網域的地方，找到 **DNS 管理**。
    - 新增一筆記錄，按照 Vercel 提供的值填寫。
    - **等待生效**：通常幾分鐘到幾小時內，你的主網域就正式通往 Vercel 了！
6.  **開分子網域給客戶**：主網域通了之後，你就可以隨意輸入 `clientA.你的網域.com`，Vercel 會自動處理剩下的事。

*(註：買一個 .com 主網域一年約台幣 400-500 元。子網域不限數量且免費。)*

---

### 步驟 3：部署後端 (Render)
後端是整個系統的核心命脈，因為 SQLite 資料庫在這裡。**關鍵是要掛載 Disk (硬碟)**。

1. 前往 [Render.com](https://render.com/) 註冊並綁定 GitHub。
2. 點擊 **"New +" -> "Web Service"**。
3. 選擇你的 Git Repo。
4. **重要設定 (Settings)**:
   - Root Directory: 輸入 `server`
   - Environment: 選擇 `Docker` （Render 會自動抓你的 `Dockerfile` 把環境建起來）
   - Instance Type: 初期選 **Free ($0/month)**，如果有實際客戶上線後，強烈建議升級到 **Starter ($7/month)**，效能更穩。
5. 🆘 **極度重要：設定持久化硬碟 (Disks)**
   - 往下滑找到 **"Disks"** 區塊，點擊 "Add Disk"。
   - **Name**: 輸入 `sqlite-data`
   - **Mount Path**: 填寫你在 Dockerfile 裡面存 SQLite 的絕對路徑，例如：`/app/server/database.sqlite` (視你程式碼怎麼裝而定)。
   - *（這顆硬碟確保了就算 Render 免費方案會休眠重開機，你工廠客戶的幾十萬筆進銷存資料都不會蒸發！）*
6. 點擊 **Create Web Service**，等它跑到出現綠色 `Live` 即代表後端上線拉！

---

## 架構調整心法：如何分辨是哪家客戶？ (邏輯隔離)

因為現在後端只有「一台機器」在跑，所有客戶 (A 廠、B 廠) 的資料都會寫進同一個 SQLite 檔案裡。
為了避免 A 廠的人查庫存看到 B 廠的貨，你必須稍微修改程式碼：

### 1. 資料庫加上標籤 (Server)
在你的 SQLite 所有資料表 (Table) 新增一個欄位叫做 `company_id`。
- A 廠存進去的商品，`company_id = 'A'`
- B 廠存進去的商品，`company_id = 'B'`

### 2. 前端偷塞標籤 (Client)
當 A 廠的員工用 `companya.你的網域.com` 開啟網頁時，你的 React/Vite 前端去讀網址 (`window.location.hostname`)。
發現是 A 廠，就在呼叫所有 API 的時候，把 `company_id = A` 塞進去。

```javascript
// 前端發送請求時
axios.get('/api/inventory', {
  headers: { 'X-Company-Id': 'A' }
});
```

### 3. 後端 API 把門看緊 (Server)
後端的每一支 API，收到請求第一件事就是看他是哪家公司，並且**只回傳那家公司的資料**。

```javascript
// 後端 Express 處理請求
app.get('/api/inventory', (req, res) => {
  const companyId = req.headers['x-company-id'];
  
  // 關鍵：WHERE 條件永遠要加上 company_id！
  const data = db.prepare('SELECT * FROM inventory WHERE company_id = ?').all(companyId);
  res.json(data);
});
```

---

## 結論

這套 **「Vercel (前端) + Render (後端 VPS)」** 的組合拳：
1. **0 元創業**：前期自己測試完全免費。
2. **財富自由**：程式碼都在你個人的 GitHub 上，完全脫離公司實體主機的綁架。
3. **無痛升級**：當你改了 Bug，只要 `git push` 上 GitHub，Vercel 和 Render 都會自動幫你重新打包佈署，所有幾十家客戶都會瞬間更新到最新版！
