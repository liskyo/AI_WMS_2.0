import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { TITLE_ZH, TITLE_EN, DETAIL_LINES_ZH_EN, CLOSE_ARIA_LABEL } from '../backendOfflineMessages';

/** 後端離線／代理失敗時顯示，避免誤以為資料消失 */
const BackendStatusBanner = () => {
    const [visible, setVisible] = useState(false);
    const [hint, setHint] = useState('');

    useEffect(() => {
        const onDown = (e) => {
            const h = e.detail?.hint;
            setHint(typeof h === 'string' && h.trim() !== '' ? h : DETAIL_LINES_ZH_EN);
            setVisible(true);
        };
        const onUp = () => {
            setVisible(false);
            setHint('');
        };
        window.addEventListener('wms-backend-unreachable', onDown);
        window.addEventListener('wms-backend-reachable', onUp);
        return () => {
            window.removeEventListener('wms-backend-unreachable', onDown);
            window.removeEventListener('wms-backend-reachable', onUp);
        };
    }, []);

    if (!visible) return null;

    const detailText = hint || DETAIL_LINES_ZH_EN;

    return (
        <div
            className="sticky top-0 z-[100] flex items-start gap-3 px-4 py-3 bg-amber-900/95 border-b border-amber-600 text-amber-50 text-sm shadow-lg"
            role="alert"
        >
            <AlertTriangle className="shrink-0 text-amber-300 mt-0.5" size={22} />
            <div className="flex-1 min-w-0 space-y-1.5">
                <p className="font-bold">
                    <span>{TITLE_ZH}</span>
                    <span className="font-normal block sm:inline sm:before:content-['_—_'] sm:before:opacity-70 text-amber-200/95">
                        {TITLE_EN}
                    </span>
                </p>
                <p className="mt-1 opacity-90 whitespace-pre-wrap leading-relaxed">{detailText}</p>
            </div>
            <button
                type="button"
                onClick={() => setVisible(false)}
                className="shrink-0 p-2 rounded-lg hover:bg-amber-800/80 text-amber-200 self-start"
                aria-label={CLOSE_ARIA_LABEL}
                title={CLOSE_ARIA_LABEL}
            >
                <X size={18} />
            </button>
        </div>
    );
};

export default BackendStatusBanner;
