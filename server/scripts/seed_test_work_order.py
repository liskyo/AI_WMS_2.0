"""One-off: insert a test work order with 3 material lines (for QA)."""
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "warehouse.db"

WO = "WO-TEST-3LINE-20260214"
OPEN_DATE = "2026-02-14"
LINES = [
    ("101010000001", "測試料 A (FLH320 Quartz Cylinder)", 10.0, 0.0),
    ("101010000002", "測試料 B (FLH321 Quartz Cylinder)", 5.0, 0.0),
    ("101010000003", "測試料 C (FLH320)", 2.0, 0.0),
]


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("DELETE FROM work_order_lines WHERE work_order_no = ?", (WO,))
    for barcode, name, req, picked in LINES:
        cur.execute(
            """
            INSERT INTO work_order_lines
              (work_order_no, open_date, material_barcode, material_name, required_qty, picked_qty)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (WO, OPEN_DATE, barcode, name, req, picked),
        )
    conn.commit()
    conn.close()
    print(f"OK: imported work order {WO} with {len(LINES)} lines into {DB}")


if __name__ == "__main__":
    main()
