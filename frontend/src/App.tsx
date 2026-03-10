import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Terminal, Server, Play, Square, Trash2, Cpu, Globe, Key, Search, Bell, Menu, Edit2, Download, Upload, Copy, Languages, RefreshCw, ChevronDown, Check, X as CloseIcon } from 'lucide-react';
import type { ForwardConfig, JumpHostConfig, Notification } from './types';
import * as AppService from '../bindings/jump-forward/app';
import AddForwardModal from './components/AddForwardModal';
import AddJumpHostModal from './components/AddJumpHostModal';
import LogViewer from './components/LogViewer';
import PasswordModal from './components/PasswordModal';
import ConfirmModal from './components/ConfirmModal';
import NotificationCenter from './components/NotificationCenter';
import { Toaster, toast } from 'sonner';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Events } from '@wailsio/runtime';
import { AppLogo } from './components/AppLogo';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function StatusBadge({ status }: { status: ForwardConfig['status'] }) {
    const { t } = useTranslation();
    const variants = {
        running: "bg-emerald-50 text-emerald-700 border-emerald-200",
        stopped: "bg-slate-50 text-slate-600 border-slate-200",
        error: "bg-rose-50 text-rose-700 border-rose-200"
    };

    return (
        <span className={cn(
            "px-2.5 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1.5 w-fit",
            variants[status]
        )}>
            <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                status === 'running' ? "bg-emerald-500 animate-pulse" : 
                status === 'error' ? "bg-rose-500" : "bg-slate-400"
            )} />
            {t(`common.${status}`)}
        </span>
    );
}



