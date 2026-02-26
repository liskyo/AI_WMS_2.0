const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Database Setup
const dbPath = path.join(__dirname, 'warehouse.db');
const db = new Database(dbPath/*, { verbose: console.log } */); // Disable verbose for performance

// Initialize Database
const initDb = () => {
  const createTables = `
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'SHELF',
      x REAL,
      y REAL,
      capacity INTEGER DEFAULT 100,
      floor TEXT DEFAULT '新大樓4樓'
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      unit TEXT,
      category TEXT,
      safe_stock INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(item_id, location_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
      item_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      ref_order TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      unit TEXT,
      group_name TEXT,
      permissions TEXT, -- JSON string
      email TEXT,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      main_barcode TEXT NOT NULL,
      component_barcode TEXT NOT NULL,
      required_qty REAL NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(main_barcode, component_barcode)
    );
  `;
  db.exec(createTables);
  console.log('Database initialized.');

  // Seed Admin User
  const admin = db.prepare('SELECT * FROM users WHERE employee_id = ?').get('admin');
  if (!admin) {
    db.prepare(`
      INSERT INTO users (employee_id, name, unit, group_name, permissions, email, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('admin', 'Admin User', 'IT', '管理者', JSON.stringify(['ALL']), 'admin@example.com', 'admin123');
    console.log('Default admin user created.');
  }
  db.exec(createTables);
  console.log('Database initialized.');

  // Seed Locations if empty
  const locationCount = db.prepare('SELECT count(*) as count FROM locations').get();
  if (locationCount.count === 0) {
    seedLocations();
  }

  // Migration: Add user_id to transactions if not exists
  try {
    const tableInfo = db.prepare("PRAGMA table_info(transactions)").all();
    const hasUserId = tableInfo.some(col => col.name === 'user_id');
    if (!hasUserId) {
      db.prepare('ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id)').run();
      console.log('Migration: Added user_id to transactions table.');
    }

    // Migration: Add is_deleted to transactions if not exists
    const hasIsDeleted = tableInfo.some(col => col.name === 'is_deleted');
    if (!hasIsDeleted) {
      db.prepare('ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0').run();
      console.log('Migration: Added is_deleted to transactions table.');
    }

    // Migration: Add deleted_by to transactions if not exists
    const hasDeletedBy = tableInfo.some(col => col.name === 'deleted_by');
    if (!hasDeletedBy) {
      db.prepare('ALTER TABLE transactions ADD COLUMN deleted_by INTEGER REFERENCES users(id)').run();
      console.log('Migration: Added deleted_by to transactions table.');
    }

    // Migration: Add unit to items if not exists
    const itemsTableInfo = db.prepare("PRAGMA table_info(items)").all();
    const hasUnit = itemsTableInfo.some(col => col.name === 'unit');
    if (!hasUnit) {
      db.prepare('ALTER TABLE items ADD COLUMN unit TEXT').run();
      console.log('Migration: Added unit to items table.');
    }

    // Migration: Add safe_stock to items if not exists
    const hasSafeStock = itemsTableInfo.some(col => col.name === 'safe_stock');
    if (!hasSafeStock) {
      db.prepare('ALTER TABLE items ADD COLUMN safe_stock INTEGER DEFAULT 0').run();
      console.log('Migration: Added safe_stock to items table.');
    }

    // Migration: Add floor to locations if not exists
    const locationsTableInfo = db.prepare("PRAGMA table_info(locations)").all();
    const hasFloor = locationsTableInfo.some(col => col.name === 'floor');
    if (!hasFloor) {
      db.prepare("ALTER TABLE locations ADD COLUMN floor TEXT DEFAULT '新大樓4樓'").run();
      console.log('Migration: Added floor to locations table.');
    }
  } catch (err) {
    console.warn('Migration specific error:', err);
  }
};

const seedLocations = () => {
  console.log('Seeding locations from Excel...');
  const pathsToCheck = [
    path.join(__dirname, '../input/儲位圖_1150222.xlsx'), // User specified file
    path.join(__dirname, 'data.xlsx'), // Docker mounted path
    path.join(__dirname, '../20260210 料架QRcode.xlsx'), // Local dev relative path
    "C:\\Users\\sky.lo\\Desktop\\倉庫出入料系統\\20260210 料架QRcode.xlsx"
  ];

  let filePath = pathsToCheck.find(p => fs.existsSync(p));

  try {
    if (filePath) {
      console.log(`Found Excel file at: ${filePath}`);
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const merges = worksheet['!merges'] || [];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const insert = db.prepare('INSERT OR IGNORE INTO locations (code, type, x, y, floor) VALUES (?, ?, ?, ?, ?)');
      const insertMany = db.transaction((locations) => {
        for (const loc of locations) insert.run(loc.code, 'SHELF', loc.x, loc.y, '新大樓4樓');
      });

      const locationsToInsert = [];

      // Excel row is Y, col is X
      data.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell && typeof cell === 'string' && cell.trim() !== '') {
            let code = cell.trim();
            // Prefix visual elements so they are unique in the database
            const isVisual = code.includes('柱') || code.includes('門') || code.includes('走道') || code.includes('圖') || /^[A-Z]$/.test(code);
            if (isVisual) {
              // Find if this cell is the top-left of a merge
              const merge = merges.find(m => m.s.c === colIndex && m.s.r === rowIndex);
              const spanX = merge ? (merge.e.c - merge.s.c + 1) : 1;
              const spanY = merge ? (merge.e.r - merge.s.r + 1) : 1;

              code = `#V_#${code}_${colIndex}_${rowIndex}_${spanX}_${spanY}`;
            }

            locationsToInsert.push({
              code: code,
              x: colIndex,
              y: rowIndex
            });
          }
        });
      });

      insertMany(locationsToInsert);
      console.log(`Seeded ${locationsToInsert.length} locations.`);
    } else {
      console.warn('Excel file not found, skipping seed.');
    }
  } catch (err) {
    console.error('Error seeding locations:', err);
  }
};

