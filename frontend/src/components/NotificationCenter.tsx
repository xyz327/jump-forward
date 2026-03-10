import { X, Bell, Info, CheckCircle, AlertCircle, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Notification } from '../types';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
    notifications: Notification[];
    onClose: () => void;
    onClear: () => void;
    onMarkRead: (id: string) => void;
}

export default function NotificationCenter({ notifications, onClose, onClear, onMarkRead }: Props) {
    const { t } = useTranslation();
    const icons = {
        info: <Info className="w-4 h-4 text-blue-500" />,
        success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
        error: <AlertCircle className="w-4 h-4 text-rose-500" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    };

    const bgColors = {
        info: "bg-blue-50/50",
        success: "bg-emerald-50/50",
        error: "bg-rose-50/50",
        warning: "bg-amber-50/50",
    };

    return (
        <div className="absolute right-0 top-14 w-80 max-h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-[100] animate-in slide-in-from-top-2 duration-200">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-bold text-slate-900">{t('common.notifications')}</span>
                    {notifications.filter(n => !n.read).length > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {notifications.filter(n => !n.read).length}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                        <button 
                            onClick={onClear} 
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title={t('common.clearAll')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {notifications.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <Bell className="w-10 h-10 opacity-10" />
                        <p className="text-xs">{t('common.noNotifications')}</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div 
                            key={notif.id} 
                            onClick={() => onMarkRead(notif.id)}
                            className={cn(
                                "p-3 rounded-xl border transition-all cursor-pointer group relative",
                                notif.read ? "bg-white border-slate-100" : cn("border-transparent shadow-sm", bgColors[notif.type])
                            )}
                        >
                            {!notif.read && (
                                <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                            <div className="flex gap-3">
                                <div className="mt-0.5 shrink-0">
                                    {icons[notif.type]}
                                </div>
                                <div className="space-y-1 pr-4">
                                    <h4 className={cn("text-xs font-bold leading-none", notif.read ? "text-slate-700" : "text-slate-900")}>
                                        {notif.title}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 leading-normal">
                                        {notif.message}
                                    </p>
                                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                        <Clock className="w-2.5 h-2.5" />
                                        {new Date(notif.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {notifications.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/30 text-center rounded-b-2xl">
                    <button 
                        onClick={() => notifications.forEach(n => onMarkRead(n.id))}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                    >
                        {t('common.markAllAsRead')}
                    </button>
                </div>
            )}
        </div>
    );
}
