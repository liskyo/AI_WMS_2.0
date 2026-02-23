const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'warehouse.db');
const db = new Database(dbPath, { verbose: console.log });

const seed = () => {
    console.log('Seeding mock data...');

    // 1. Create Mock Items
    const items = [
        { barcode: 'ITEM-001', name: '無線滑鼠', category: '電子配件', description: 'Logitech M331' },
        { barcode: 'ITEM-002', name: '機械鍵盤', category: '與子配件', description: 'Keychron K2' },
        { barcode: 'ITEM-003', name: '24吋螢幕', category: '顯示器', description: 'Dell U2422' },
        { barcode: 'ITEM-004', name: 'Type-C 線', category: '線材', description: '2M 編織線' },
        { barcode: 'ITEM-005', name: 'USB Hub', category: '配件', description: '7-in-1 Hub' },
    ];

    const insertItem = db.prepare(`
        INSERT OR IGNORE INTO items (barcode, name, category, description) 
        VALUES (@barcode, @name, @category, @description)
    `);

    items.forEach(item => insertItem.run(item));
    console.log('Items seeded.');

    // 2. Get IDs
    const allItems = db.prepare('SELECT id, barcode FROM items').all();
    const allLocations = db.prepare('SELECT id, code FROM locations LIMIT 20').all(); // Get first 20 locations

    if (allLocations.length === 0) {
        console.error('No locations found! Please ensure locations are seeded first (restart server).');
        return;
    }

    // 3. Seed Inventory (Randomly assign items to locations)
    const insertInventory = db.prepare(`
        INSERT OR REPLACE INTO inventory (item_id, location_id, quantity)
        VALUES (@item_id, @location_id, @quantity)
    `);

    // Clear existing mock inventory for these items to avoid duplicates/conflicts if re-run logic was different
    // But since we use REPLACE, it should be fine.

    let count = 0;
    allItems.forEach(item => {
        // Assign each item to 1-3 random locations
        const numLocs = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numLocs; i++) {
            const randomLocIndex = Math.floor(Math.random() * allLocations.length);
            const loc = allLocations[randomLocIndex];
            const qty = Math.floor(Math.random() * 50) + 1; // 1-50 qty

            insertInventory.run({
                item_id: item.id,
                location_id: loc.id,
                quantity: qty
            });
            console.log(`Assigned ${item.barcode} to ${loc.code}: Qty ${qty}`);
            count++;
        }
    });

    console.log(`Seeded ${count} inventory records.`);
};

seed();
