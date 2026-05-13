const HAN_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/**
 * Bilingual user-facing API error strings: 「中文 English」
 * @param {string} zh
 * @param {string} en
 */
function bi(zh, en) {
  let a = (zh ?? '').trim();
  const b = (en ?? '').trim();
  if (!a && !b) return '';
  if (!a) return bi('發生錯誤', b);
  if (!b) return a;
  return `${a} ${b}`;
}

/** Raw DB/Node errors are often English-only — never return those alone to the UI. */
function userFacingCatch(detail) {
  const d = String(detail ?? '').trim();
  if (!d) return bi('發生錯誤', 'Unknown error');
  if (HAN_RE.test(d)) return d;
  const truncated = d.length > 800 ? `${d.slice(0, 800)}…` : d;
  return bi('發生錯誤', truncated);
}

module.exports = { bi, userFacingCatch };
