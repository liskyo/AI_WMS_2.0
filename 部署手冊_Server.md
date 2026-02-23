# 倉庫管理系統 - Server 部署手冊 (SOP)

本手冊說明如何將系統從本機部署至遠端伺服器 (Linux 環境)，並與本機開發環境區隔。

## 1. 環境區隔說明

| 環境 | 啟動方式 |特性 |
| :--- | :--- | :--- |
| **本機 (Development)** | `run_locally.bat` | 前後端分開執行 (Port 3000 + 5173)，支援熱重載 (HMR)。 |
| **Server (Production)** | `docker-compose` | 單一容器執行 (Port 3000)，後端同時服務 API 與前端靜態檔案。 |

---

## 2. 部署前準備 (本機端)

請確認以下檔案已存在於專案根目錄：
1.  `docker-compose.prod.yml` (已新增)
2.  `server/server.js` (已修改，增加了靜態檔案服務)

---

## 3. 部署流程 SOP

### 步驟 1：連線至 Server
開啟 PowerShell 或終端機：
```powershell
ssh ws@192.168.35.200
# 輸入密碼登入
```

### 步驟 2：上傳專案檔案
建議使用 `scp` 或 `git` 將專案複製到 Server。
**方法 A (Git Clone - 推薦)**:
```bash
# 在 Server 上執行
git clone https://github.com/liskyo/AI_WMS-.git wms_system
cd wms_system
```

**方法 B (SCP 上傳)**:
```powershell
# 在本機執行
scp -r "C:\Users\sky.lo\Desktop\倉庫出入料系統" ws@192.168.35.200:~/wms_system
```

### 步驟 3：啟動服務 (Production Mode)
在 Server 的專案目錄下執行：

```bash
# 0. (可選) 檢查 Port 3000 是否被佔用
netstat -tulpn | grep 3000

# 1. 建立並啟動容器 (使用生產環境設定)
docker-compose -f docker-compose.prod.yml up -d --build

# 2. 檢查運行狀態
docker-compose -f docker-compose.prod.yml ps
```

### 步驟 4：驗證
打開瀏覽器，輸入 Server IP：
`http://192.168.35.200:3000`

若看到登入畫面，即代表部署成功！
(注意：Server 已有運作中的前端服務 `ws-internal-frontend` (Port 80)，本系統運作於 Port 3000，兩者互不衝突)

---

## 4. 後續維護

### 更新程式碼
```bash
# 1. 拉取最新程式碼
git pull origin main

# 2. 重新建置並重啟 (不影響資料庫)
docker-compose -f docker-compose.prod.yml up -d --build
```

### 備份資料庫
資料庫位於 `warehouse.db`，直接備份該檔案即可。
```bash
cp warehouse.db warehouse_backup_$(date +%Y%m%d).db
```
