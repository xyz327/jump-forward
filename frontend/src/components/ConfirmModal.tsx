import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onClose: () => void;
    onConfirm: () => void;
}

export default function ConfirmModal({ 
    title, 
    message, 
    confirmText, 
    cancelText, 
    type = 'danger',
    onClose, 
    onConfirm 
}: Props) {
    const { t } = useTranslation();
    const colors = {
        danger: {
            bg: "bg-rose-100",
            icon: "text-rose-600",
            button: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
        },
        warning: {
            bg: "bg-amber-100",
            icon: "text-amber-600",
            button: "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
        },
        info: {
            bg: "bg-blue-100",
            icon: "text-blue-600",
            button: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        }
    };

    const currentColors = colors[type];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${currentColors.bg} ${currentColors.icon} flex items-center justify-center`}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        {message}
                    </p>
                    
                    <div className="pt-2 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            {cancelText || t('common.cancel')}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-[2] px-4 py-2.5 ${currentColors.button} text-white rounded-xl text-sm font-bold transition-all shadow-lg active:scale-[0.98]`}
                        >
                            {confirmText || t('common.confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
