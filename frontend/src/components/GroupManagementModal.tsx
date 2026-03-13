import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Trash2, Folder, Edit2, Check } from 'lucide-react';
import type { Group } from '../types';
import * as AppService from '../../bindings/jump-forward/app';
import { toast } from 'sonner';

interface Props {
    groups: Group[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function GroupManagementModal({ groups, onClose, onSuccess }: Props) {
    const { t } = useTranslation();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = async () => {
        if (!newName.trim()) return;
        try {
            await AppService.AddGroup(newName.trim());
            setNewName('');
            onSuccess();
            toast.success('Group added');
        } catch (err) {
            toast.error('Failed to add group', { description: String(err) });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await AppService.DeleteGroup(id);
            onSuccess();
            toast.success('Group deleted');
        } catch (err) {
            toast.error('Failed to delete group', { description: String(err) });
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editingName.trim()) return;
        try {
            await AppService.UpdateGroup(id, editingName.trim());
            setEditingId(null);
            onSuccess();
            toast.success('Group updated');
        } catch (err) {
            toast.error('Failed to update group', { description: String(err) });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Folder className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-slate-800">{t('common.group') || 'Group Management'}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
                            placeholder="New Group Name"
                        />
                        <button 
                            onClick={handleAdd}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 text-sm font-bold"
                        >
                            <Plus className="w-4 h-4" />
                            Add
                        </button>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {groups.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                                <Folder className="w-12 h-12 mx-auto mb-2 opacity-10" />
                                <p className="text-sm">No groups yet</p>
                            </div>
                        ) : (
                            groups.map(g => (
                                <div key={g.id} className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                        <Folder className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        {editingId === g.id ? (
                                            <input 
                                                autoFocus
                                                type="text" 
                                                value={editingName} 
                                                onChange={e => setEditingName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleUpdate(g.id)}
                                                onBlur={() => setEditingId(null)}
                                                className="w-full bg-white border border-blue-500 rounded-lg px-2 py-1 text-sm focus:outline-none ring-2 ring-blue-500/20"
                                            />
                                        ) : (
                                            <div className="text-sm font-bold text-slate-700 truncate">{g.name}</div>
                                        )}
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {editingId === g.id ? (
                                            <button 
                                                onClick={() => handleUpdate(g.id)}
                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    onClick={() => {
                                                        setEditingId(g.id);
                                                        setEditingName(g.name);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(g.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
