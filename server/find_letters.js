const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

const rows = db.prepare("SELECT * FROM locations WHERE code LIKE '%V_%' OR floor = '3F' LIMIT 20").all();
console.table(rows);
