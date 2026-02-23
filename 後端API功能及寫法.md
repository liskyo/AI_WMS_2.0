# 後端 API 功能及寫法說明 (Backend Architecture & API Guide) v2.0

本文檔旨在提供後端開發的完整指南，涵蓋架構設計、資料庫結構、API 詳細規格及擴充教學。
目標是讓開發者能清楚理解每一行程式碼的用途，並能依照範例進行擴充。

---

## 目錄 (Table of Contents)

1.  [系統架構 (System Architecture)](#1-系統架構-system-architecture)
2.  [資料庫設計 (Database Schema)](#2-資料庫設計-database-schema)
3.  [核心開發模式 (Core Patterns)](#3-核心開發模式-core-patterns)
4.  [API 詳細規格 (API Specifications)](#4-api-詳細規格-api-specifications)
    *   [4.1 基礎資料 (Locations & Items)](#41-基礎資料-locations--items)
    *   [4.2 核心作業 (Transactions)](#42-核心作業-transactions)
    *   [4.3 報表 (Reports)](#43-報表-reports)
    *   [4.4 管理者與權限 (Admin & Auth)](#44-管理者與權限-admin--auth)
5.  [如何新增一支 API (How to Add New API)](#5-如何新增一支-api-how-to-add-new-api)

---

## 1. 系統架構 (System Architecture)

本專案採用 **極簡化單體架構 (Monolithic)**，適合中小型倉儲系統，強調部署容易與回應速度。

*   **Runtime Environment**: Node.js (建議 v18+)
*   **Web Framework**: Express.js (處理 HTTP 請求、路由、Middleware)
*   **Database Engine**: SQLite (檔案型關聯式資料庫，無需額外安裝 Server)
*   **Database Client**: `better-sqlite3`
    *   **同步特性 (Synchronous)**: 不同於一般的 Node.js 非同步操作，此套件操作 DB 是同步的。這意味著程式碼會從上而下依序執行，**不需要寫 `async/await`**，大幅降低邏輯複雜度，且效能極高。

### 1.1 為何選擇 SQLite? (SQLite 的好處與限制)

**好處 (Pros)**：
1.  **零配置 (Zero Configuration)**：不需要像 MySQL/PostgreSQL 安裝龐大的伺服器軟體，也不需管理帳號權限與連線設定。
2.  **單一檔案 (Single File)**：整個資料庫就是一個 `.db` 檔案，備份、遷移非常容易 (Copy & Paste 即可)。
3.  **極致輕量 (Lightweight)**：資源佔用極低，非常適合崁入式系統、桌面應用或中小型網站。
4.  **讀取效能優異**：對於讀多寫少的應用場景，其速度甚至超越大型資料庫 (因為沒有網路傳輸的開銷)。

**限制 (Cons)**：
1.  **寫入併發性 (Write Concurrency)**：SQLite 在同一時間只能有一個寫入操作 (Write Lock)，若有大量同時寫入請求，會排隊等待，導致效能瓶頸。
    *   *本專案對策*：使用 `better-sqlite3` 同步模式 + WAL (Write-Ahead Logging) 模式，已大幅優化此問題，足以應付一般中小企業倉儲流量。
2.  **缺乏使用者權限管理**：沒有內建的使用者帳號系統 (如 `GRANT SELECT TO user`)，權限需由應用程式層 (Node.js) 控制。
3.  **資料量限制**：雖然理論支援 140TB，但當單一檔案超過 10GB 時，備份與維護會變得較困難。建議適合 1GB 以下的專案。

**結論**：對於本倉儲系統 (內部使用、流量可預期)，SQLite 是 **最優解 (Best Practice)**，能大幅降低維運成本。

### 1.2 未來擴充：圖片儲存建議 (Storing Images)

若未來需要儲存料件照片，**強烈建議不要直接存入 SQLite (BLOB)**，這會導致資料庫檔案暴肥，嚴重影響效能。

**推薦做法 (File Storage Pattern)**：
1.  **檔案存硬碟**：將圖片存於專案的 `uploads/` 資料夾中。
2.  **路徑存資料庫**：在 `items` 表新增 `image_path` 欄位，僅存檔名 (e.g., `item_123.jpg`)。

**實作範例**：
可以使用 `multer` 套件處理上傳：
```javascript
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

app.post('/api/items/:barcode/image', upload.single('photo'), (req, res) => {
    const filename = req.file.filename;
    db.prepare('UPDATE items SET image_path = ? WHERE barcode = ?').run(filename, req.params.barcode);
    res.json({ success: true, path: filename });
});
```
前端讀取時，直接透過靜態檔案服務 (`app.use('/uploads', express.static('uploads'))`) 即可顯示。

### 檔案結構
```text
server/
├── server.js           # 核心檔案：包含所有 Server 設定、API 路由、資料庫邏輯
├── warehouse.db        # 資料庫檔案 (由程式自動建立)
├── package.json        # 專案依賴設定
└── data.xlsx           # (選用) 用於初始化儲位資料的 Excel
```

---

## 2. 資料庫設計 (Database Schema)

系統主要由 5 個資料表組成。

### 2.1 `items` (料件主檔)
存放料件的基本資料。

| 欄位 | 型態 | 說明 | 備註 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 | Auto Increment |
| `barcode` | TEXT | 條碼 | Unique, 用於掃描識別 |
| `name` | TEXT | 品名 | |
| `description` | TEXT | 規格/描述 | |
| `category` | TEXT | 類別 | e.g. 電子零件, 包材 |

### 2.2 `locations` (儲位主檔)
存放倉庫儲位的座標與編號。

| 欄位 | 型態 | 說明 | 備註 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 | Auto Increment |
| `code` | TEXT | 儲位編號 | Unique, e.g. "A-01-01" |
| `type` | TEXT | 類型 | Default 'SHELF' |
| `x` | REAL | X 座標 | 平面圖繪製用 |
| `y` | REAL | Y 座標 | 平面圖繪製用 |

### 2.3 `inventory` (庫存表)
記錄「哪個料件」在「哪個儲位」有「多少數量」。

| 欄位 | 型態 | 說明 | 備註 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 | |
| `item_id` | INTEGER | 料件 FK | 關聯 items.id |
| `location_id` | INTEGER | 儲位 FK | 關聯 locations.id |
| `quantity` | INTEGER | 數量 | 必須 >= 0 |
| `updated_at` | DATETIME | 最後更新日 | 用於 FIFO 排序 |

### 2.4 `transactions` (交易紀錄)
記錄每一筆出入庫的歷程流水帳。

| 欄位 | 型態 | 說明 | 備註 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 | |
| `type` | TEXT | 類型 | 'IN' (入庫) 或 'OUT' (出庫) |
| `item_id` | INTEGER | 料件 FK | |
| `location_id` | INTEGER | 儲位 FK | |
| `quantity` | INTEGER | 異動數量 | |
| `timestamp` | DATETIME | 發生時間 | Default Current Time |
| `ref_order` | TEXT | 關聯單號 | 工單或採購單號 |
| `user_id` | INTEGER | 操作人員 | 關聯 users.id |
| `is_deleted` | INTEGER | 是否作廢 | 0: 正常, 1: 已作廢 |
| `deleted_by` | INTEGER | 刪除者 | 關聯 users.id |

### 2.5 `users` (使用者)
| 欄位 | 型態 | 說明 | 備註 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | 主鍵 | |
| `employee_id` | TEXT | 員工編號 | Unique, 登入帳號 |
| `password` | TEXT | 密碼 | 明文存儲 (開發階段) |
| `permissions` | TEXT | 權限 | JSON String, e.g. `["ALL"]` |

---

## 3. 核心開發模式 (Core Patterns)

### 3.1 準備 SQL 語句 (Prepare Statement) - `db.prepare()`
這是 `better-sqlite3` 最核心的函式，它的概念是 **「預編譯 (Pre-compile)」** SQL 語句。

**為什麼要用它？**
1.  **安全性 (Security)**：防止 SQL Injection 攻擊。
    *   它會將 SQL 語句與參數分開處理，即便參數內含有惡意指令 (e.g., `' OR 1=1 --`), 也會被視為純文字，而不會被執行。
2.  **效能 (Performance)**：
    *   資料庫只需要解析和編譯 SQL 語句 **一次**。
    *   之後若要重複執行 (例如迴圈插入 1000 筆資料)，只需要填入不同的參數，速度極快。

**語法結構**：
```javascript
// 1. 準備 (Prepare): 此時 SQL 尚未執行，只是編譯好
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');

// 2. 執行 (Execute): 填入參數 '123' 並真正跑資料庫
const user = stmt.get('123');
```

```javascript
// ❌ 錯誤示範 (危險! 容易被駭客攻擊)
db.exec(`SELECT * FROM users WHERE id = ${id}`); 

// ✅ 正確示範 (安全且快速)
const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
const user = stmt.get(id);
```

### 3.2 讀取資料 (Read)
*   **`.all()`**: 取得所有符合的資料 (回傳 Array)。
*   **`.get()`**: 取得第一筆符合的資料 (回傳 Object 或 undefined)。

```javascript
// 取得所有庫存大於 0 的紀錄
const rows = db.prepare('SELECT * FROM inventory WHERE quantity > 0').all();

// 取得特定條碼的料件
const item = db.prepare('SELECT * FROM items WHERE barcode = ?').get('ITEM001');
```

### 3.3 寫入資料 (Write)
*   **`.run()`**: 執行 INSERT, UPDATE, DELETE。回傳 `info` 物件 (包含 `changes`, `lastInsertRowid`)。

```javascript
const info = db.prepare('UPDATE inventory SET quantity = 10 WHERE id = 1').run();
console.log(`更新了 ${info.changes} 筆資料`);
```

### 3.4 資料庫交易 (Transaction)
**這是後端最重要的部分**。當一個操作涉及多個步驟 (例如入庫：1.找料件 2.找儲位 3.更新庫存 4.寫入流水帳)，必須包在 Transaction 中。
若中間發生錯誤 (throw Error)，整個操作會自動回滾 (Rollback)，確保資料不會壞掉。

```javascript
const doTransaction = db.transaction((params) => {
    // 步驟 1
    db.prepare('INSERT...').run();
    // 步驟 2
    if (somethingWrong) throw new Error('庫存不足'); // 自動 Rollback
    // 步驟 3
    db.prepare('UPDATE...').run();
});

try {
    doTransaction(data);
} catch (err) {
    console.error('交易失敗:', err.message);
}
```

---

## 4. API 詳細規格 (API Specifications)

以下列出專案中所有 API 的詳細用法與邏輯。URL 前綴均為 `http://localhost:3000`。

### 4.1 基礎資料 (Locations & Items)

#### **1. 取得平面圖儲位資料**
*   **Method**: `GET`
*   **URL**: `/api/locations`
*   **功能**: 取回所有儲位座標、狀態及詳細庫存內容 (用於 MapGrid 顯示)。
*   **回應範例**:
    ```json
    [
      {
        "id": 1,
        "code": "4-A-1-1",
        "type": "SHELF",
        "x": 0,
        "y": 0,
        "total_quantity": 50,
        "items": [
          { "barcode": "A001", "name": "螺絲", "quantity": 30 },
          { "barcode": "B002", "name": "螺帽", "quantity": 20 }
        ]
      }
    ]
    ```
*   **後端邏輯**:
    1.  查詢 `locations` 表，並 `LEFT JOIN inventory` 計算 `total_quantity`。
    2.  查詢所有 `inventory` 明細 (數量 > 0)。
    3.  在記憶體中將 inventory 明細分配到對應的 location 物件中 (避免 SQL Group Concat 字串處理的複雜度)。

#### **2. 搜尋料件**
*   **Method**: `GET`
*   **URL**: `/api/items?q=關鍵字`
*   **功能**: 搜尋料件，並顯示總庫存與分佈位置摘要。
*   **參數**: `q` (選填) - 搜尋 Barcode, Name 或 Description。
*   **後端邏輯**:
    *   使用 `LIKE %keyword%` 進行模糊搜尋。
    *   使用 `GROUP_CONCAT` 將分佈儲位合併成字串 (e.g., "A-01(5), B-02(3)") 以方便前端列表顯示。

#### **3. 取得單一料件詳細庫存 (FIFO 排序)**
*   **Method**: `GET`
*   **URL**: `/api/items/:barcode`
*   **功能**: 用於出入庫作業時，顯示該料件目前都在哪裡。
*   **特色**: 支援 **FIFO (先進先出)**。
*   **後端邏輯**:
    ```sql
    SELECT inv.*, l.code
    FROM inventory inv
    JOIN locations l ON ...
    WHERE inv.item_id = ?
    ORDER BY inv.updated_at ASC  -- 關鍵：依照更新時間由舊到新排序
    ```
    這確保了建議出庫的儲位 (最舊的庫存) 會排在清單最上面。

---

### 4.2 核心作業 (Transactions)

#### **1. 執行出入庫**
*   **Method**: `POST`
*   **URL**: `/api/transaction`
*   **Header**: `Authorization: Bearer <token>`
*   **請求 Body**:
    ```json
    {
      "type": "IN",           // "IN" 或 "OUT"
      "barcode": "ITEM-001",
      "location_code": "4-A-1-1",
      "quantity": 10,
      "ref_order": "PO-20261001" // 選填
    }
    ```
*   **後端邏輯 (Transaction)**:
    1.  **驗證 Token**: 解析 Header 取得 `user_id`。
    2.  **開啟交易 (`db.transaction`)**:
    3.  **查找/建立料件**:
        *   如果是 `IN` 且料件不存在 -> `INSERT INTO items` (自動建擋)。
        *   如果是 `OUT` 且料件不存在 -> 拋出錯誤 `Item not found`。
    4.  **查找儲位**: 確認儲位代碼存在。
    5.  **更新庫存 (`inventory` 表)**:
        *   查找該 (料件 + 儲位) 是否有紀錄。
        *   `IN`: 原數量 + 新數量。
        *   `OUT`: 原數量 - 新數量 (檢查是否 < 0)。
        *   執行 `UPDATE` 或 `INSERT`。
        *   **關鍵**: 更新 `updated_at = CURRENT_TIMESTAMP`。
    6.  **寫入流水帳 (`transactions` 表)**:
        *   寫入此次操作紀錄，包含 `user_id`。

#### **2. 查詢交易歷史**
*   **Method**: `GET`
*   **URL**: `/api/transactions`
*   **功能**: 取得所有流水帳，包含操作者與作廢資訊。
*   **SQL 邏輯**:
    *   多表聯集: `transactions` JOIN `items`, `locations`, `users` (操作者), `users` (刪除者)。
    *   排序: `ORDER BY timestamp DESC` (最新在最前)。

---

### 4.3 報表 (Reports)

#### **1. 庫存總表**
*   **Method**: `GET`
*   **URL**: `/api/reports/inventory`
*   **功能**: 取得 Flatten (扁平化) 的庫存清單，供前端製作 Excel 報表。
*   **SQL**:
    ```sql
    SELECT i.barcode, i.name, l.code, inv.quantity
    FROM items i
    JOIN inventory inv ...
    JOIN locations l ...
    WHERE inv.quantity > 0
    ORDER BY i.barcode
    ```
    前端收到資料後，會自行依照 Tab (料件視角/儲位視角) 進行 `reduce` 分組運算。

---

### 4.4 管理者與權限 (Admin & Auth)

#### **1. 登入 (Login)**
*   **Method**: `POST`
*   **URL**: `/api/admin/login`
*   **Body**: `{ "employee_id": "admin", "password": "..." }`
*   **邏輯**:
    1.  查詢 `users` 表。
    2.  比對密碼 (目前為明文比對，生產環境建議改用 bcrypt)。
    3.  產生 **Token**: 將使用者資訊 (ID, Name, Permissions) 轉為 JSON 字串並做 Base64 編碼 (簡易版 JWT)。
    4.  回傳 `{ success: true, token: "..." }`。

#### **2. 作廢交易 (Void Transaction)**
*   **Method**: `POST`
*   **URL**: `/api/admin/transactions/:id/void`
*   **權限**: 僅管理者 (Middleware `requireAdmin` 檢查)。
*   **邏輯 (Transaction)**:
    1.  驗證二次密碼 (Body 傳入 `password`)。
    2.  找到該筆交易 ID。
    3.  **反向操作庫存**:
        *   原單是 IN -> 執行扣庫存。
        *   原單是 OUT -> 執行加庫存。
    4.  標記 `is_deleted = 1`。

#### **3. 刪除料件 (Delete Item)**
*   **Method**: `DELETE`
*   **URL**: `/api/admin/items/:barcode`
*   **邏輯**:
    1.  **檢查庫存**: 若該料件在庫總數 > 0，禁止刪除 (防呆)。
    2.  **Cascade Delete**:
        *   先刪除 `transactions` (該料件的所有歷史紀錄)。
        *   再刪除 `inventory` (該料件的 0 庫存紀錄)。
        *   最後刪除 `items` 主檔。
    *   這樣做是為了保持外鍵完整性 (Foreign Key Integrity)。

---

## 5. 如何新增一支 API (How to Add New API)

假設您想要新增一個 API：**「取得特定類別的所有料件」**。

### 步驟 1：定義路徑與方法
*   URL: `/api/items/category/:category`
*   Method: `GET`

### 步驟 2：在 `server.js` 中新增路由

找到 `// --- API Endpoints ---` 區塊，加入以下程式碼：

```javascript
// Get Items by Category
app.get('/api/items/category/:category', (req, res) => {
    // 1. 取得參數
    const { category } = req.params;

    try {
        // 2. 準備 SQL
        // 這裡我們想知道該類別下每個料件的總庫存
        const query = `
            SELECT i.*, SUM(inv.quantity) as total_qty
            FROM items i
            LEFT JOIN inventory inv ON i.id = inv.item_id
            WHERE i.category = ?
            GROUP BY i.id
        `;

        // 3. 執行查詢
        const results = db.prepare(query).all(category);

        // 4. 回傳結果
        res.json(results);

    } catch (err) {
        // 5. 錯誤處理
        console.error('Category Search Error:', err);
        res.status(500).json({ error: err.message });
    }
});
```

### 步驟 3：前端呼叫
在前端 `api.js` 中加入對應函式：
```javascript
export const getItemsByCategory = (cat) => api.get(`/items/category/${cat}`);
```

---

此文件詳細記錄了目前的後端設計。若有任何邏輯修改，請同步更新此文件以維持文檔一致性。
