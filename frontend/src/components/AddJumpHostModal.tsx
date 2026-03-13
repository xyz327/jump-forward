import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Server, Shield, User, Key, Lock } from 'lucide-react';
import type { JumpHostConfig } from '../types';
import * as AppService from '../../bindings/jump-forward/app';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
    editConfig?: JumpHostConfig;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddJumpHostModal({ editConfig, onClose, onSuccess }: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState(editConfig?.name || '');
    const [host, setHost] = useState(editConfig?.host || '');
    const [port, setPort] = useState(editConfig?.port.toString() || '22');
    const [user, setUser] = useState(editConfig?.user || 'root');
    const [authType, setAuthType] = useState<'password' | 'key'>((editConfig?.authType as 'password' | 'key') || 'password');
    const [password, setPassword] = useState(editConfig?.password || '');
    const [keyPath, setKeyPath] = useState(editConfig?.keyPath || '');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config: JumpHostConfig = {
                id: editConfig?.id || '',
                name,
                host,
                port: parseInt(port),
                user,
                authType,
                password: authType === 'password' ? password : undefined,
                keyPath: authType === 'key' ? keyPath : undefined,
            };

            if (editConfig?.id) {
                await AppService.UpdateJumpHost(config as any);
            } else {
                await AppService.AddJumpHost(config as any);
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(`Failed to ${editConfig?.id ? 'update' : 'add'} jump host`, { description: String(err) });
        } finally {
            setLoading(false);
        }
    };

    const isEdit = !!editConfig?.id;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Server className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{isEdit ? t('jumpHosts.editTitle') : t('jumpHosts.addTitle')}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.name')}</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                            placeholder="e.g. My Bastion Server"
                            required 
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.address')}</label>
                            <input 
                                type="text" 
                                value={host} 
                                onChange={e => setHost(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="bastion.example.com"
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.port')}</label>
                            <input 
                                type="number" 
                                value={port} 
                                onChange={e => setPort(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="22"
                                required 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.username')}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={user} 
                                onChange={e => setUser(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="root"
                                required 
                            />
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t('common.authType')}</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => setAuthType('password')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                                    authType === 'password' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Lock className="w-3.5 h-3.5" />
                                {t('jumpHosts.authPassword')}
                            </button>
                            <button 
                                type="button"
                                onClick={() => setAuthType('key')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                                    authType === 'key' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Key className="w-3.5 h-3.5" />
                                {t('jumpHosts.authKey')}
                            </button>
                        </div>

                        {authType === 'password' ? (
                            <div className="relative animate-in slide-in-from-top-2 duration-200">
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                    placeholder={t('common.password')}
                                    required 
                                />
                                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        ) : (
                            <div className="relative animate-in slide-in-from-top-2 duration-200">
                                <input 
                                    type="text" 
                                    value={keyPath} 
                                    onChange={e => setKeyPath(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                    placeholder={t('jumpHosts.keyPath')}
                                    required 
                                />
                                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading} 
                            className="flex-[2] px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                        >
                            {loading ? t('common.loading') : (isEdit ? t('common.save') : t('common.add'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
