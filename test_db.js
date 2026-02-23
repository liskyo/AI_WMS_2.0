const db = require('./server/node_modules/better-sqlite3')('./server/warehouse.db');
console.log(db.prepare('SELECT * FROM locations WHERE code IN ("A", "B", "C", "D", "E", "F", "G", "H", "J", "K")').all());
console.log('Total A locations: ', db.prepare('SELECT * FROM locations WHERE code LIKE "%A%"').all().length);
