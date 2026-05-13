/**
 * Bilingual copy when the backend API is unreachable (dev proxy / prod network).
 */

export const TITLE_ZH = '無法連線至後端 API';
export const TITLE_EN = 'Cannot reach the backend API (request to /api was refused or timed out)';

export const DETAIL_LINES_ZH_EN = [
    '請確認後端已啟動：在資料夾 `server` 執行 `npm start`，或由專案根目錄執行 `npm run dev` 同時啟動前後端（後端預設 http://127.0.0.1:3000）。',
    'Ensure the backend is running: `npm start` in `server/`, or `npm run dev` at repo root for both server and client (default backend http://127.0.0.1:3000).',
    '',
    '若僅開啟 Vite 而未開後端，畫面可能空白或出現 Proxy ECONNREFUSED；並非資料庫被清空。資料檔：`server/warehouse.db`。',
    'If only Vite runs, the UI may be empty or show proxy ECONNREFUSED; data is usually still in the DB file `server/warehouse.db`.',
].join('\n');

export const CLOSE_ARIA_LABEL = '暫時關閉提示 / Dismiss notice';
