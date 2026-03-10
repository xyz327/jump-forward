import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Lock } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface Props {
    title: string;
    message: string;
    buttonText: string;
    onClose: () => void;
    onSubmit: (password: string) => void;
}

export default function PasswordModal({ title, message, buttonText, onClose, onSubmit }: Props) {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onSubmit(password);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                            <Lock className="w-4 h-4" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-slate-500 leading-relaxed">
                        {message}
                    </p>

                    <div className="relative">
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                            placeholder={t('common.password')}
                            autoFocus
                            required 
                        />
                        <AppLogo className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                    
                    <div className="pt-2 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="flex-[2] px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
                        >
                            {loading ? t('common.loading') : buttonText}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
