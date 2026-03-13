import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Terminal, Copy, Check, ExternalLink, Download, Loader2 } from 'lucide-react';
import { Browser, Events } from '@wailsio/runtime';
import * as AppService from '../../bindings/jump-forward/app';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Props {
    releaseUrl: string;
    onClose: () => void;
}

export default function UpdateHelpModal({ releaseUrl, onClose }: Props) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateLogs, setUpdateLogs] = useState<{ message: string; isError: boolean }[]>([]);
    const logEndRef = useRef<HTMLDivElement>(null);
    const installCmd = "curl -fsSL https://raw.githubusercontent.com/xyz327/jump-forward/main/scripts/install.sh | bash";

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unlog = Events.On("update-log", (event: any) => {
            console.log("Update log received:", event);
            const data = event?.data || event?.Data || event;
            if (data && typeof data === 'object' && 'message' in data) {
                setUpdateLogs(prev => [...prev, data as { message: string; isError: boolean }]);
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const unfinish = Events.On("update-finished", (event: any) => {
            console.log("Update finished received:", event);
            const data = event?.data || event?.Data || event;
            setIsUpdating(false);
            if (data && typeof data === 'object') {
                if (data.success) {
                    setUpdateLogs(prev => [...prev, { message: "\n✅ Update finished successfully!\n", isError: false }]);
                } else {
                    setUpdateLogs(prev => [...prev, { message: `\n❌ Update failed: ${data.error}\n`, isError: true }]);
                }
            }
        });

        return () => {
            unlog();
            unfinish();
        };
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [updateLogs]);

    const handleCopy = () => {
        navigator.clipboard.writeText(installCmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUpdateNow = async () => {
        setIsUpdating(true);
        setUpdateLogs([{ message: "🚀 Starting update process...\n", isError: false }]);
        try {
            await AppService.PerformUpdateWithLogs();
        } catch (err) {
            console.error("Update failed", err);
            setUpdateLogs(prev => [...prev, { message: `\n❌ Error starting update: ${err}\n`, isError: true }]);
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Terminal className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{t('notifications.updateAvailable')}</h2>
                    </div>
                    <button onClick={onClose} disabled={isUpdating} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        {t('notifications.updateInstructions')}
                    </p>
                    
                    {!isUpdating && updateLogs.length === 0 ? (
                        <div className="relative">
                            <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-x-auto custom-scrollbar border border-slate-800 whitespace-pre-wrap break-all">
                                {installCmd}
                            </pre>
                            <button 
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all backdrop-blur-sm"
                                title={t('common.copy')}
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 h-48 overflow-y-auto custom-scrollbar font-mono text-[10px]">
                            {updateLogs.map((log, i) => (
                                <span key={i} className={cn(log.isError ? "text-rose-400" : "text-emerald-400", "whitespace-pre-wrap")}>
                                    {log.message}
                                </span>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    )}

                    <div className="space-y-3">
                        <button 
                            type="button" 
                            disabled={isUpdating}
                            onClick={handleUpdateNow}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isUpdating ? t('common.loading') : t('notifications.updateNow')}
                        </button>

                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                disabled={isUpdating}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                {t('common.close')}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => Browser.OpenURL(releaseUrl)}
                                disabled={isUpdating}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                            >
                                <ExternalLink className="w-4 h-4" />
                                {t('notifications.viewRelease')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
