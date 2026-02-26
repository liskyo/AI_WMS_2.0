const db = require('better-sqlite3')('server/warehouse.db');
db.prepare("DELETE FROM locations WHERE code = '#V_#A_29_31_1_1'").run();
console.log('Deleted stray A from DB.');
