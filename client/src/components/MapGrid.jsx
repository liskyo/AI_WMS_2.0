import React, { useEffect, useState, useMemo } from 'react';
import { getLocations } from '../api';
import clsx from 'clsx';
import { motion } from 'framer-motion';

const MapGrid = ({ highlights = null, activeFloor = null }) => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await getLocations();
            if (Array.isArray(res.data)) {
                setLocations(res.data);
            } else {
                console.error('Invalid locations data:', res.data);
                setLocations([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Filter by activeFloor if provided
    const filteredLocations = useMemo(() => {
        if (!activeFloor) return locations;
        return locations.filter(l => l.floor === activeFloor);
    }, [locations, activeFloor]);

    // Determine grid dimensions
    const dims = useMemo(() => {
        if (!Array.isArray(filteredLocations) || filteredLocations.length === 0) return { maxX: 0, maxY: 0 };
        const maxX = Math.max(...filteredLocations.map(l => l.x)) + 1;
        const maxY = Math.max(...filteredLocations.map(l => l.y)) + 1;
        return { maxX, maxY };
    }, [filteredLocations]);

    // Map locations to grid [y][x]
    const grid = useMemo(() => {
        const g = Array.from({ length: dims.maxY }, () => Array(dims.maxX).fill(null));
        filteredLocations.forEach(loc => {
            if (g[loc.y] && g[loc.y][loc.x] !== undefined) {
                g[loc.y][loc.x] = loc;

                // Parse spans for visual elements
                let rawCode = loc.code;
                if (rawCode) {
                    rawCode = rawCode.replace(/_F:.*$/, '');
                }

                if (rawCode && rawCode.startsWith('#V_#')) {
                    const parts = rawCode.replace('#V_#', '').split('_');
                    const spanX = parseInt(parts[3]) || 1;
                    const spanY = parseInt(parts[4]) || 1;

                    if (spanX > 1 || spanY > 1) {
                        for (let i = 0; i < spanY; i++) {
                            for (let j = 0; j < spanX; j++) {
                                if (i === 0 && j === 0) continue;
                                if (loc.y + i < dims.maxY && loc.x + j < dims.maxX) {
                                    g[loc.y + i][loc.x + j] = { type: 'COVERED' };
                                }
                            }
                        }
                    }
                }
            }
        });
        return g;
    }, [filteredLocations, dims]);

    if (loading) return <div className="text-white">Loading Map...</div>;

    return (
        <div className="overflow-auto bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
            <div
                className="grid gap-2"
                style={{
                    gridTemplateColumns: `repeat(${dims.maxX}, minmax(40px, 1fr))`,
                }}
            >
                {grid.map((row, y) => (
                    <React.Fragment key={y}>
                        {/* Grid Cells */}
                        {row.map((loc, x) => {
                            if (!loc) {
                                return <div key={`${x}-${y}`} className="w-full h-12 bg-transparent" />;
                            }
                            if (loc.type === 'COVERED') return null; // skip rendering, handled by the spanning root

                            // Check Highlighting
                            let isHighlighted = false;
                            let highlightQty = 0;
                            let highlightComponents = null;

                            if (highlights && loc.code) {
                                const match = highlights.find(h => h.location_code === loc.code);
                                if (match) {
                                    isHighlighted = true;
                                    highlightQty = match.quantity;
                                    highlightComponents = match.components;
                                }
                            }
                            let displayCode = loc.code || "";
                            let spanX = 1;
                            let spanY = 1;

                            if (displayCode.startsWith('#V_#')) {
                                const parts = displayCode.replace('#V_#', '').split('_');
                                displayCode = parts[0];
                                spanX = parseInt(parts[3]) || 1;
                                spanY = parseInt(parts[4]) || 1;
                            }
                            // Remove floor suffix if it was added by backend for uniqueness
                            displayCode = displayCode.replace(/_F:.*$/, '');

                            const normalizedCode = displayCode.replace(/^#/, '');

                            const hasStock = loc.total_quantity > 0;
                            const isGate = normalizedCode === '大門';
                            const isPillar = normalizedCode === '柱';
                            const isLabel = /^(走道.*|.*儲位圖|[A-Z])$/.test(normalizedCode.trim());

                            // Visual Logic
                            let containerClass = "bg-gray-700/50 border border-gray-600 text-gray-500 hover:bg-gray-700"; // Default Empty
                            let customStyle = {
                                gridColumn: spanX > 1 ? `span ${spanX}` : undefined,
                                gridRow: spanY > 1 ? `span ${spanY}` : undefined,
                                minHeight: spanY > 1 ? '100%' : undefined
                            };
                            let textContent = normalizedCode;
                            let showTooltip = true;

                            if (isGate) {
                                containerClass = "bg-yellow-400 border border-yellow-500 text-black font-extrabold text-sm md:text-base cursor-default z-10 flex items-center justify-center whitespace-nowrap";
                                textContent = normalizedCode;
                                showTooltip = false;
                            } else if (isPillar) {
                                containerClass = "bg-slate-700 border border-slate-600 text-slate-300 font-bold text-sm cursor-not-allowed opacity-80 z-10 flex items-center justify-center whitespace-nowrap";
                                customStyle.backgroundImage = "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.15) 5px, rgba(0,0,0,0.15) 10px)";
                                textContent = normalizedCode;
                                showTooltip = false;
                            } else if (isLabel) {
                                containerClass = "bg-transparent text-gray-200 font-extrabold text-lg md:text-xl border-none shadow-none cursor-default overflow-visible whitespace-nowrap z-20 pointer-events-none flex items-center justify-center w-full";
                                textContent = normalizedCode;
                                showTooltip = false;
                            } else if (isHighlighted) {
                                // Red Highlight Mode overrides everything
                                containerClass = "bg-red-500/20 border-2 border-red-500 text-red-500 hover:bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                            } else if (highlights && !isHighlighted) {
                                // Dim others when searching
                                containerClass = hasStock
                                    ? "bg-green-900/10 border border-green-900/30 text-green-900/50"
                                    : "bg-gray-800/30 border border-gray-800 text-gray-800";
                            } else if (hasStock) {
                                // Normal Stock Mode
                                containerClass = "bg-green-600/20 border border-green-500 text-green-400 hover:bg-green-600/40";
                            }

                            return (
                                <motion.div
                                    key={loc.id}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={clsx(
                                        "rounded-md flex flex-col items-center justify-center text-[10px] sm:text-[11px] font-mono cursor-pointer transition-all duration-300 relative group",
                                        isGate ? "h-full" : "h-12",
                                        containerClass
                                    )}
                                    style={customStyle}
                                    title={showTooltip ? `${displayCode} \nQty: ${hasStock ? loc.total_quantity : 0}` : ''}
                                >
                                    <span className={clsx(
                                        "font-bold w-full text-center px-0.5",
                                        isGate || isLabel ? "" : "whitespace-nowrap overflow-hidden text-ellipsis"
                                    )}>{textContent}</span>

                                    {/* Small Quantity Badge if normal location has stock */}
                                    {!isGate && !isPillar && !isLabel && (hasStock || isHighlighted) && (
                                        <span className={clsx(
                                            "absolute bottom-0 right-1 text-[8px] sm:text-[9px] font-bold z-10",
                                            isHighlighted ? "text-red-300" : "text-green-300"
                                        )}>
                                            x{isHighlighted ? highlightQty : loc.total_quantity}
                                        </span>
                                    )}

                                    {/* Red Dot if Highlighted */}
                                    {isHighlighted && showTooltip && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                                        </span>
                                    )}

                                    {/* Green Dot for Normal Stock (only if not searching mode) */}
                                    {!highlights && hasStock && showTooltip && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                        </span>
                                    )}

                                    {showTooltip && (
                                        <div className="absolute opacity-0 group-hover:opacity-100 bg-black/90 text-white text-xs p-2 rounded -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 pointer-events-none shadow-xl border border-gray-600">
                                            <div className="font-bold border-b border-gray-600 pb-1 mb-1 text-yellow-400">{displayCode}</div>
                                            {isHighlighted ? (
                                                highlightComponents ? (
                                                    <div className="text-left space-y-1">
                                                        <div className="text-xs text-yellow-500 mb-1 border-b border-gray-600 pb-1 font-bold">配方需求元件</div>
                                                        {highlightComponents.map((comp, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <span className="text-blue-300 font-mono">{comp.barcode}</span>
                                                                <span className="text-gray-300 max-w-[150px] truncate" title={comp.name}>{comp.name}</span>
                                                                <span className="text-green-400 font-bold ml-auto">庫存 {comp.stock}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <>搜尋數量: <span className="text-red-400 font-bold">{highlightQty}</span></>
                                                )
                                            ) : (
                                                (loc.items && loc.items.length > 0) ? (
                                                    <div className="text-left space-y-1">
                                                        {loc.items.map((item, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <span className="text-blue-300 font-mono">{item.barcode}</span>
                                                                <span className="text-gray-300">{item.name}</span>
                                                                <span className="text-green-400 font-bold ml-auto">x{item.quantity}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <>庫存總量: <span className="text-green-400 font-bold">{loc.total_quantity || 0}</span></>
                                                )
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default MapGrid;
