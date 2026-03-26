const cron = require('node-cron');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../warehouse.db');
const backupDir = path.join(__dirname, '../backups');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// 啟動排程任務 (預設每天凌晨 02:00 執行)
cron.schedule('0 2 * * *', async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `warehouse_backup_${timestamp}.db`);

    try {
        // 使用 better-sqlite3 建立唯讀連線並進行安全備份
        const db = new Database(dbPath, { readonly: true });
        await db.backup(backupFile);
        db.close();
        console.log(`✅ [${new Date().toLocaleString()}] 資料庫自動備份成功: ${backupFile}`);

        cleanupOldBackups(7); // 預設保留 7 天
    } catch (err) {
        console.error(`❌ 自動備份失敗: ${err.message}`);
    }
});

function cleanupOldBackups(daysToKeep) {
    const now = Date.now();
    const KEEP_TIME = daysToKeep * 24 * 60 * 60 * 1000;

    fs.readdir(backupDir, (err, files) => {
        if (err) return console.error('無法讀取備份庫資料夾', err);

        files.forEach((file) => {
            const filePath = path.join(backupDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.birthtimeMs > KEEP_TIME) {
                    fs.unlink(filePath, (err) => {
                        if (!err) console.log(`🗑️ 已清理過期備份: ${file}`);
                    });
                }
            });
        });
    });
}
