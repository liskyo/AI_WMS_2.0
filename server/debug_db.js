const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'warehouse.db');
const db = new Database(dbPath);

console.log('DB Path:', dbPath);

const rows = db.prepare(`
    SELECT 
        inv.id as inv_id,
        inv.item_id,
        inv.location_id,
        inv.quantity,
        l.id as loc_id,
        l.code as loc_code
    FROM inventory inv
    LEFT JOIN locations l ON inv.location_id = l.id
    LIMIT 20
`).all();

console.log('Inventory Join Check:');
console.table(rows);

const itemCheck = db.prepare(`
    SELECT 
        i.barcode,
        GROUP_CONCAT(l.code) as agg_codes,
        GROUP_CONCAT(l.code || '(' || inv.quantity || ')') as formatted
    FROM items i
    LEFT JOIN inventory inv ON i.id = inv.item_id
    LEFT JOIN locations l ON inv.location_id = l.id
    WHERE i.barcode = 'ITEM-001'
    GROUP BY i.id
`).get();

console.log('Item ITEM-001 Check:', itemCheck);