initDb();

// --- API Endpoints ---

// 1. Get All Locations (for Map)
app.get('/api/locations', (req, res) => {
  try {
    // Join with inventory to show status
    // 1. Get Base Locations with Total Quantity
    const query = `
        SELECT l.*, sum(i.quantity) as total_quantity
        FROM locations l
        LEFT JOIN inventory i ON l.id = i.location_id
        GROUP BY l.id
    `;
    const locations = db.prepare(query).all();

    // 2. Get Detailed Inventory for each location (to avoid GROUP_CONCAT issues)
    const inventoryQuery = `
        SELECT 
            inv.location_id,
            it.barcode,
            it.name,
            inv.quantity
        FROM inventory inv
        JOIN items it ON inv.item_id = it.id
        WHERE inv.quantity > 0
    `;
    const inventory = db.prepare(inventoryQuery).all();

    // 3. Merge Inventory into Locations
    const locationMap = new Map(locations.map(l => [l.id, { ...l, items: [] }]));

    inventory.forEach(item => {
      if (locationMap.has(item.location_id)) {
        locationMap.get(item.location_id).items.push({
          barcode: item.barcode,
          name: item.name,
          quantity: item.quantity
        });
      }
    });

    res.json(Array.from(locationMap.values()));
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Items (Search)
app.get('/api/items', (req, res) => {
  const { q } = req.query; // Keyword search

  // Base query with location aggregation
  let baseQuery = `
        SELECT 
            i.*, 
            IFNULL(SUM(inv.quantity), 0) as total_quantity,
            GROUP_CONCAT(l.code || '(' || inv.quantity || ')') as locations
        FROM items i
        LEFT JOIN inventory inv ON i.id = inv.item_id AND inv.quantity > 0
        LEFT JOIN locations l ON inv.location_id = l.id
    `;

  if (q) {
    const query = `
            ${baseQuery}
            WHERE (i.barcode LIKE ? OR i.name LIKE ? OR i.description LIKE ?)
            GROUP BY i.id
        `;
    const wildcard = `%${q}%`;
    try {
      const items = db.prepare(query).all(wildcard, wildcard, wildcard);
      return res.json(items);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const query = `
        ${baseQuery}
        GROUP BY i.id
    `;

  try {
    const items = db.prepare(query).all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get Specific Item Details (Inventory by Location)
app.get('/api/items/:barcode', (req, res) => {
  const { barcode } = req.params;
  const item = db.prepare('SELECT * FROM items WHERE barcode = ?').get(barcode);

  if (!item) return res.status(404).json({ error: 'Item not found' });

  const inventory = db.prepare(`
        SELECT inv.*, l.code as location_code, l.x, l.y
        FROM inventory inv
        JOIN locations l ON inv.location_id = l.id
        WHERE inv.item_id = ? AND inv.quantity > 0
        ORDER BY inv.updated_at ASC
    `).all(item.id);

  res.json({ item, inventory });
});

// 4. Transaction (Inbound/Outbound)
app.post('/api/transaction', (req, res) => {
  const { type, barcode, location_code, quantity, ref_order } = req.body;

  if (!['IN', 'OUT'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  if (!barcode || !location_code || !quantity) return res.status(400).json({ error: 'Missing fields' });

  // Identify User from Token (Optional but recommended for logging)
  let userId = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      userId = payload.id;
    } catch (e) {
      console.warn('Transaction: Invalid token provided');
    }
  }

  try {
    const result = db.transaction(() => {
      // 1. Find or Create Item (only for IN, strictly speaking, but handy to query)
      let item = db.prepare('SELECT * FROM items WHERE barcode = ?').get(barcode);
      if (!item) {
        if (type === 'OUT') throw new Error('Item not found for outbound');
        // Auto-create item for inbound if not exists (simplification)
        const info = db.prepare('INSERT INTO items (barcode, name) VALUES (?, ?)').run(barcode, `Item ${barcode}`);
        item = { id: info.lastInsertRowid, barcode };
      }

      // 2. Find Location
      const location = db.prepare('SELECT * FROM locations WHERE code = ?').get(location_code);
      if (!location) throw new Error('Location not found');

      // 3. Update Inventory
      const existingInv = db.prepare('SELECT * FROM inventory WHERE item_id = ? AND location_id = ?').get(item.id, location.id);
      let newQty = existingInv ? existingInv.quantity : 0;

      if (type === 'IN') {
        newQty += parseFloat(quantity);
      } else {
        newQty -= parseFloat(quantity);
        if (newQty < 0) throw new Error('Insufficient inventory');
      }

      if (existingInv) {
        db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, existingInv.id);
      } else {
        db.prepare('INSERT INTO inventory (item_id, location_id, quantity) VALUES (?, ?, ?)').run(item.id, location.id, newQty);
      }

      // 4. Log Transaction (with user_id)
      // Check if user_id column exists (it should due to migration, but handle safe)
      try {
        db.prepare('INSERT INTO transactions (type, item_id, location_id, quantity, ref_order, user_id) VALUES (?, ?, ?, ?, ?, ?)').run(type, item.id, location.id, quantity, ref_order || '', userId);
      } catch (e) {
        // Fallback if migration failed or column missing (Legacy support)
        console.warn('Transaction insertion with user_id failed, trying legacy insert:', e.message);
        db.prepare('INSERT INTO transactions (type, item_id, location_id, quantity, ref_order) VALUES (?, ?, ?, ?, ?)').run(type, item.id, location.id, quantity, ref_order || '');
      }

      return { success: true, newQty };
    })();

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Create/Update Item
app.post('/api/items', (req, res) => {
  const { barcode, name, description, category, unit, safe_stock } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO items (barcode, name, description, category, unit, safe_stock) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(barcode) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            category = excluded.category,
            unit = excluded.unit,
            safe_stock = excluded.safe_stock
        `);
    stmt.run(barcode, name, description, category, unit, safe_stock || 0);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5.1 Update Item Safe Stock
app.patch('/api/items/:barcode/safe-stock', (req, res) => {
  const { barcode } = req.params;
  const { safe_stock } = req.body;
  try {
    const stmt = db.prepare('UPDATE items SET safe_stock = ? WHERE barcode = ?');
    const info = stmt.run(safe_stock || 0, barcode);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Get Full Inventory Report (For Reports Page)
app.get('/api/reports/inventory', (req, res) => {
  try {
    const query = `
                SELECT 
                    i.barcode, 
                    i.name as item_name, 
                    i.description,
                    i.unit,
                    i.category,
                    i.safe_stock,
                    l.code as location_code, 
                    l.floor,
                    IFNULL(inv.quantity, 0) as quantity
                FROM items i
                LEFT JOIN inventory inv ON i.id = inv.item_id AND inv.quantity > 0
                LEFT JOIN locations l ON inv.location_id = l.id
                ORDER BY i.barcode, l.code
            `;
    const report = db.prepare(query).all();
    res.json(report);
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6.5 Get Transaction History
app.get('/api/transactions', (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const query = `
            SELECT 
                t.id,
                t.timestamp,
                t.type,
                t.quantity,
                t.is_deleted,
                i.barcode,
                i.name as item_name,
                l.code as location_code,
                u.employee_id,
                u.name as user_name,
                u_del.name as deleter_name,
                u_del.employee_id as deleter_id
            FROM transactions t
            JOIN items i ON t.item_id = i.id
            JOIN locations l ON t.location_id = l.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users u_del ON t.deleted_by = u_del.id
            ORDER BY t.timestamp DESC
        `;
    const history = db.prepare(query).all();
    res.json(history);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Admin & Import API ---

// 7. Admin Login (Database Verified)
// 7. Admin/User Login
app.post('/api/admin/login', (req, res) => {
  const { employee_id, password } = req.body;

  let user;
  if (employee_id) {
    // Check Employee ID OR Email
    user = db.prepare('SELECT * FROM users WHERE (employee_id = ? OR email = ?) AND password = ?').get(employee_id, employee_id, password);
  } else {
    // Fallback (Legacy)
    user = db.prepare('SELECT * FROM users WHERE employee_id = ? AND password = ?').get('admin', password);
  }

  if (user) {
    // Generate token
    const tokenPayload = JSON.stringify({
      id: user.id,
      name: user.name,
      group: user.group_name, // Token keeps 'group' for backend compat
      permissions: JSON.parse(user.permissions)
    });
    const token = Buffer.from(tokenPayload).toString('base64');

    res.json({
      success: true,
      token,
      user: {
        name: user.name,
        group_name: user.group_name, // Frontend expects 'group_name'
        permissions: JSON.parse(user.permissions)
      }
    });
  } else {
    res.status(401).json({ error: '無效的帳號或密碼' });
  }
});

// Middleware for Admin Check (Updated)
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const token = authHeader.split(' ')[1];
  if (token === 'mock-admin-token') return next(); // Legacy/Fallback

  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    if (payload.group === '管理者' || payload.permissions.includes('ALL')) {
      req.user = payload;
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  } catch (e) {
    res.status(401).json({ error: 'Invalid Token' });
  }
};

// 10. User Management APIs
app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, employee_id, name, unit, group_name, permissions, email FROM users').all();
  // Parse permissions for client
  const formatted = users.map(u => ({ ...u, permissions: JSON.parse(u.permissions) }));
  res.json(formatted);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { employee_id, name, unit, group_name, permissions, email, password } = req.body;
  try {
    db.prepare(`
            INSERT INTO users (employee_id, name, unit, group_name, permissions, email, password)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(employee_id, name, unit, group_name, JSON.stringify(permissions), email, password);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { employee_id, name, unit, group_name, permissions, email, password } = req.body;

  // Construct update query dynamically based on password presence
  if (password) {
    db.prepare(`
            UPDATE users SET employee_id = ?, name = ?, unit = ?, group_name = ?, permissions = ?, email = ?, password = ?
            WHERE id = ?
        `).run(employee_id, name, unit, group_name, JSON.stringify(permissions), email, password, id);
  } else {
    db.prepare(`
            UPDATE users SET employee_id = ?, name = ?, unit = ?, group_name = ?, permissions = ?, email = ?
            WHERE id = ?
        `).run(employee_id, name, unit, group_name, JSON.stringify(permissions), email, id);
  }
  res.json({ success: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (id == 1) return res.status(400).json({ error: "Cannot delete default admin" }); // Protect default admin
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

// 8. Transaction Voiding (Soft Delete)


// 8. Transaction Voiding (Soft Delete)
app.post('/api/admin/transactions/:id/void', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: 'Password required' });

  // 1. Identify User (Admin check)
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  let userId;
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    userId = payload.id;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Token' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'User not found' });

  const permissions = JSON.parse(user.permissions || '[]');
  const isAdmin = user.group_name === '管理者' || permissions.includes('ALL');

  if (!isAdmin) return res.status(403).json({ error: '權限不足' });
  if (user.password !== password) return res.status(403).json({ error: '密碼錯誤' });

  try {
    const result = db.transaction(() => {
      const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
      if (!tx) throw new Error('Transaction not found');
      if (tx.is_deleted) throw new Error('Transaction already voided');

      // Find current inventory
      const inv = db.prepare('SELECT * FROM inventory WHERE item_id = ? AND location_id = ?').get(tx.item_id, tx.location_id);

      if (!inv) {
        // Auto-create inventory record if missing (e.g. was 0)
        if (tx.type === 'OUT') {
          // Revert OUT -> Add back
          db.prepare('INSERT INTO inventory (item_id, location_id, quantity) VALUES (?, ?, ?)').run(tx.item_id, tx.location_id, tx.quantity);
        } else {
          // Revert IN -> Remove. If no record, implies 0. 0 - qty = negative.
          throw new Error('Cannot revert inbound transaction: Inventory record missing (would result in negative quantity)');
        }
      } else {
        let newQty = inv.quantity;
        if (tx.type === 'IN') {
          // Revert IN: Remove quantity
          newQty -= tx.quantity;
          if (newQty < 0) throw new Error('Insufficient inventory to revert this transaction');
        } else {
          // Revert OUT: Add quantity back
          newQty += tx.quantity;
        }

        db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, inv.id);
      }

      // Mark as Deleted
      db.prepare('UPDATE transactions SET is_deleted = 1, deleted_by = ? WHERE id = ?').run(userId, id);

      return { success: true };
    })();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8.5 Delete Item (Authenticated Admin Only)
app.delete('/api/admin/items/:barcode', (req, res) => {
  const { barcode } = req.params;
  const { password } = req.body;

  console.log(`[DELETE ITEM] Request for ${barcode}, Password provided: ${!!password}`);

  if (!password) {
    console.log('[DELETE ITEM] Error: Password required');
    return res.status(400).json({ error: 'Password required' });
  }

  // 1. Identify User from Token
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];

  let userId;
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    userId = payload.id;
  } catch (e) {
    console.log('[DELETE ITEM] Error: Invalid Token');
    return res.status(401).json({ error: 'Invalid Token' });
  }

  // 2. Refresh User Data from DB (Source of Truth)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    console.log('[DELETE ITEM] Error: User not found in DB');
    return res.status(401).json({ error: 'User not found' });
  }

  // 3. Verify Admin Permission
  const permissions = JSON.parse(user.permissions || '[]');
  const isAdmin = user.group_name === '管理者' || permissions.includes('ALL');

  if (!isAdmin) {
    console.log(`[DELETE ITEM] Error: User ${user.name} is not admin`);
    return res.status(403).json({ error: '權限不足：僅管理者可刪除' });
  }

  // 4. Verify Password (User's own password)
  if (user.password !== password) {
    console.log(`[DELETE ITEM] Error: Password mismatch for user ${user.name}`);
    return res.status(403).json({ error: '密碼錯誤' });
  }

  try {
    const result = db.transaction(() => {
      const item = db.prepare('SELECT id FROM items WHERE barcode = ?').get(barcode);
      if (!item) throw new Error('Item not found');

      // Check Total Quantity
      const qtyCheck = db.prepare('SELECT SUM(quantity) as total FROM inventory WHERE item_id = ?').get(item.id);
      if (qtyCheck && qtyCheck.total > 0) {
        console.log(`[DELETE ITEM] Error: Item ${barcode} has quantity ${qtyCheck.total}`);
        throw new Error('Cannot delete item with remaining inventory');
      }

      // Delete Transactions (Cascading delete to resolve FK constraint)
      db.prepare('DELETE FROM transactions WHERE item_id = ?').run(item.id);

      // Delete Inventory Records (0 qty ones)
      db.prepare('DELETE FROM inventory WHERE item_id = ?').run(item.id);

      // Delete Item
      db.prepare('DELETE FROM items WHERE id = ?').run(item.id);

      return { success: true };
    })();

    console.log(`[DELETE ITEM] Success: Deleted ${barcode}`);
    res.json(result);
  } catch (err) {
    console.error('[DELETE ITEM] Transaction Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 8. Import Items
app.post('/api/admin/import/items', requireAdmin, (req, res) => {
  const { items } = req.body; // Expects array of { barcode, name, category, description }
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const processItems = db.transaction((data) => {
      const incomingBarcodes = data.map(i => i.barcode).filter(Boolean);
      let deletedCount = 0;

      // 1. Delete items not in the imported list to ensure full overwrite
      if (incomingBarcodes.length > 0) {
        const placeholders = incomingBarcodes.map(() => '?').join(',');
        const obsoleteItems = db.prepare(`SELECT id, barcode FROM items WHERE barcode NOT IN (${placeholders})`).all(incomingBarcodes);

        for (const obs of obsoleteItems) {
          // Delete related records to prevent FK constraint failures and completely clear the item
          db.prepare('DELETE FROM inventory WHERE item_id = ?').run(obs.id);
          db.prepare('DELETE FROM transactions WHERE item_id = ?').run(obs.id);
          db.prepare('DELETE FROM bom_items WHERE main_barcode = ? OR component_barcode = ?').run(obs.barcode, obs.barcode);
          db.prepare('DELETE FROM items WHERE id = ?').run(obs.id);
          deletedCount++;
        }
      }

      // 2. Insert or update the new items
      const insert = db.prepare(`
            INSERT INTO items (barcode, name, category, description, unit, safe_stock) 
            VALUES (@barcode, @name, @category, @description, @unit, @safe_stock)
            ON CONFLICT(barcode) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            description = excluded.description,
            unit = excluded.unit,
            safe_stock = excluded.safe_stock
        `);

      for (const item of data) {
        insert.run({
          barcode: item.barcode,
          name: item.name,
          category: item.category || null,
          description: item.description || null,
          unit: item.unit || null,
          safe_stock: item.safe_stock || 0
        });
      }

      return { deletedCount };
    });

    const result = processItems(items);
    res.json({ success: true, count: items.length, deleted: result.deletedCount });
  } catch (err) {
    console.error('Import Items Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9. Import Inventory
app.post('/api/admin/import/inventory', requireAdmin, (req, res) => {
  const { inventory } = req.body; // Expects array of { barcode, location_code, quantity }
  if (!Array.isArray(inventory)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const processImport = db.transaction((data) => {
      // Clear existing inventory for full stocktake overwrite
      db.prepare('DELETE FROM inventory').run();

      for (const row of data) {
        // Find Item
        let item = db.prepare('SELECT id FROM items WHERE barcode = ?').get(row.barcode);
        if (!item) {
          // Auto-create item if missing (optional, but good for bulk import)
          const info = db.prepare('INSERT INTO items (barcode, name) VALUES (?, ?)').run(row.barcode, row.item_name || `Item ${row.barcode}`);
          item = { id: info.lastInsertRowid };
        }

        // Find Location
        const location = db.prepare('SELECT id FROM locations WHERE code = ?').get(row.location_code);
        if (!location) continue; // Skip invalid locations

        const existing = db.prepare('SELECT id FROM inventory WHERE item_id = ? AND location_id = ?').get(item.id, location.id);

        if (existing) {
          db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.quantity, existing.id);
        } else {
          db.prepare('INSERT INTO inventory (item_id, location_id, quantity) VALUES (?, ?, ?)').run(item.id, location.id, row.quantity);
        }
      }
    });

    processImport(inventory);
    res.json({ success: true, count: inventory.length });
  } catch (err) {
    console.error('Import Inventory Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9.5 Import Locations (Map)
app.post('/api/admin/import/locations', requireAdmin, (req, res) => {
  const { locations, floorName = '新大樓4樓' } = req.body; // Expects array of { code, x, y } directly
  if (!Array.isArray(locations)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const processLocations = db.transaction((locs) => {
      let insertedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      // Extract all incoming codes, matching the same suffix logic used for insertion
      const incomingCodes = locs.map(l => {
        let code = l.code;
        if (code && code.startsWith('#V_#') && !code.includes(`_F:${floorName}`)) {
          code = `${code}_F:${floorName}`;
        }
        return code;
      }).filter(Boolean);

      // Handle newly imported locations (insert or update)
      for (const loc of locs) {
        if (!loc.code) continue;

        // Make sure visual elements are unique per floor by appending floorName if they are visual and don't already have it
        let queryCode = loc.code;
        if (queryCode.startsWith('#V_#') && !queryCode.includes(`_F:${floorName}`)) {
          queryCode = `${queryCode}_F:${floorName}`;
        }

        const existing = db.prepare('SELECT id FROM locations WHERE code = ? AND floor = ?').get(queryCode, floorName);
        if (existing) {
          db.prepare('UPDATE locations SET x = ?, y = ? WHERE id = ?').run(loc.x, loc.y, existing.id);
          updatedCount++;
        } else {
          db.prepare('INSERT INTO locations (code, type, x, y, floor) VALUES (?, ?, ?, ?, ?)').run(queryCode, 'SHELF', loc.x, loc.y, floorName);
          insertedCount++;
        }
      }

      // Delete locations that are no longer in the map FOR THIS FLOOR
      if (incomingCodes.length > 0) {
        // Find locations not in the incoming list for the current floor
        const placeholders = incomingCodes.map(() => '?').join(',');
        const obsoleteLocations = db.prepare(`SELECT id, code FROM locations WHERE floor = ? AND code NOT IN (${placeholders})`).all(floorName, ...incomingCodes);

        for (const obs of obsoleteLocations) {
          // Check if there is inventory to prevent breaking data
          const hasInventory = db.prepare('SELECT SUM(quantity) as qty FROM inventory WHERE location_id = ?').get(obs.id);
          if (!hasInventory || hasInventory.qty === 0 || hasInventory.qty === null) {
            // Safe to delete inventory zero-qty rows first to prevent constraint errors
            db.prepare('DELETE FROM inventory WHERE location_id = ?').run(obs.id);
            // Delete location
            db.prepare('DELETE FROM locations WHERE id = ?').run(obs.id);
            deletedCount++;
          } else {
            console.warn(`Cannot delete obsolete location ${obs.code} because it still has inventory (${hasInventory.qty}). Keeping it.`);
          }
        }
      }

      return { insertedCount, updatedCount, deletedCount };
    });

    const result = processLocations(locations);
    res.json({ success: true, count: result.insertedCount + result.updatedCount, details: result });
  } catch (err) {
    console.error('Import Locations Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9.6 Rename Floor
app.put('/api/admin/locations/floor', requireAdmin, (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'Missing oldName or newName' });

  try {
    const info = db.prepare('UPDATE locations SET floor = ? WHERE floor = ?').run(newName, oldName);
    res.json({ success: true, count: info.changes });
  } catch (err) {
    console.error('Rename Floor Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- BOM (Bill of Materials) Endpoints ---

// 10. Import BOM
app.post('/api/admin/import/bom', requireAdmin, (req, res) => {
  const { bomData } = req.body; // Expects array of { main_barcode, component_barcode, required_qty }
  if (!Array.isArray(bomData)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const processBom = db.transaction((data) => {
      // Find all unique main_barcodes in the incoming data
      const mainBarcodes = [...new Set(data.map(r => r.main_barcode))];

      // Delete old configurations for these main items
      const deleteStmt = db.prepare('DELETE FROM bom_items WHERE main_barcode = ?');
      for (const mb of mainBarcodes) {
        deleteStmt.run(mb);
      }

      // Insert new configurations
      const insertStmt = db.prepare('INSERT INTO bom_items (main_barcode, component_barcode, required_qty) VALUES (?, ?, ?)');
      for (const row of data) {
        insertStmt.run(row.main_barcode, row.component_barcode, parseFloat(row.required_qty) || 1);
      }
    });

    processBom(bomData);
    res.json({ success: true, count: bomData.length });
  } catch (err) {
    console.error('Import BOM Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 11. Get BOM List with Inventory
app.get('/api/bom', (req, res) => {
  const { main_barcode } = req.query;
  try {
    let mainItems = [];
    if (main_barcode) {
      mainItems = db.prepare('SELECT DISTINCT main_barcode FROM bom_items WHERE main_barcode LIKE ?').all(`%${main_barcode}%`);
    } else {
      mainItems = db.prepare('SELECT DISTINCT main_barcode FROM bom_items').all();
    }

    const results = mainItems.map(m => {
      const components = db.prepare(`
        SELECT 
          b.component_barcode, 
          b.required_qty, 
          i.name as component_name,
          i.description,
          i.safe_stock,
          (SELECT IFNULL(SUM(quantity), 0) FROM inventory WHERE item_id = i.id) as current_stock,
          (
             SELECT GROUP_CONCAT(l.code || ':' || loc_stock.qty)
             FROM (
                SELECT location_id, SUM(quantity) as qty
                FROM inventory
                WHERE item_id = i.id
                GROUP BY location_id
             ) loc_stock
             JOIN locations l ON l.id = loc_stock.location_id
          ) as locations
        FROM bom_items b
        LEFT JOIN items i ON b.component_barcode = i.barcode
        WHERE b.main_barcode = ?
      `).all(m.main_barcode);

      return {
        main_barcode: m.main_barcode,
        components: components
      };
    });

    res.json(results);
  } catch (err) {
    console.error('Get BOM Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Transaction: BOM Outbound (Batch)
app.post('/api/transactions/bom-out', (req, res) => {
  const { main_barcode, sets, staged_picks, ref_order } = req.body;
  if (!main_barcode || !staged_picks || !Array.isArray(staged_picks) || staged_picks.length === 0) {
    return res.status(400).json({ error: 'Invalid parameters: staged_picks is required' });
  }

  // Token verify for user_id logging
  let userId = null;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
      userId = payload.id;
    } catch (e) { }
  }

  try {
    const executeBomOut = db.transaction(() => {
      const transactionsToLog = [];

      for (const pick of staged_picks) {
        const qty = parseFloat(pick.quantity);

        // 1. Find Item ID
        const item = db.prepare('SELECT id, name FROM items WHERE barcode = ?').get(pick.barcode);
        if (!item) throw new Error(`Component item not found: ${pick.barcode}`);

        // 2. Find Location ID
        const location = db.prepare('SELECT id FROM locations WHERE code = ?').get(pick.location_code);
        if (!location) throw new Error(`Location not found: ${pick.location_code}`);

        // 3. Find and verify existing inventory
        const existingInv = db.prepare('SELECT * FROM inventory WHERE item_id = ? AND location_id = ?').get(item.id, location.id);
        const existingQty = existingInv ? existingInv.quantity : 0;
        if (existingQty < qty) {
          throw new Error(`庫存不足: 元件 ${pick.barcode} 於儲位 ${pick.location_code} 僅有 ${existingQty}, 試圖扣除 ${qty}`);
        }

        // 4. Update Inventory
        const newQty = existingQty - qty;
        db.prepare('UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, existingInv.id);

        // 5. Queue Transaction Log
        transactionsToLog.push({
          type: 'OUT',
          item_id: item.id,
          location_id: location.id,
          qty: qty,
          ref: `BOM:${main_barcode} - 出庫 (${sets}套)`
        });
      }

      // 6. Write all Transaction Logs
      const insertTx = db.prepare('INSERT INTO transactions (type, item_id, location_id, quantity, ref_order, user_id) VALUES (?, ?, ?, ?, ?, ?)');
      for (const tx of transactionsToLog) {
        insertTx.run(tx.type, tx.item_id, tx.location_id, tx.qty, tx.ref, userId);
      }

      return { success: true, processedComponents: staged_picks.length };
    });

    const result = executeBomOut();
    res.json(result);

  } catch (err) {
    console.error('BOM Outbound Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Serve Static Files (Production)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Fallback for SPA (Fix: use regex to avoid path-to-regexp errors with *)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Start Server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`);
});

module.exports = { app, db };
