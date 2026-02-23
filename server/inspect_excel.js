const XLSX = require('xlsx');

const filePath = "C:\\Users\\sky.lo\\Desktop\\倉庫出入料系統\\20260210 料架QRcode.xlsx";
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log("Headers:", data[0]);
console.log("First Row:", data[1]);
