import { useState, useEffect, useRef } from 'react';
import { submitTransaction, getItemDetails } from '../api';
import { Html5QrcodeScanner, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle, AlertTriangle, Scan, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const MobileScanner = () => {
    const [mode, setMode] = useState('IN'); // IN or OUT
    const [step, setStep] = useState(1); // 1: Scan Item, 2: Scan Location, 3: Quantity
    const [barcode, setBarcode] = useState('');
    const [locationCode, setLocationCode] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [itemInfo, setItemInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [isScanning, setIsScanning] = useState(false);

    const scannerRef = useRef(null);

    useEffect(() => {
        // Initialize Scanner when step is 1 or 2
        if ((step === 1 || step === 2) && !isScanning) {
            startScanner();
        } else if (step === 3 && isScanning) {
            stopScanner();
        }

        return () => {
            if (scannerRef.current) stopScanner();
        };
    }, [step]);

    useEffect(() => {
        if (barcode && step === 1) {
            fetchItemInfoAndProceed(barcode);
        }
    }, [barcode]);

    const startScanner = () => {
        if (scannerRef.current) return;

        setIsScanning(true);
        setTimeout(() => {
            try {
                if (!document.getElementById("reader") || (step !== 1 && step !== 2)) return;

                const scanner = new Html5QrcodeScanner(
                    "reader",
                    {
                        fps: 20,
                        qrbox: { width: 300, height: 150 },
                        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                    },
                    false
                );

                scanner.render((decodedText) => {
                    handleScanSuccess(decodedText);
                }, (errorMessage) => {
                    // Ignore scan failures
                });

                scannerRef.current = scanner;
            } catch (err) {
                console.error("啟動相機失敗:", err);
            }
        }, 300);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(e => console.error(e));
            scannerRef.current = null;
        }
        setIsScanning(false);
    };

    const handleScanSuccess = (decodedText) => {
        const text = decodedText.trim();
        if (step === 1) {
            setBarcode(text);
            stopScanner();
        } else if (step === 2) {
            setLocationCode(text);
            stopScanner();
            setStep(3); // Proceed to quantity
        }
    };

    const fetchItemInfoAndProceed = async (code) => {
        setLoading(true);
        try {
            const res = await getItemDetails(code);
            setItemInfo(res.data);
            setStep(2); // Proceed to location scan on success
        } catch (e) {
            setMessage({ type: 'error', text: '無效的料件條碼: ' + code });
            setBarcode(''); // reset barcode to scan again
            if (!isScanning) startScanner(); // Restart scanner if stopped
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const token = localStorage.getItem('token');
            const res = await submitTransaction({
                type: mode,
                barcode: barcode,
                location_code: locationCode,
                quantity: parseFloat(quantity)
            }, token);

            setMessage({ type: 'success', text: `成功${mode === 'IN' ? '入庫' : '出庫'}! 最新數量: ${res.data.newQty}` });
            resetFlow();
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || '操作失敗' });
        } finally {
            setLoading(false);
        }
    };

    const resetFlow = () => {
        setStep(1);
        setBarcode('');
        setLocationCode('');
        setQuantity(1);
        setItemInfo(null);
    };

    const handleModeSwitch = (newMode) => {
        if (mode === newMode) return;
        setMode(newMode);
        resetFlow();
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans max-w-md mx-auto relative pb-20">
            {/* Header */}
            <header className="bg-gray-900 border-b border-gray-800 p-4 sticky top-0 z-50 flex justify-between items-center shadow-md">
                <h1 className="text-xl font-bold text-blue-400">📱 手機掃描作業</h1>
                <button onClick={resetFlow} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors">
                    <RefreshCw size={20} className="text-gray-300" />
                </button>
            </header>

            {/* Mode Toggles */}
            <div className="flex p-4 gap-4">
                <button
                    onClick={() => handleModeSwitch('IN')}
                    className={clsx(
                        "flex-1 py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-all shadow-lg active:scale-95",
                        mode === 'IN' ? "bg-blue-600 text-white ring-4 ring-blue-500/50" : "bg-gray-800 text-gray-400 border border-gray-700"
                    )}
                >
                    <ArrowDownToLine size={28} />
                    <span className="text-lg">入庫</span>
                </button>
                <button
                    onClick={() => handleModeSwitch('OUT')}
                    className={clsx(
                        "flex-1 py-4 rounded-2xl font-bold flex flex-col items-center justify-center gap-2 transition-all shadow-lg active:scale-95",
                        mode === 'OUT' ? "bg-orange-600 text-white ring-4 ring-orange-500/50" : "bg-gray-800 text-gray-400 border border-gray-700"
                    )}
                >
                    <ArrowUpFromLine size={28} />
                    <span className="text-lg">出庫</span>
                </button>
            </div>

            {/* Progress/Status Info */}
            <div className="px-4 mb-2">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-2 text-sm shadow-inner">
                    <div
                        className={clsx(
                            "flex justify-between items-center bg-gray-900 p-3 rounded-lg border",
                            step === 1 ? "border-blue-500" : "border-transparent cursor-pointer hover:border-gray-600"
                        )}
                        onClick={() => {
                            if (step > 1) {
                                setStep(1);
                                setBarcode('');
                                setLocationCode('');
                                setItemInfo(null);
                            }
                        }}
                    >
                        <span className="text-gray-500 font-bold">1. 料件</span>
                        <span className="font-mono text-blue-400 font-bold truncate max-w-[200px]">{barcode || '尚未掃描...'}</span>
                    </div>
                    <div
                        className={clsx(
                            "flex justify-between items-center bg-gray-900 p-3 rounded-lg border",
                            step === 2 ? "border-yellow-500" : "border-transparent cursor-pointer hover:border-gray-600"
                        )}
                        onClick={() => {
                            if (step > 2) {
                                setStep(2);
                                setLocationCode('');
                            }
                        }}
                    >
                        <span className="text-gray-500 font-bold">2. 儲位</span>
                        <span className="font-mono text-yellow-400 font-bold">{locationCode || '尚未掃描...'}</span>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 px-4 flex flex-col">
                <AnimatePresence mode="wait">
                    {/* Scanner Step */}
                    {(step === 1 || step === 2) && (
                        <motion.div
                            key="scanner"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl flex-1 flex flex-col"
                        >
                            <div className="p-4 text-center border-b border-gray-700 bg-gray-900/50">
                                <h2 className="text-lg font-bold text-white mb-1">
                                    {step === 1 ? '掃描料件條碼' : '掃描儲位 QR Code'}
                                </h2>
                                <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                                    <Scan size={14} /> 將鏡頭對準條碼
                                </p>
                            </div>

                            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px]">
                                {loading ? (
                                    <div className="text-blue-400 font-bold animate-pulse flex flex-col items-center gap-2">
                                        <RefreshCw className="animate-spin" size={32} />
                                        讀取資料中...
                                    </div>
                                ) : (
                                    <div id="reader" className="w-full h-full object-cover"></div>
                                )}
                            </div>

                            {/* Manual Input Fallback */}
                            <div className="p-4 bg-gray-900 border-t border-gray-700 pt-5">
                                <p className="text-xs text-center text-gray-500 mb-2">無法掃描？手動輸入</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={step === 1 ? "輸入料件條碼..." : "輸入儲位..."}
                                        className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleScanSuccess(e.target.value);
                                        }}
                                        id="manualInput"
                                    />
                                    <button
                                        onClick={() => {
                                            const val = document.getElementById('manualInput').value;
                                            if (val) handleScanSuccess(val);
                                        }}
                                        className="bg-blue-600 text-white px-6 rounded-xl font-bold active:bg-blue-700"
                                    >
                                        確認
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Quantity Step */}
                    {step === 3 && (
                        <motion.div
                            key="quantity"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gray-800 rounded-2xl border border-gray-700 p-6 shadow-2xl space-y-6"
                        >
                            <div className="text-center">
                                <h2 className="text-2xl font-bold mb-2">確認數量</h2>
                                <p className="text-gray-300 text-lg font-bold">{itemInfo?.item?.name}</p>
                            </div>

                            {/* Existing Inventory Display */}
                            {itemInfo?.inventory && itemInfo.inventory.length > 0 && (
                                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700">
                                    <h3 className="text-sm text-gray-400 mb-2 font-bold border-b border-gray-800 pb-2">目前庫存分佈</h3>
                                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                        {itemInfo.inventory.map(inv => (
                                            <div key={inv.id} className="flex justify-between items-center text-sm">
                                                <span className={clsx("font-mono", inv.location_code === locationCode ? "text-yellow-400 font-bold" : "text-gray-400")}>
                                                    {inv.location_code}
                                                </span>
                                                <span className={clsx("font-bold", inv.location_code === locationCode ? "text-blue-400 font-bold" : "text-gray-300")}>
                                                    {inv.quantity} <span className="text-xs font-normal text-gray-500">{itemInfo?.item?.unit}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warning for OUT operation on empty location */}
                            {mode === 'OUT' && itemInfo?.inventory && !itemInfo.inventory.some(inv => inv.location_code === locationCode) && (
                                <div className="bg-red-900/50 text-red-400 p-3 rounded-lg border border-red-800 text-sm flex items-start gap-2">
                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                    <span>警告：目前儲位 <b>{locationCode}</b> 系統上無此料件庫存，若強制出庫可能導致負庫存。</span>
                                </div>
                            )}

                            <div className="flex items-center justify-between bg-gray-900 p-4 rounded-2xl border border-gray-700">
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="w-16 h-16 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-3xl font-bold border border-gray-600 active:scale-95 transition-transform"
                                >
                                    -
                                </button>

                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                    className="w-24 text-center bg-transparent text-4xl font-bold focus:outline-none"
                                />

                                <button
                                    onClick={() => setQuantity(q => q + 1)}
                                    className="w-16 h-16 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center text-3xl font-bold border border-gray-600 active:scale-95 transition-transform"
                                >
                                    +
                                </button>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={clsx(
                                    "w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all text-white",
                                    mode === 'IN' ? "bg-gradient-to-r from-blue-600 to-blue-500" : "bg-gradient-to-r from-orange-600 to-orange-500",
                                    loading ? "opacity-50 cursor-not-allowed" : ""
                                )}
                            >
                                {loading ? <RefreshCw className="animate-spin" size={24} /> : (mode === 'IN' ? '確認入庫' : '確認出庫')}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Notifications */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className={clsx(
                                "fixed bottom-6 left-4 right-4 p-4 rounded-xl flex items-center gap-3 shadow-2xl z-50 backdrop-blur-md",
                                message.type === 'success' ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
                            )}
                        >
                            {message.type === 'success' ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                            <span className="font-bold flex-1">{message.text}</span>
                            <button onClick={() => setMessage(null)} className="p-1 hover:bg-black/20 rounded-full">
                                <X size={20} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MobileScanner;
