/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Building2,
  Cloud,
  CloudOff,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Settings as SettingsIcon,
} from 'lucide-react';
import { AuthView } from './components/AuthView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { BastFormView } from './components/BastFormView';
import { CompaniesView } from './components/CompaniesView';
import { DashboardAndBastListView } from './components/DashboardAndBastListView';
import { ExcelImportView } from './components/ExcelImportView';
import { PWAInstallButton } from './components/PWAInstallBanner';
import { SettingsView } from './components/SettingsView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  ActiveAuthUser,
  getSavedAuthSession,
  logoutService,
  subscribeAuthChanges,
} from './services/authService';
import {
  deleteBastWithItems,
  deleteCompanyRecord,
  ensureUserProfile,
  ensureUserSettings,
  getDefaultSettings,
  loadLocalCache,
  restoreFromBackupPayload,
  saveBastWithItems,
  saveCompanyRecord,
  saveUserSettings,
  subscribeUserData,
  updateUserProfileName,
} from './services/db';
import {
  AppSettings,
  BackupFilePayload,
  BastDocument,
  BastItem,
  Company,
  NavigationTab,
  SyncStatus,
} from './types';
import { generateNomorBast, generateSafeId } from './utils/formatters';

export default function App() {
  const [authUser, setAuthUser] = useState<ActiveAuthUser | null>(() =>
    getSavedAuthSession()
  );
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bastDocuments, setBastDocuments] = useState<BastDocument[]>([]);
  const [bastItems, setBastItems] = useState<BastItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() =>
    getDefaultSettings('guest')
  );
  const [userName, setUserName] = useState<string>('');

  const [editingBast, setEditingBast] = useState<BastDocument | null>(null);
  const [preselectedCompanyForNewBast, setPreselectedCompanyForNewBast] =
    useState<Company | null>(null);

  const isOnline = useOnlineStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');

  // Listen to Auth state and enforce strict multi-user state reset
  useEffect(() => {
    let isCancelled = false;

    const unsub = subscribeAuthChanges(async (user) => {
      setAuthUser(user);
      setAuthReady(true);

      // Immediately clear previous user's transient editing states
      setEditingBast(null);
      setPreselectedCompanyForNewBast(null);

      if (user) {
        // Load only this specific user's isolated local cache or clean defaults
        const cached = loadLocalCache(user.uid);
        const defaultUserSettings = getDefaultSettings(
          user.uid,
          user.email || ''
        );

        setCompanies(cached.companies);
        setBastDocuments(cached.bast_documents);
        setBastItems(cached.bast_items);
        setSettings(cached.settings || defaultUserSettings);
        setUserName(user.displayName || '');

        setSyncStatus('loading');
        try {
          const profile = await ensureUserProfile(
            user.uid,
            user.email || '',
            user.displayName || ''
          );
          if (!isCancelled) {
            setUserName(profile.name);
          }

          const loadedSettings = await ensureUserSettings(
            user.uid,
            user.email || ''
          );
          if (!isCancelled) {
            setSettings(loadedSettings);
            setSyncStatus(navigator.onLine ? 'synced' : 'offline');
          }
        } catch {
          if (!isCancelled) {
            setSyncStatus(navigator.onLine ? 'synced' : 'offline');
          }
        }
      } else {
        // Complete state purge on logout so User 1 and User 2 never mix
        setCompanies([]);
        setBastDocuments([]);
        setBastItems([]);
        setSettings(getDefaultSettings('guest'));
        setUserName('');
        setActiveTab('dashboard');
      }
    });

    return () => {
      isCancelled = true;
      unsub();
    };
  }, []);

  // Attach real-time Cloud Firestore listeners isolated by authUser.uid
  useEffect(() => {
    if (!authReady || !authUser) return;

    const unsubscribe = subscribeUserData(authUser.uid, {
      onCompanies: setCompanies,
      onBastDocuments: setBastDocuments,
      onBastItems: setBastItems,
      onSettings: setSettings,
      onSyncState: (st) => {
        if (!navigator.onLine) {
          setSyncStatus('offline');
        } else {
          setSyncStatus(st);
        }
      },
    });

    return () => unsubscribe();
  }, [authReady, authUser?.uid]);

  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline');
    } else if (authUser) {
      setSyncStatus('synced');
    }
  }, [isOnline, authUser]);

  useEffect(() => {
    const rootEl = document.documentElement;
    if (settings.theme === 'dark') {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }

    if (settings.app_icon?.trim()) {
      const iconLinks = document.querySelectorAll("link[rel*='icon']");
      iconLinks.forEach((link) => {
        (link as HTMLLinkElement).href = settings.app_icon;
      });
    }
  }, [settings.theme, settings.app_icon]);

  const handleSaveCompany = async (
    compData: Omit<Company, 'created_at' | 'updated_at'>,
    isUpdate: boolean
  ) => {
    if (!authUser) return;
    setSyncStatus('saving');
    await saveCompanyRecord(authUser.uid, compData, isUpdate);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleQuickSaveCompany = async (
    compData: Omit<Company, 'created_at' | 'updated_at'>
  ): Promise<Company> => {
    if (!authUser) throw new Error('Belum login');
    setSyncStatus('saving');
    const saved = await saveCompanyRecord(authUser.uid, compData, false);
    setSyncStatus(isOnline ? 'synced' : 'offline');
    return saved;
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!authUser) return;
    setSyncStatus('saving');
    await deleteCompanyRecord(companyId, authUser.uid);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleStartNewBast = (forCompany?: Company) => {
    setEditingBast(null);
    setPreselectedCompanyForNewBast(forCompany || null);
    setActiveTab('bast-form');
  };

  const handleStartEditBast = (bast: BastDocument) => {
    setPreselectedCompanyForNewBast(null);
    setEditingBast(bast);
    setActiveTab('bast-form');
  };

  const handleSaveBast = async (
    bastData: Omit<BastDocument, 'created_at' | 'updated_at'>,
    itemsData: Array<{
      id?: string;
      nomor: number;
      nama_barang_jasa: string;
      keterangan: string;
      urutan: number;
    }>,
    incrementCounter: boolean
  ) => {
    if (!authUser) return;
    setSyncStatus('saving');
    const existingIds = editingBast
      ? bastItems
          .filter((it) => it.bast_id === editingBast.id)
          .map((it) => it.id)
      : [];

    await saveBastWithItems(authUser.uid, bastData, itemsData, existingIds);

    if (incrementCounter) {
      const nextSettings: AppSettings = {
        ...settings,
        auto_number_counter: (settings.auto_number_counter || 1) + 1,
      };
      setSettings(nextSettings);
      await saveUserSettings(authUser.uid, nextSettings);
    }

    setSyncStatus(isOnline ? 'synced' : 'offline');
    setEditingBast(null);
    setPreselectedCompanyForNewBast(null);
    setActiveTab('bast');
  };

  const handleDuplicateBast = async (sourceBast: BastDocument) => {
    if (!authUser) return;
    setSyncStatus('saving');
    const newBastId = generateSafeId('bast');
    const nextCounter = (settings.auto_number_counter || 1) + 1;
    const newNomor = generateNomorBast(
      settings.auto_number_format,
      nextCounter,
      sourceBast.tanggal_bast
    );

    const sourceItems = bastItems
      .filter((it) => it.bast_id === sourceBast.id)
      .sort((a, b) => a.urutan - b.urutan || a.nomor - b.nomor);

    await saveBastWithItems(
      authUser.uid,
      {
        ...sourceBast,
        id: newBastId,
        nomor_bast: newNomor,
        status: 'Draft',
      },
      sourceItems.map((it, idx) => ({
        id: generateSafeId('item'),
        nomor: idx + 1,
        nama_barang_jasa: it.nama_barang_jasa,
        keterangan: it.keterangan,
        urutan: idx,
      })),
      []
    );

    const nextSettings: AppSettings = {
      ...settings,
      auto_number_counter: nextCounter,
    };
    setSettings(nextSettings);
    await saveUserSettings(authUser.uid, nextSettings);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleDeleteBast = async (bast: BastDocument) => {
    if (!authUser) return;
    setSyncStatus('saving');
    const itemIds = bastItems
      .filter((it) => it.bast_id === bast.id)
      .map((it) => it.id);
    await deleteBastWithItems(bast.id, itemIds, authUser.uid);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleRestoreBackup = async (
    payload: BackupFilePayload,
    mode: 'merge' | 'replace'
  ) => {
    if (!authUser) return;
    setSyncStatus('saving');
    await restoreFromBackupPayload(authUser.uid, payload, mode);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleSaveSettings = async (next: AppSettings) => {
    if (!authUser) return;
    setSyncStatus('saving');
    setSettings(next);
    await saveUserSettings(authUser.uid, next);
    setSyncStatus(isOnline ? 'synced' : 'offline');
  };

  const handleUpdateUserName = async (newName: string) => {
    if (!authUser) return;
    setUserName(newName);
    await updateUserProfileName(authUser.uid, newName, authUser.email || '');
  };

  const handleLogout = async () => {
    setEditingBast(null);
    setPreselectedCompanyForNewBast(null);
    setCompanies([]);
    setBastDocuments([]);
    setBastItems([]);
    setSettings(getDefaultSettings('guest'));
    setActiveTab('dashboard');
    await logoutService();
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
        <p className="text-xs font-semibold text-slate-600">
          Memuat Aplikasi BAST...
        </p>
      </div>
    );
  }

  if (!authUser) {
    return <AuthView customAppIcon={settings.app_icon} />;
  }

  const formInitialBast: BastDocument | null = editingBast
    ? editingBast
    : preselectedCompanyForNewBast
    ? {
        id: generateSafeId('bast'),
        user_id: authUser.uid,
        nomor_bast: '',
        tanggal_bast: new Date().toISOString().slice(0, 10),
        kota: settings.kota || 'Bogor',
        company_id: preselectedCompanyForNewBast.id,
        pihak_pertama_pt: preselectedCompanyForNewBast.nama_pt,
        pihak_pertama_nama: preselectedCompanyForNewBast.nama_pejabat,
        pihak_pertama_jabatan: preselectedCompanyForNewBast.jabatan_pejabat,
        pihak_pertama_alamat: [
          preselectedCompanyForNewBast.alamat,
          preselectedCompanyForNewBast.kota,
          preselectedCompanyForNewBast.kode_pos,
        ]
          .filter(Boolean)
          .join(', '),
        pihak_kedua_nama: settings.default_pihak_kedua_nama || 'MUHAMAD RIDHO',
        pihak_kedua_jabatan:
          settings.default_pihak_kedua_jabatan || 'Teknisi / Pelaksana',
        pihak_kedua_alamat:
          settings.default_pihak_kedua_alamat || settings.alamat || '',
        nomor_po: '',
        deskripsi_pekerjaan: '',
        tanggal_mulai: new Date().toISOString().slice(0, 10),
        tanggal_selesai: new Date().toISOString().slice(0, 10),
        status: 'Draft',
        signature_party_1: '',
        signature_party_2: '',
        use_stempel: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : null;

  const navItems: Array<{
    id: NavigationTab;
    label: string;
    shortLabel: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'companies',
      label: 'Data Perusahaan',
      shortLabel: 'Perusahaan',
      icon: Building2,
    },
    {
      id: 'bast',
      label: 'BAST',
      shortLabel: 'BAST',
      icon: FileText,
    },
    {
      id: 'import-excel',
      label: 'Import Excel',
      shortLabel: 'Excel',
      icon: FileSpreadsheet,
    },
    {
      id: 'backup-restore',
      label: 'Backup & Restore',
      shortLabel: 'Backup',
      icon: Database,
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      shortLabel: 'Pengaturan',
      icon: SettingsIcon,
    },
  ];

  return (
    <div
      key={authUser.uid}
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row"
    >
      {/* Desktop / Tablet Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-100 dark:border-slate-800">
          <img
            src={settings.app_icon || '/icon.svg'}
            alt="BAST"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl object-cover bg-blue-900 shrink-0"
          />
          <div className="truncate">
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white block leading-none">
              BAST
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block mt-0.5">
              Berita Acara Serah Terima
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (activeTab === 'bast-form' && item.id === 'bast');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setEditingBast(null);
                  setPreselectedCompanyForNewBast(null);
                  setActiveTab(item.id);
                }}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs truncate">
            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {userName || authUser.displayName || authUser.email}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {authUser.email}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2.5 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
          >
            BAST
          </button>

          {/* Zone 2: Clean Desktop Text Links */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {navItems.slice(0, 5).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap ${
                  activeTab === item.id
                    ? 'text-blue-900 dark:text-blue-400 font-semibold underline underline-offset-4'
                    : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Sync Status & PWA Install Action */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {syncStatus === 'loading' || syncStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-blue-700 animate-spin" />
                  <span className="hidden sm:inline">
                    {syncStatus === 'saving' ? 'Menyimpan Online...' : 'Memuat Cloud...'}
                  </span>
                </>
              ) : syncStatus === 'offline' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-400">
                    Offline
                  </span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline text-emerald-700 dark:text-emerald-400">
                    Cloud Online
                  </span>
                </>
              )}
            </div>

            <PWAInstallButton />
          </div>
        </header>

        {/* Offline Connectivity Banner */}
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
            <CloudOff className="w-4 h-4 shrink-0" />
            <span>
              Anda sedang offline. Perubahan akan disinkronkan otomatis ketika koneksi tersedia.
            </span>
          </div>
        )}

        {/* Main Viewport Container */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-24 md:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardAndBastListView
              mode="dashboard"
              userEmail={authUser.email}
              companies={companies}
              bastDocuments={bastDocuments}
              bastItems={bastItems}
              settings={settings}
              onCreateNew={() => handleStartNewBast()}
              onCreateBastForCompany={(comp) => handleStartNewBast(comp)}
              onOpenCompanies={() => setActiveTab('companies')}
              onOpenImportExcel={() => setActiveTab('import-excel')}
              onEditBast={handleStartEditBast}
              onDuplicateBast={handleDuplicateBast}
              onDeleteBast={handleDeleteBast}
            />
          )}

          {activeTab === 'bast' && (
            <DashboardAndBastListView
              mode="list"
              userEmail={authUser.email}
              companies={companies}
              bastDocuments={bastDocuments}
              bastItems={bastItems}
              settings={settings}
              onCreateNew={() => handleStartNewBast()}
              onCreateBastForCompany={(comp) => handleStartNewBast(comp)}
              onOpenCompanies={() => setActiveTab('companies')}
              onOpenImportExcel={() => setActiveTab('import-excel')}
              onEditBast={handleStartEditBast}
              onDuplicateBast={handleDuplicateBast}
              onDeleteBast={handleDeleteBast}
            />
          )}

          {activeTab === 'bast-form' && (
            <BastFormView
              uid={authUser.uid}
              companies={companies}
              settings={settings}
              existingBast={
                editingBast
                  ? editingBast
                  : formInitialBast
                  ? formInitialBast
                  : null
              }
              existingItems={
                editingBast
                  ? bastItems.filter((it) => it.bast_id === editingBast.id)
                  : []
              }
              allBastDocuments={bastDocuments}
              onSave={handleSaveBast}
              onQuickSaveCompany={handleQuickSaveCompany}
              onCancel={() => {
                setEditingBast(null);
                setPreselectedCompanyForNewBast(null);
                setActiveTab('bast');
              }}
            />
          )}

          {activeTab === 'companies' && (
            <CompaniesView
              uid={authUser.uid}
              companies={companies}
              onSaveCompany={handleSaveCompany}
              onDeleteCompany={handleDeleteCompany}
              onOpenImportExcel={() => setActiveTab('import-excel')}
              onCreateBastForCompany={(comp) => handleStartNewBast(comp)}
            />
          )}

          {activeTab === 'import-excel' && (
            <ExcelImportView
              uid={authUser.uid}
              existingCompanies={companies}
              onSaveCompany={handleSaveCompany}
              onDone={() => setActiveTab('companies')}
            />
          )}

          {activeTab === 'backup-restore' && (
            <BackupRestoreView
              uid={authUser.uid}
              userEmail={authUser.email || ''}
              companies={companies}
              bastDocuments={bastDocuments}
              bastItems={bastItems}
              settings={settings}
              onRestore={handleRestoreBackup}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              uid={authUser.uid}
              userEmail={authUser.email || ''}
              userName={userName || authUser.displayName}
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onUpdateUserName={handleUpdateUserName}
              onOpenBackupRestore={() => setActiveTab('backup-restore')}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Mobile Android Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-6 items-center h-16 pb-safe px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (activeTab === 'bast-form' && item.id === 'bast');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setEditingBast(null);
                setPreselectedCompanyForNewBast(null);
                setActiveTab(item.id);
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition ${
                isActive
                  ? 'text-blue-900 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px]">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
