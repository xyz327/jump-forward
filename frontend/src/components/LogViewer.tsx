import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RefreshCw, Terminal, Download, Trash2, ChevronDown, Clock } from 'lucide-react';
import type { LogEntry } from '../types';
import * as AppService from '../../bindings/jump-forward/app';
import { Events } from '@wailsio/runtime';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
    forwardId: string;
    onClose: () => void;
}

export default function LogViewer({ forwardId, onClose }: Props) {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        const data = await AppService.GetLogs(forwardId);
        setLogs((data as unknown as LogEntry[]) || []);
    };

    useEffect(() => {
        fetchLogs();
        
        const unsubscribe = Events.On(`log:${forwardId}`, (payload) => {
            // Wails v3 events usually deliver data in payload.data or as the payload itself
            const entry = (payload?.data || payload) as LogEntry;
            if (entry && entry.message) {
                setLogs(prev => [...prev, entry]);
            }
        });

        return () => unsubscribe();
    }, [forwardId]);

    useEffect(() => {
        if (autoScroll) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const downloadLogs = () => {
        const text = logs.map(l => `[${new Date(l.timestamp * 1000).toISOString()}] ${l.level.toUpperCase()}: ${l.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `forward-${forwardId}-logs.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-white/10 overflow-hidden">
                {/* Terminal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                        </div>
                        <div className="h-4 w-px bg-white/10 mx-2" />
                        <div className="flex items-center gap-2 text-slate-300">
                            <Terminal className="w-4 h-4" />
                            <span className="text-sm font-mono font-medium tracking-tight">connection_logs.sh</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={fetchLogs} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            title={t('common.search')}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={downloadLogs} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            title={t('common.copy')}
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={clearLogs} 
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                            title={t('logs.clear')}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button 
                            onClick={onClose} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Terminal Body */}
                <div 
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-auto p-6 bg-slate-950 font-mono text-[13px] leading-relaxed custom-scrollbar-dark selection:bg-blue-500/30"
                >
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                            <Terminal className="w-12 h-12 opacity-20" />
                            <div className="flex flex-col items-center">
                                <p className="text-sm">{t('logs.noLogs')}</p>
                                <p className="text-xs opacity-50">{t('logs.title')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {logs.map((log, i) => (
                                <div key={i} className="group flex items-start gap-4 hover:bg-white/5 -mx-2 px-2 py-0.5 rounded transition-colors">
                                    <div className="flex items-center gap-2 shrink-0 text-slate-500 min-w-[90px]">
                                        <Clock className="w-3 h-3 opacity-50" />
                                        <span className="text-[11px] tabular-nums">{new Date(log.timestamp * 1000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <span className={cn(
                                            "shrink-0 font-bold uppercase text-[10px] px-1.5 py-0 rounded leading-tight mt-0.5",
                                            log.level === 'error' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        )}>
                                            {t(`common.${log.level}`)}
                                        </span>
                                        <span className={cn(
                                            "break-all whitespace-pre-wrap",
                                            log.level === 'error' ? 'text-rose-300/90' : 'text-slate-300'
                                        )}>
                                            {log.message}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </div>

                {/* Terminal Footer */}
                <div className="px-6 py-3 border-t border-white/5 bg-slate-900 flex justify-between items-center">
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>CONNECTED</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="opacity-50">LINES:</span>
                            <span className="text-slate-300">{logs.length}</span>
                        </div>
                    </div>
                    
                    {!autoScroll && logs.length > 0 && (
                        <button 
                            onClick={() => setAutoScroll(true)}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[11px] font-bold rounded-full hover:bg-blue-500 transition-all animate-bounce"
                        >
                            <ChevronDown className="w-3 h-3" />
                            {t('common.loading')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
