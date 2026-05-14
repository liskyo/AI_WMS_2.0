/**
 * Client-side bilingual fallbacks when the API returns no message or the network fails.
 */

const HAN_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/**
 * Axios / browser errors often surface as English-only (`Network Error`, etc.).
 * Prefer `response.data.error` when present (usually already bilingual from API).
 */
export function axiosErrorDetail(err, fallback = '') {
    const raw = err?.response?.data?.error ?? err?.message ?? '';
    const s = String(raw).trim();
    if (!s) return fallback;
    if (HAN_RE.test(s)) return s;
    return `發生錯誤 ${s}`;
}
export const LOGIN_FAILED = '登入失敗 Login failed';
export const OPERATION_FAILED = '操作失敗 Operation failed';
export const BATCH_OUT_FAILED = '批次出庫失敗 Batch outbound failed';
export const DELETE_VOID_FAILED = '刪除失敗 Failed to void record';
export const DELETE_ROW_FAILED_PREFIX = '刪除失敗 Delete failed'; // Reports: suffix : detail from server
export const EXPORT_FAILED = '匯出失敗 Export failed';
export const EXPORT_NO_ROWS = '沒有可匯出的資料 No data to export';
export const EXPORT_NO_REPORT = '目前無庫存資料可匯出 No inventory data to export yet';
export const SAFE_STOCK_UPDATE_FAILED = '更新安全庫存失敗 Failed to update safety stock';
export const QUERY_FAILED_FALLBACK =
    '查詢失敗，請確認儲位代碼 Query failed — verify the bin / location code';
export const SAVE_USER_FAILED_PREFIX = '儲存失敗 Save failed';
export const DELETE_USER_FAILED = '刪除使用者失敗 Failed to delete user';
export const IMPORT_FAILED_PREFIX = '匯入失敗 Import failed';
export const RENAME_FLOOR_FAILED_PREFIX = '修改名稱失敗 Rename failed';

export const REPORT_DELETE_OK = '刪除成功 Deleted successfully';
export const FLOOR_NAMES_REQUIRED =
    '請填寫完整的新舊樓層名稱 Enter both old and new floor names';
export const INVALID_ITEM_BARCODE = (code) => `無效的料件條碼 Invalid item barcode: ${code}`;
export const OPS_BOM_MISMATCH =
    '此元件不屬於當前主件的配方 Component is not in the BOM for the selected main item';
export const OPS_STAGED = (code) => `已暫存元件 Stashed component (${code})`;
export const OPS_BOM_SELECTED =
    '主件選取完成，請開始逐一掃描出庫元件 Main item selected — scan each outbound component';
export const OPS_SKIPPED = (barcode) => `已略過元件 Skipped: ${barcode}`;
export const OPS_BOM_OUT_SUCCESS = (main, count) =>
    `主件 ${main} 批次出庫成功 BOM outbound OK — processed ${count} line(s)`;
export const OPS_PRINT_READY = '貼紙列印對話框已開啟 Print sticker dialog opened';
export const OPS_TX_SUCCESS = (inOutLabel, qty) => `${inOutLabel} OK — latest qty: ${qty}`;

export const OPS_CONFIRM_SKIP_COMPONENT = (code) =>
    `確定將元件 ${code} 標記為不需取料？進度將顯示滿額，但本次不出庫、不扣帳也不紀錄該元件。\nMark ${code} as not picked — UI shows complete, no stock deducted?`;
export const OPS_CONFIRM_PARTIAL_BOM =
    '尚有元件數量不足或未掃描，確定要完成出貨並只扣除已掃描數量？\nFinalize with short/unscanned lines — deduct scanned picks only?';
export const OPS_CONFIRM_ZERO_COMPONENT_PICKS =
    '尚未掃描任何出庫元件（扣帳為 0）。確定要結束此主件作業？\nNo picks scanned (0 deducted). Close this BOM job anyway?';

export const OPS_MO_MISMATCH =
    '此材料品號不在當前製令領料清單中 Barcode is not on this manufacturing work order pick list';
export const OPS_MO_SELECTED =
    '製令載入完成，請開始逐一掃描領料 Work order loaded — scan each material to pick';
export const OPS_MO_OUT_SUCCESS = (wo, pickCount, skipCount, fullyPicked) => {
    const parts = [];
    if (pickCount > 0) parts.push(`已扣庫 ${pickCount} 筆`);
    if (skipCount > 0) parts.push(`略過不扣帳 ${skipCount} 筆`);
    const summary = parts.length ? parts.join('、') : '無扣庫／略過筆數';
    const tail = fullyPicked
        ? ' 本製令已全數領畢，將自「庫存查詢」「庫存報表｜製令工單總表」移除（出入庫紀錄仍保留）；若要再領請重新匯入。'
        : '';
    return `製令 ${wo} 領料結案 — ${summary}。${tail} MO outbound OK`.trim();
};
export const OPS_CONFIRM_PARTIAL_MO =
    '尚有材料未領滿或未掃描也未略過，確定結案？將只對已暫存的掃描扣庫，略過項可不扣庫但增加已領用量。\nFinalize short — deduct staged picks only; waived lines add picked qty without stock move?';
export const OPS_CONFIRM_ZERO_MO_PICKS =
    '目前沒有任何「暫存扣庫掃描」，也沒有標記「略過不扣帳」。確定不異動任何資料並關閉此畫面？\nNo staged picks and no waived lines — close without submitting?';

export const OPS_CONFIRM_SKIP_MO_LINE = (barcode) =>
    `確定對 ${barcode}「略過不扣帳」？將寫入略過出庫紀錄（不動即時庫存）、並依剩餘量提高已領用量。\nWaive picking for ${barcode} — no inventory move, picked qty increases?`;

export const IMPORT_SUCCESS = (count) => `成功匯入 ${count} 筆資料 Import succeeded — ${count} row(s)`;
export const RENAME_FLOOR_SUCCESS = (count) =>
    `成功更新 ${count} 個儲位至新樓層 Rename OK — ${count} location(s) on new floor`;
export const IMPORT_INVALID_GRID = '無效的儲位圖資料 Invalid map / grid data';
export const IMPORT_FLOOR_NAME_REQUIRED = '請輸入樓層名稱 Floor name required';

export const STOCK_LOCATION_EMPTY_ZH_EN =
    '此儲位目前無庫存料件 No stock at this bin for any item';

export const MOBILE_IN = '入庫 Inbound';
export const MOBILE_OUT = '出庫 Outbound';
export const CONFIRM_DELETE_USER_ZH_EN = '確定要刪除此使用者？ Delete this user?';
