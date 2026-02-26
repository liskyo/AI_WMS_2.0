const XLSX = require('xlsx');

const filePath = "C:\\Users\\sky.lo\\Desktop\\智慧倉儲動態管理系統2.0\\input\\儲位圖_1150222 - 複製.xlsx";
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
        if (cell && typeof cell === 'string' && cell.trim() !== '') {
            let code = cell.trim();
            if (/^[A-Za-z]$/.test(code)) {
                console.log(`Found letter ${code} at colIndex=${colIndex}, rowIndex=${rowIndex}`);
            }
        }
    });
});
