const XLSX = require('xlsx');
const path = require('path');

const headers = ["條碼", "品名", "類別", "描述"];
const data = [
    ["ITEM-101", "無線鍵盤 K1", "電腦週邊", "2.4GHz 無線連接"],
    ["ITEM-102", "藍牙滑鼠 M2", "電腦週邊", "靜音設計"],
    ["ITEM-103", "HDMI 傳輸線 2M", "線材", "4K 60Hz 支援"],
    ["ITEM-104", "USB-C 充電線", "線材", "100W 快充"],
    ["ITEM-105", "網路線 CAT6 5M", "線材", "高速網路"],
    ["ITEM-106", "螢幕支架 (單臂)", "辦公設備", "承重 9KG"],
    ["ITEM-107", "人體工學椅", "辦公設備", "透氣網布"],
    ["ITEM-108", "行動電源 20000mAh", "行動周邊", "雙向快充"],
    ["ITEM-109", "與會者麥克風", "會議設備", "360度收音"],
    ["ITEM-110", "網路攝影機 1080P", "會議設備", "自動對焦"],
    ["ITEM-111", "機械鍵盤 (紅軸)", "電腦週邊", "RGB 背光"],
    ["ITEM-112", "電競耳機", "電腦週邊", "7.1聲道"]
];

const wb = XLSX.utils.book_new();
const wsData = [headers, ...data];
const ws = XLSX.utils.aoa_to_sheet(wsData);

XLSX.utils.book_append_sheet(wb, ws, "ItemMaster");

const outputPath = path.join(__dirname, 'server', 'item_master_import.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Created ${outputPath}`);
