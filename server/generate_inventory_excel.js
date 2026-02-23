const XLSX = require('xlsx');
const path = require('path');
const Database = require('better-sqlite3');

// 1. Get Valid Locations from DB
const dbPath = path.join(__dirname, 'warehouse.db');
const db = new Database(dbPath);

const locations = db.prepare("SELECT code FROM locations WHERE code LIKE '4A-%' LIMIT 100").all().map(l => l.code);

if (locations.length === 0) {
    console.error("No locations found in DB!");
    process.exit(1);
}

// 2. Define Items (from previous step)
const items = [
    { code: "ITEM-101", name: "無線鍵盤 K1" },
    { code: "ITEM-102", name: "藍牙滑鼠 M2" },
    { code: "ITEM-103", name: "HDMI 傳輸線 2M" },
    { code: "ITEM-104", name: "USB-C 充電線" },
    { code: "ITEM-105", name: "網路線 CAT6 5M" },
    { code: "ITEM-106", name: "螢幕支架 (單臂)" },
    { code: "ITEM-107", name: "人體工學椅" },
    { code: "ITEM-108", "name": "行動電源 20000mAh" },
    { code: "ITEM-109", "name": "與會者麥克風" },
    { code: "ITEM-110", "name": "網路攝影機 1080P" },
    { code: "ITEM-111", "name": "機械鍵盤 (紅軸)" },
    { code: "ITEM-112", "name": "電競耳機" }
];

// 3. Generate Inventory Rows
const headers = ["條碼", "品名", "儲位代碼", "數量"];
const rows = [];

// Helper to get random int
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Helper to get random location
const getRandomLocation = () => locations[randomInt(0, locations.length - 1)];

items.forEach(item => {
    // Decide how many locations for this item (1 to 3)
    const numLocs = randomInt(1, 3);

    // Pick unique locations for this item
    const chosenLocs = new Set();
    while (chosenLocs.size < numLocs) {
        chosenLocs.add(getRandomLocation());
    }

    chosenLocs.forEach(locCode => {
        rows.push([
            item.code,
            item.name,
            locCode,
            randomInt(5, 50) // Random quantity
        ]);
    });
});

console.log(`Generated ${rows.length} inventory rows.`);

// 4. Create Excel
const wb = XLSX.utils.book_new();
const wsData = [headers, ...rows];
const ws = XLSX.utils.aoa_to_sheet(wsData);

XLSX.utils.book_append_sheet(wb, ws, "InventoryImport");

// Save to input directory
const userDesktop = path.join(__dirname, '../input');
const outputPath = path.join(userDesktop, `盤點匯入範本_${rows.length}筆.xlsx`);

try {
    XLSX.writeFile(wb, outputPath);
    console.log(`Successfully created: ${outputPath}`);
} catch (err) {
    console.error(`Error writing file: ${err.message}`);
    XLSX.writeFile(wb, 'inventory_import.xlsx');
}
