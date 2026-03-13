import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Server, Globe, ArrowRight, Info, ChevronDown, Check, Folder } from 'lucide-react';
import type { ForwardConfig, JumpHostConfig, Group } from '../types';
import * as AppService from '../../bindings/jump-forward/app';
import * as Models from '../../bindings/jump-forward/models';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Props {
    editConfig?: ForwardConfig;
    jumpHosts: JumpHostConfig[];
    groups: Group[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddForwardModal({ editConfig, jumpHosts, groups, onClose, onSuccess }: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState(editConfig?.name || '');
    const [groupId, setGroupId] = useState(editConfig?.groupId || '');
    const [localPort, setLocalPort] = useState(editConfig?.localPort.toString() || '');
    const [remoteHost, setRemoteHost] = useState(editConfig?.remoteHost || '');
    const [remotePort, setRemotePort] = useState(editConfig?.remotePort.toString() || '');
    const [jumpHostId, setJumpHostId] = useState(editConfig?.jumpHostId || '');
    const [loading, setLoading] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const groupDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
                setIsGroupDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedJumpHost = jumpHosts.find(jh => jh.id === jumpHostId);
    const selectedGroup = groups.find(g => g.id === groupId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config = new Models.ForwardConfig({
                id: editConfig?.id || '',
                name,
                groupId,
                localPort: parseInt(localPort),
                remoteHost,
                remotePort: parseInt(remotePort),
                jumpHostId,
                status: editConfig?.status || 'stopped',
                connections: editConfig?.connections || [],
            });

            if (editConfig?.id) {
                await AppService.UpdateForward(config);
            } else {
                await AppService.AddForward(config);
            }
            onSuccess();
        } catch (err) {
            console.error(err);
            toast.error(`Failed to ${editConfig?.id ? 'update' : 'add'} forward`, { description: String(err) });
        } finally {
            setLoading(false);
        }
    };

    const isEdit = !!editConfig?.id;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Globe className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900">{isEdit ? t('forwards.editTitle') : t('forwards.addTitle')}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.name')}</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="My Web Service"
                                required 
                            />
                            <div className="relative min-w-[160px]" ref={groupDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                                    className={cn(
                                        "w-full flex items-center justify-between bg-slate-50 border rounded-xl px-3 py-2.5 text-sm transition-all text-left",
                                        isGroupDropdownOpen ? "ring-2 ring-blue-500/20 border-blue-500 bg-white" : "border-slate-200 hover:border-slate-300"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate text-slate-600">
                                        <Folder className={cn("w-4 h-4 shrink-0", selectedGroup ? "text-blue-500" : "text-slate-400")} />
                                        <span className="truncate">
                                            {selectedGroup ? selectedGroup.name : t('common.group') || 'Group'}
                                        </span>
                                    </div>
                                    <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform duration-200", isGroupDropdownOpen && "rotate-180")} />
                                </button>

                                {isGroupDropdownOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-[70] animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setGroupId('');
                                                    setIsGroupDropdownOpen(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-sm",
                                                    groupId === '' ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                                                )}
                                            >
                                                <Folder className="w-3.5 h-3.5 opacity-40" />
                                                <span className="flex-1 truncate">None</span>
                                                {groupId === '' && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                            {groups.map(g => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setGroupId(g.id);
                                                        setIsGroupDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left text-sm",
                                                        groupId === g.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                                                    )}
                                                >
                                                    <Folder className="w-3.5 h-3.5 text-blue-400" />
                                                    <span className="flex-1 truncate font-medium">{g.name}</span>
                                                    {groupId === g.id && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.jumpHost')}</label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => jumpHosts.length > 0 && setIsDropdownOpen(!isDropdownOpen)}
                                className={cn(
                                    "w-full flex items-center justify-between bg-slate-50 border rounded-xl px-4 py-2.5 text-sm transition-all text-left",
                                    isDropdownOpen ? "ring-2 ring-blue-500/20 border-blue-500 bg-white" : "border-slate-200 hover:border-slate-300",
                                    jumpHosts.length === 0 && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <Server className={cn("w-4 h-4 shrink-0", selectedJumpHost ? "text-blue-500" : "text-slate-400")} />
                                    <span className={cn("truncate", !selectedJumpHost && "text-slate-400")}>
                                        {selectedJumpHost 
                                            ? `${selectedJumpHost.name} (${selectedJumpHost.host})` 
                                            : jumpHosts.length === 0 ? t('jumpHosts.noHosts') : t('common.search')}
                                    </span>
                                </div>
                                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-200", isDropdownOpen && "rotate-180")} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                        {jumpHosts.map(jh => {
                                            const isSelected = jh.id === jumpHostId;
                                            return (
                                                <button
                                                    key={jh.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setJumpHostId(jh.id);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group",
                                                        isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500"
                                                    )}>
                                                        <Server className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold truncate">{jh.name}</div>
                                                        <div className="text-[10px] opacity-60 truncate font-mono">{jh.user}@{jh.host}:{jh.port}</div>
                                                    </div>
                                                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {jumpHosts.length === 0 && (
                            <p className="mt-2 text-xs text-amber-600 flex items-center gap-1.5 px-1">
                                <Info className="w-3.5 h-3.5" />
                                {t('jumpHosts.noHostsDesc')}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.localPort')}</label>
                            <input 
                                type="number" 
                                value={localPort} 
                                onChange={e => setLocalPort(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="8080" 
                                required 
                            />
                        </div>
                        <div className="flex items-end pb-3 justify-center">
                            <ArrowRight className="text-slate-300" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.remoteHost')}</label>
                            <input 
                                type="text" 
                                value={remoteHost} 
                                onChange={e => setRemoteHost(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="127.0.0.1" 
                                required 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('common.port')}</label>
                            <input 
                                type="number" 
                                value={remotePort} 
                                onChange={e => setRemotePort(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                                placeholder="80" 
                                required 
                            />
                        </div>
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
                            disabled={loading || jumpHosts.length === 0} 
                            className="flex-[2] px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
                        >
                            {loading ? t('common.loading') : (isEdit ? t('common.save') : t('common.add'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
