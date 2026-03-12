# AI WMS 2.0 - B2B 多租戶 SaaS 部署與 Nginx 反向代理教學

這份文件將教你如何使用 **Docker 搭配 Nginx 反向代理**，將同一套「AI 智慧倉儲」系統部署給多家客戶使用，達成以下目標：
1. **保護原始碼**：程式碼打包成 Docker Image，伺服器上看不見原始碼。
2. **多客戶隔離**：各家公司 (Company A, Company B) 擁有獨立的資料庫、獨立的網址。
3. **資源極度節省**：不需要複製十份專案資料夾。

---

## 什麼是 Nginx 反向代理？

想像 Nginx 是一棟商業大樓的「總機小姐」。
- 公司 A 的員工在瀏覽器輸入 `http://companya.你的網域.com`
- 公司 B 的員工輸入 `http://companyb.你的網域.com`
這些請求都會先送到你伺服器的 Nginx (Port 80/443)。Nginx 看到是 `companya` 來的，就會幫他把請求轉接到 Docker 裡面的 Port 3001；看到 `companyb`，就轉接到 Port 3002。

---

## 步驟一：將專案打包成 Docker Image

首先，你要把目前的系統打包成一個「不可修改的模具」。請在專案根目錄（有 Dockerfile 的地方）執行：

```bash
# 打包出一個叫做 ai-wms 的 image，版本標記為 v1
docker build -t ai-wms:v1 .
```

*注意：這個動作只需要做一次。未來如果有更新程式碼，重新 build 一個 `v2` 即可。*

---

## 步驟二：建立伺服器目錄結構

在你自己的雲端伺服器上（VPS、Linux 實體機等），建立一個專門放「客戶資料與設定」的目錄。**這裡完全不需要放任何原始碼！**

```text
/opt/wms-deploy/
├── docker-compose.yml       # 管理所有客戶和 Nginx 的設定檔
├── nginx/
│   └── nginx.conf           # Nginx 總機小姐的轉接規則
└── data/                    # 存放各家公司 SQLite 的實體硬碟空間
    ├── companyA/
    │   └── database.sqlite  # A 公司專屬資料庫 (空的結構)
    └── companyB/
        └── database.sqlite  # B 公司專屬資料庫 (空的結構)
```

---

## 步驟三：設定 docker-compose.yml

這份設定檔就是告訴伺服器你要「印」出哪些系統給客戶用，並搭配一台總機 (Nginx) 來分發網址。
建立 `/opt/wms-deploy/docker-compose.yml`：

```yaml
version: '3.8'

services:
  # --- 負責分發網址的總機 Nginx ---
  nginx:
    image: nginx:latest
    ports:
      - "80:80"     # 讓外部網路 HTTP 請求進來
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - wms-company-a
      - wms-company-b

  # --- A 公司的專屬系統 ---
  wms-company-a:
    image: ai-wms:v1   # 使用剛才打包的模具
    volumes:
      - ./data/companyA/database.sqlite:/app/server/database.sqlite  # 把 A 公司的實體資料庫掛進去
    environment:
      - CLIENT_NAME=Company_A
    # 注意：不需要開 ports，讓 Nginx 從內部網路連過來即可！

  # --- B 公司的專屬系統 ---
  wms-company-b:
    image: ai-wms:v1
    volumes:
      - ./data/companyB/database.sqlite:/app/server/database.sqlite
    environment:
      - CLIENT_NAME=Company_B
```

---

## 步驟四：設定 Nginx 反向代理 (nginx.conf)

這份設定檔用來告訴總機，哪家公司的網址該轉去哪個 Docker 容器。
建立 `/opt/wms-deploy/nginx/nginx.conf`：

```nginx
events {}

http {
    # 設定給 A 公司的網址轉接
    server {
        listen 80;
        server_name companya.你的網域.com;

        location / {
            # 將請求轉發給 Docker 內部的 wms-company-a 容器 (port 看你的後端是跑在哪個 port)
            proxy_pass http://wms-company-a:3000; 
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # 設定給 B 公司的網址轉接
    server {
        listen 80;
        server_name companyb.你的網域.com;

        location / {
            # 將請求轉發給 Docker 內部的 wms-company-b 容器
            proxy_pass http://wms-company-b:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

---

## 步驟五：一鍵啟動與升級！

所有設定寫好後，打開伺服器終端機，移到 `/opt/wms-deploy/` 目錄，執行：

```bash
docker-compose up -d
```

系統就會在背景把 Nginx、A 公司的系統、B 公司的系統全部跑起來！

- 客戶連 `http://companya.你的網域.com` -> 碰到 Nginx -> 轉給 `wms-company-a` -> 讀寫專屬的 A 公司資料庫。
- **程式碼全面隱形**：所有運作都在編譯好的 Image 裡面，伺服器上只有 `docker-compose.yml`，無任何原始碼外流風險。
- **無痛全客戶升級**：當你寫了新功能，只要重包一個 `ai-wms:v2` 的 Image，再把 `docker-compose.yml` 裡面的版本號改成 `v2`，執行指令 `docker-compose up -d`，所有客戶同時享有最新功能，而且資料完全不漏接！

---

## 步驟六：網域 (Domain) 與 DNS 設定

你文件裡看到的 `companya.你的網域.com`，**網域是需要自己花錢購買，並且自己設定的**。
設定好後，Nginx 才能認得這些自訂網址。

### 1. 購買網域 (Domain Name)
你需要去網域商（如 **GoDaddy、Cloudflare、Porkbun、Gandi** 等）買一個專屬網域。
例如你買了：`ai-wms.com` (通常一年約 300~500 台幣)。

### 2. 設定 DNS 紀錄 (指向你的伺服器)
買完網域後，進入網域商的「DNS 管理後台」，把你要開給客戶的「子網域 (Subdomain)」指向你那台**伺服器的對外固定 IP**。

**新增 DNS A 紀錄：**
*   **類型**: `A`
*   **名稱 (Host/Name)**: `companya` （代表客戶 A）
*   **數值 (Value/IPv4 Address)**: `123.45.67.89` （填入你 VPS/伺服器的對外 IP）

*   **類型**: `A`
*   **名稱 (Host/Name)**: `companyb` （代表客戶 B）
*   **數值 (Value/IPv4 Address)**: `123.45.67.89` （一樣填你伺服器的 IP）

*(💡 進階技巧：你也可以直接設一個 `*` (Wildcard) 指向伺服器 IP，這樣未來開任何 `xxx.ai-wms.com` 都不用再來改 DNS 設定，只要改 Nginx 就好。)*

### 3. 對應回 Nginx 設定檔
DNS 設定會在幾分鐘到幾小時內生效。生效後，當瀏覽器造訪 `companya.ai-wms.com` 時，這個請求就會飛到你的伺服器 (`123.45.67.89`)。

這時你的 `nginx.conf` 裡面對應的設定就會接手處理：
```nginx
server {
    listen 80;
    # 這裡的 server_name 就是剛才 DNS 設定好的自訂網址
    server_name companya.ai-wms.com; 

    location / { ... }
}
```

**結論**：
1. 網域要自己買。
2. 買完去 DNS 後台設定 A 紀錄，指到伺服器 IP。
3. 把 `nginx.conf` 裡的 `server_name` 換成你設定好的網址。