function App() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'forwards' | 'jumphosts'>('forwards');
  
  const [forwards, setForwards] = useState<ForwardConfig[]>([]);
  const [jumpHosts, setJumpHosts] = useState<JumpHostConfig[]>([]);
  const [showAddForward, setShowAddForward] = useState(false);
  const [showAddJumpHost, setShowAddJumpHost] = useState(false);
  const [editingForward, setEditingForward] = useState<ForwardConfig | null>(null);
  const [editingJumpHost, setEditingJumpHost] = useState<JumpHostConfig | null>(null);
  const [selectedForwardLogs, setSelectedForwardLogs] = useState<string | null>(null);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'forward' | 'jumphost', name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [failedForwards, setFailedForwards] = useState<Record<string, number>>({}); // id -> countdown
  const [failedJumpHosts, setFailedJumpHosts] = useState<Record<string, number>>({}); // id -> countdown
  const [startingForwards, setStartingForwards] = useState<Set<string>>(new Set());
  const [jumpHostFilter, setJumpHostFilter] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const addNotification = (event: any) => {
    // Wails 3 event data can be in event.data or event.Data depending on emitter
    const rawData = event?.data || event?.Data || event;
    console.log("Raw event received:", event);
    console.log("Extracted data:", rawData);

    if (rawData && typeof rawData === 'object' && rawData.message) {
      const entry: Notification = {
        id: rawData.id || `notif-${Date.now()}`,
        title: rawData.title || 'Notification',
        message: rawData.message,
        type: rawData.type || 'info',
        timestamp: rawData.timestamp || Math.floor(Date.now() / 1000),
        read: false
      };

      setNotifications(prev => [entry, ...prev].slice(0, 50));
      
      // Trigger Toast
      const toastOptions = {
        description: entry.message,
        duration: 5000,
      };

      try {
        switch (entry.type) {
          case 'error':
            toast.error(entry.title, toastOptions);
            break;
          case 'success':
            toast.success(entry.title, toastOptions);
            break;
          case 'warning':
            toast.warning(entry.title, toastOptions);
            break;
          default:
            toast.info(entry.title, toastOptions);
        }
      } catch (err) {
        console.error("Toast failed:", err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = Events.On("notification", addNotification);
    return () => unsubscribe();
  }, []);

  const handleExport = async (password: string) => {
      try {
          await AppService.ExportConfig(password);
          setShowExportPassword(false);
          toast.success(t('notifications.configImported'));
      } catch (err) {
          console.error(err);
          toast.error(t('common.error'), { description: String(err) });
          setShowExportPassword(false);
      }
  };

  const handleImport = async (password: string) => {
      try {
          await AppService.ImportConfig(password);
          setShowImportPassword(false);
          // Success is already handled by backend notify
          fetchForwards();
          fetchJumpHosts();
      } catch (err) {
          console.error(err);
          toast.error(t('common.error'), { description: String(err) });
          setShowImportPassword(false);
      }
  };

  const fetchForwards = async () => {
    try {
        const data = await AppService.GetForwards();
        setForwards((data as unknown as ForwardConfig[]) || []);
    } catch (err) {
      console.error("Failed to fetch forwards:", err);
    }
  };

  const fetchJumpHosts = async () => {
    try {
        const data = await AppService.GetJumpHosts();
        setJumpHosts((data as unknown as JumpHostConfig[]) || []);
    } catch (err) {
      console.error("Failed to fetch jump hosts:", err);
    }
  };

  useEffect(() => {
    fetchForwards();
    fetchJumpHosts();
    
    const interval = setInterval(() => {
        fetchForwards();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle countdown for failed items
  useEffect(() => {
    const timer = setInterval(() => {
        setFailedForwards(prev => {
            const next = { ...prev };
            let changed = false;
            for (const id in next) {
                if (next[id] > 0) {
                    next[id] -= 100; // tick every 100ms
                    changed = true;
                } else {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });

        setFailedJumpHosts(prev => {
            const next = { ...prev };
            let changed = false;
            for (const id in next) {
                if (next[id] > 0) {
                    next[id] -= 100; // tick every 100ms
                    changed = true;
                } else {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleStartForward = async (id: string) => {
    setStartingForwards(prev => new Set(prev).add(id));
    try {
        await AppService.StartForward(id);
        fetchForwards();
    } catch (err) {
        console.error("Start failed", err);
        setFailedForwards(prev => ({ ...prev, [id]: 3000 })); // 3s countdown
        fetchForwards();
    } finally {
        setStartingForwards(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }
  };

  const handleStopForward = async (id: string) => {
    try {
        await AppService.StopForward(id);
        fetchForwards();
    } catch (err) {
        console.error("Stop failed", err);
    }
  };

  const handleDeleteForward = async (id: string) => {
      try {
        await AppService.DeleteForward(id);
        fetchForwards();
      } catch (err) {
          console.error("Delete failed", err);
          toast.error(t('common.error'), { description: String(err) });
      }
  }

  const handleDeleteJumpHost = async (id: string) => {
      try {
          await AppService.DeleteJumpHost(id);
          fetchJumpHosts();
      } catch (err) {
          console.error("Delete failed", err);
          setFailedJumpHosts(prev => ({ ...prev, [id]: 3000 })); // 3s countdown
          fetchJumpHosts();
      }
  }

  const filteredForwards = forwards.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.remoteHost.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesJumpHost = jumpHostFilter.length === 0 || jumpHostFilter.includes(f.jumpHostId);
    return matchesSearch && matchesJumpHost;
  });

  const filteredJumpHosts = jumpHosts.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none">
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out z-20 shadow-xl",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 h-16 shrink-0 border-b border-white/5 overflow-hidden whitespace-nowrap">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <AppLogo className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && <span className="font-bold text-lg tracking-tight">JumpForward</span>}
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('forwards')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group overflow-hidden whitespace-nowrap",
              activeTab === 'forwards' 
                ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Globe className={cn("w-5 h-5 shrink-0 transition-colors", activeTab === 'forwards' ? "text-blue-400" : "group-hover:text-white")} />
            {sidebarOpen && <span className="font-medium text-sm">{t('nav.forwards')}</span>}
          </button>
          
          <button
            onClick={() => setActiveTab('jumphosts')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group overflow-hidden whitespace-nowrap",
              activeTab === 'jumphosts' 
                ? "bg-blue-600/10 text-blue-400 border border-blue-600/20" 
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Server className={cn("w-5 h-5 shrink-0 transition-colors", activeTab === 'jumphosts' ? "text-blue-400" : "group-hover:text-white")} />
            {sidebarOpen && <span className="font-medium text-sm">{t('nav.jumpHosts')}</span>}
          </button>

          <div className="pt-4 pb-2">
              <div className="h-px bg-white/5 mx-3" />
          </div>

          <button
            onClick={() => setShowExportPassword(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group text-slate-400 hover:bg-white/5 hover:text-white overflow-hidden whitespace-nowrap"
          >
            <Download className="w-5 h-5 shrink-0 group-hover:text-white" />
            {sidebarOpen && <span className="font-medium text-sm">{t('common.export')}</span>}
          </button>

          <button
            onClick={() => setShowImportPassword(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group text-slate-400 hover:bg-white/5 hover:text-white overflow-hidden whitespace-nowrap"
          >
            <Upload className="w-5 h-5 shrink-0 group-hover:text-white" />
            {sidebarOpen && <span className="font-medium text-sm">{t('common.import')}</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
            <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-full flex items-center justify-center py-2 text-slate-500 hover:text-white transition-colors"
            >
                {sidebarOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-4 flex-1">
                <div className="relative w-full max-w-md group flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder={t('common.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    {activeTab === 'forwards' && jumpHosts.length > 0 && (
                        <div className="relative min-w-[180px]">
                            <button
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                className={cn(
                                    "w-full flex items-center justify-between bg-slate-50 border rounded-lg px-3 py-2 text-sm transition-all hover:bg-slate-100",
                                    jumpHostFilter.length > 0 ? "border-blue-500 text-blue-600 bg-blue-50/30" : "border-slate-200 text-slate-600"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Server className={cn("w-4 h-4 shrink-0", jumpHostFilter.length > 0 ? "text-blue-500" : "text-slate-400")} />
                                    <span className="truncate">
                                        {jumpHostFilter.length === 0 
                                            ? `${t('common.jumpHost')} (All)` 
                                            : jumpHostFilter.length === 1 
                                                ? jumpHosts.find(jh => jh.id === jumpHostFilter[0])?.name 
                                                : `${jumpHostFilter.length} ${t('nav.jumpHosts')}`}
                                    </span>
                                </div>
                                <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform duration-200", showFilterDropdown && "rotate-180")} />
                            </button>

                            {showFilterDropdown && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('common.jumpHost')}</span>
                                            {jumpHostFilter.length > 0 && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setJumpHostFilter([]);
                                                    }}
                                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                                                >
                                                    {t('common.clearAll')}
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
                                            {jumpHosts.map(jh => {
                                                const isSelected = jumpHostFilter.includes(jh.id);
                                                return (
                                                    <button
                                                        key={jh.id}
                                                        onClick={() => {
                                                            setJumpHostFilter(prev => 
                                                                isSelected 
                                                                    ? prev.filter(id => id !== jh.id)
                                                                    : [...prev, jh.id]
                                                            );
                                                        }}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left",
                                                            isSelected ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                                            isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                                                        )}>
                                                            {isSelected && <Plus className="w-3 h-3 rotate-45" />}
                                                        </div>
                                                        <div className="flex-1 truncate">
                                                            <div className="text-sm font-medium truncate">{jh.name}</div>
                                                            <div className="text-[10px] opacity-60 truncate">{jh.host}</div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 ml-4">
                <div className="relative">
                    <button 
                        onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                            showLanguageDropdown ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        )}
                        title={t('nav.settings')}
                    >
                        <Languages className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase">{i18n.language === 'zh' ? '中文' : 'EN'}</span>
                        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", showLanguageDropdown && "rotate-180")} />
                    </button>

                    {showLanguageDropdown && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowLanguageDropdown(false)} />
                            <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                                <button
                                    onClick={() => {
                                        i18n.changeLanguage('zh');
                                        setShowLanguageDropdown(false);
                                        toast.success('已切换至中文');
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                        i18n.language === 'zh' ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <span>中文</span>
                                    {i18n.language === 'zh' && <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                    onClick={() => {
                                        i18n.changeLanguage('en');
                                        setShowLanguageDropdown(false);
                                        toast.success('Switched to English');
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                        i18n.language === 'en' ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-600"
                                    )}
                                >
                                    <span>English</span>
                                    {i18n.language === 'en' && <Check className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={cn(
                            "p-2 rounded-lg transition-all relative",
                            showNotifications ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        <Bell className="w-5 h-5" />
                        {notifications.some(n => !n.read) && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                        )}
                    </button>
                    {showNotifications && (
                        <NotificationCenter 
                            notifications={notifications}
                            onClose={() => setShowNotifications(false)}
                            onClear={() => setNotifications([])}
                            onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                        />
                    )}
                </div>
                <div className="h-6 w-px bg-slate-200 mx-1" />
                <button
                    onClick={() => activeTab === 'forwards' ? setShowAddForward(true) : setShowAddJumpHost(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
                >
                    <Plus className="w-4 h-4" />
                    <span>{t('common.add')} {activeTab === 'forwards' ? t('nav.forwards') : t('nav.jumpHosts')}</span>
                </button>
            </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {activeTab === 'forwards' ? t('forwards.title') : t('jumpHosts.title')}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {activeTab === 'forwards' 
                            ? t('forwards.title')
                            : t('jumpHosts.title')}
                    </p>
                </div>

                {activeTab === 'forwards' ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {filteredForwards.map(fwd => {
                            const jh = jumpHosts.find(j => j.id === fwd.jumpHostId);
                            const failureTime = failedForwards[fwd.id];
                            return (
                                <div 
                                    key={fwd.id} 
                                    className={cn(
                                        "bg-white rounded-xl border p-5 hover:shadow-md transition-all group relative overflow-hidden",
                                        failureTime ? "border-rose-500 shadow-lg shadow-rose-500/10 scale-[1.02]" : 
                                        fwd.status === 'running' ? "border-emerald-500 shadow-lg shadow-emerald-500/10" :
                                        "border-slate-200 hover:border-blue-300"
                                    )}
                                >
                                    {/* Countdown Progress Bar */}
                                    {failureTime !== undefined && (
                                        <div 
                                            className="absolute bottom-0 left-0 h-1 bg-rose-500 transition-all duration-100 ease-linear"
                                            style={{ width: `${(failureTime / 3000) * 100}%` }}
                                        />
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                fwd.status === 'running' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                                            )}>
                                                <Globe className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 leading-none mb-1">{fwd.name}</h3>
                                                <StatusBadge status={fwd.status} />
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {fwd.status === 'running' ? (
                                                <button onClick={() => handleStopForward(fwd.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title={t('forwards.stop')}>
                                                    <Square className="w-4 h-4 fill-current" />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleStartForward(fwd.id)} 
                                                    className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50" 
                                                    title={t('forwards.start')}
                                                    disabled={startingForwards.has(fwd.id)}
                                                >
                                                    {startingForwards.has(fwd.id) ? (
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Play className="w-4 h-4 fill-current" />
                                                    )}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setEditingForward(fwd)} 
                                                className={cn(
                                                    "p-2 rounded-lg transition-colors",
                                                    fwd.status === 'running' || startingForwards.has(fwd.id)
                                                        ? "text-slate-300 cursor-not-allowed" 
                                                        : "text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                                )}
                                                disabled={fwd.status === 'running' || startingForwards.has(fwd.id)}
                                                title={fwd.status === 'running' ? t('forwards.logs') : t('common.edit')}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => setEditingForward({ ...fwd, id: '', name: fwd.name + ' (Copy)', status: 'stopped' })} 
                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                title={t('common.copy')}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setSelectedForwardLogs(fwd.id)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title={t('forwards.logs')}>
                                                <Terminal className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setConfirmDelete({ id: fwd.id, type: 'forward', name: fwd.name })} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title={t('common.delete')}>
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-500">{t('common.localPort')}</span>
                                            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">127.0.0.1:{fwd.localPort}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-500">{t('common.remoteHost')}</span>
                                            <span className="font-medium text-slate-700">{fwd.remoteHost}:{fwd.remotePort}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                            <span className="text-slate-500">{t('common.jumpHost')}</span>
                                            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                                                {jh?.name || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {fwd.status === 'running' && fwd.connections && fwd.connections.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('common.activeConnections')}</span>
                                                <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{fwd.connections.length}</span>
                                            </div>
                                            <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                                {fwd.connections.map(conn => (
                                                    <div key={conn.id} className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50/50 px-2 py-1 rounded group/conn hover:bg-slate-100 transition-colors">
                                                        <span className="font-mono">{conn.srcAddr}</span>
                                                        <span className="text-slate-400">{new Date(conn.startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredForwards.length === 0 && (
                            <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Globe className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">{t('forwards.noForwards')}</h3>
                                <p className="text-slate-500 max-w-xs mt-1">{t('forwards.noForwardsDesc')}</p>
                                <button
                                    onClick={() => setShowAddForward(true)}
                                    className="mt-6 text-blue-600 font-bold hover:text-blue-700"
                                >
                                    {t('forwards.addFirst')}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
                        {filteredJumpHosts.map(host => {
                            const failureTime = failedJumpHosts[host.id];
                            return (
                                <div 
                                    key={host.id} 
                                    className={cn(
                                        "bg-white rounded-xl border p-5 hover:shadow-md transition-all group relative overflow-hidden",
                                        failureTime ? "border-rose-500 shadow-lg shadow-rose-500/10 scale-[1.02]" : "border-slate-200 hover:border-blue-300"
                                    )}
                                >
                                    {/* Countdown Progress Bar */}
                                    {failureTime !== undefined && (
                                        <div 
                                            className="absolute bottom-0 left-0 h-1 bg-rose-500 transition-all duration-100 ease-linear"
                                            style={{ width: `${(failureTime / 3000) * 100}%` }}
                                        />
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <Server className="w-5 h-5" />
                                            </div>
                                            <div>
                                            <h3 className="font-bold text-slate-900 leading-none mb-1">{host.name}</h3>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                <Key className="w-3.5 h-3.5" />
                                                <span className="capitalize">{host.authType === 'password' ? t('jumpHosts.authPassword') : t('jumpHosts.authKey')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setEditingJumpHost(host)} className="text-slate-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors" title={t('common.edit')}>
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setEditingJumpHost({ ...host, id: '', name: host.name + ' (Copy)' })} className="text-slate-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors" title={t('common.copy')}>
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setConfirmDelete({ id: host.id, type: 'jumphost', name: host.name })} className="text-slate-400 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-colors" title={t('common.delete')}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                        <span className="text-slate-500">{t('common.address')}</span>
                                        <span className="font-medium text-slate-700">{host.host}:{host.port}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-lg">
                                        <span className="text-slate-500">{t('common.username')}</span>
                                        <span className="font-bold text-slate-700">{host.user}</span>
                                    </div>
                                </div>
                                </div>
                            );
                        })}
                        {filteredJumpHosts.length === 0 && (
                            <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Server className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">{t('jumpHosts.noHosts')}</h3>
                                <p className="text-slate-500 max-w-xs mt-1">{t('jumpHosts.noHostsDesc')}</p>
                                <button
                                    onClick={() => setShowAddJumpHost(true)}
                                    className="mt-6 text-blue-600 font-bold hover:text-blue-700"
                                >
                                    {t('jumpHosts.addFirst')}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
      </div>

      {(showAddForward || editingForward) && (
          <AddForwardModal 
            editConfig={editingForward || undefined}
            jumpHosts={jumpHosts} 
            onClose={() => { setShowAddForward(false); setEditingForward(null); }} 
            onSuccess={() => { setShowAddForward(false); setEditingForward(null); fetchForwards(); }} 
          />
      )}

      {(showAddJumpHost || editingJumpHost) && (
          <AddJumpHostModal 
            editConfig={editingJumpHost || undefined}
            onClose={() => { setShowAddJumpHost(false); setEditingJumpHost(null); }} 
            onSuccess={() => { setShowAddJumpHost(false); setEditingJumpHost(null); fetchJumpHosts(); }} 
          />
      )}

      {selectedForwardLogs && (
          <LogViewer 
            forwardId={selectedForwardLogs} 
            onClose={() => setSelectedForwardLogs(null)} 
          />
      )}

      {showExportPassword && (
          <PasswordModal 
            title={t('common.export')}
            message={t('common.export')}
            buttonText={t('common.export')}
            onClose={() => setShowExportPassword(false)}
            onSubmit={handleExport}
          />
      )}

      {showImportPassword && (
          <PasswordModal 
            title={t('common.import')}
            message={t('common.import')}
            buttonText={t('common.import')}
            onClose={() => setShowImportPassword(false)}
            onSubmit={handleImport}
          />
      )}

      {confirmDelete && (
          <ConfirmModal 
            title={t('confirm.deleteTitle', { type: confirmDelete.type === 'forward' ? t('nav.forwards') : t('nav.jumpHosts') })}
            message={t('confirm.deleteMsg', { name: confirmDelete.name })}
            confirmText={t('common.delete')}
            onClose={() => setConfirmDelete(null)}
            onConfirm={() => {
                if (confirmDelete.type === 'forward') {
                    handleDeleteForward(confirmDelete.id);
                } else {
                    handleDeleteJumpHost(confirmDelete.id);
                }
            }}
          />
      )}

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

export default App;
