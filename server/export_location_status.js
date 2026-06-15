const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Get database path from command line arguments
let dbArg = process.argv[2];
if (!dbArg) {
  console.log("使用方式: node export_location_status.js <資料庫檔案路徑>");
  console.log("範例: node export_location_status.js backups/warehouse_backup_2026-05-21T02-00-00-790Z.db");
  process.exit(1);
}

const dbPath = path.resolve(dbArg);
if (!fs.existsSync(dbPath)) {
  console.error(`錯誤: 找不到資料庫檔案: ${dbPath}`);
  process.exit(1);
}

console.log(`正在讀取資料庫: ${dbPath}`);
const db = new Database(dbPath);

try {
  const query = `
    SELECT 
      l.code AS 儲位代碼,
      it.barcode AS 元件品號,
      it.name AS 品名,
      COALESCE(it.description, '') AS 規格,
      COALESCE(it.unit, '') AS 庫存單位,
      COALESCE(it.category, '') AS 庫別名稱,
      inv.quantity AS 數量
    FROM locations l
    JOIN inventory inv ON l.id = inv.location_id AND inv.quantity > 0
    LEFT JOIN items it ON inv.item_id = it.id
    WHERE l.code NOT LIKE '#V_#%' AND l.code NOT LIKE 'SYSTEM-%'
  `;

  const rows = db.prepare(query).all();
  
  if (rows.length === 0) {
    console.log("沒有找到任何有庫存的儲位資料。");
    process.exit(0);
  }

  // Sort rows naturally by 儲位代碼, then by 元件品號
  rows.sort((a, b) => {
    const codeCompare = a.儲位代碼.localeCompare(b.儲位代碼, undefined, { numeric: true });
    if (codeCompare !== 0) return codeCompare;
    return a.元件品號.localeCompare(b.元件品號, undefined, { numeric: true });
  });

  console.log(`成功讀取到 ${rows.length} 筆明細資料。`);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Set explicit column widths matching the fields
  ws['!cols'] = [
    { wch: 15 }, // 儲位代碼
    { wch: 20 }, // 元件品號
    { wch: 40 }, // 品名
    { wch: 30 }, // 規格
    { wch: 12 }, // 庫存單位
    { wch: 15 }, // 庫別名稱
    { wch: 10 }  // 數量
  ];

  XLSX.utils.book_append_sheet(wb, ws, "儲位總表");

  // Output file path
  const dbBaseName = path.basename(dbPath, path.extname(dbPath));
  const outputFileName = `${dbBaseName}_儲位總表.xlsx`;
  const outputPath = path.join(path.dirname(dbPath), outputFileName);

  XLSX.writeFile(wb, outputPath);
  console.log(`成功匯出 Excel 檔案至: ${outputPath}`);
} catch (err) {
  console.error("匯出過程發生錯誤:", err);
} finally {
  db.close();
}
