import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  BastDocument,
  BastItem,
  BastStatus,
  Company,
} from '../types';
import {
  formatTanggalIndonesia,
  generateNomorBast,
} from '../utils/formatters';
import { downloadBastPdf, shareBastPdf } from '../utils/pdfGenerator';
import { showQuickPopup } from '../utils/quickPopup';
import { BastPreviewModal } from './BastPreviewModal';

interface DashboardAndBastListViewProps {
  mode: 'dashboard' | 'list';
  userEmail?: string;
  companies?: Company[];
  bastDocuments: BastDocument[];
  bastItems: BastItem[];
  settings: AppSettings;
  onCreateNew: () => void;
  onCreateBastForCompany?: (company: Company) => void;
  onOpenCompanies?: () => void;
  onOpenImportExcel?: () => void;
  onEditBast: (bast: BastDocument) => void;
  onDuplicateBast: (bast: BastDocument) => Promise<void>;
  onDeleteBast: (bast: BastDocument) => Promise<void>;
}

export const DashboardAndBastListView: React.FC<
  DashboardAndBastListViewProps
> = ({
  mode,
  userEmail = '',
  companies = [],
  bastDocuments,
  bastItems,
  settings,
  onCreateNew,
  onCreateBastForCompany,
  onOpenCompanies,
  onOpenImportExcel,
  onEditBast,
  onDuplicateBast,
  onDeleteBast,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'Semua' | 'BulanIni' | BastStatus
  >('Semua');
  const [previewBast, setPreviewBast] = useState<BastDocument | null>(null);
  const [deleteConfirmBast, setDeleteConfirmBast] =
    useState<BastDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentYearMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;

  const totalBast = bastDocuments.length;
  const bastThisMonth = bastDocuments.filter((d) =>
    d.tanggal_bast.startsWith(currentYearMonth)
  ).length;
  const draftCount = bastDocuments.filter((d) => d.status === 'Draft').length;
  const selesaiCount = bastDocuments.filter(
    (d) => d.status === 'Selesai'
  ).length;

  const completionPercent =
    totalBast > 0 ? Math.round((selesaiCount / totalBast) * 100) : 0;

  // Compute Next Automatic BAST Number for the Command Deck ticker
  const nextBastNumber = (() => {
    let counter = Math.max(1, settings.auto_number_counter || 1);
    const existingSet = new Set(
      bastDocuments.map((d) => d.nomor_bast.trim().toUpperCase())
    );
    let candidate = generateNomorBast(
      settings.auto_number_format,
      counter,
      todayIso
    );
    while (existingSet.has(candidate.toUpperCase())) {
      counter++;
      candidate = generateNomorBast(
        settings.auto_number_format,
        counter,
        todayIso
      );
    }
    return candidate;
  })();

  const q = search.trim().toLowerCase();
  const filteredDocs = bastDocuments.filter((d) => {
    if (statusFilter === 'BulanIni') {
      if (!d.tanggal_bast.startsWith(currentYearMonth)) return false;
    } else if (statusFilter !== 'Semua' && d.status !== statusFilter) {
      return false;
    }
    if (!q) return true;
    const indoDate = formatTanggalIndonesia(d.tanggal_bast).toLowerCase();
    return (
      d.nomor_bast.toLowerCase().includes(q) ||
      d.pihak_pertama_pt.toLowerCase().includes(q) ||
      d.pihak_pertama_nama.toLowerCase().includes(q) ||
      d.nomor_po.toLowerCase().includes(q) ||
      d.tanggal_bast.toLowerCase().includes(q) ||
      indoDate.includes(q)
    );
  });

  const getItemsForBast = (bastId: string): BastItem[] =>
    bastItems
      .filter((it) => it.bast_id === bastId)
      .sort((a, b) => a.urutan - b.urutan || a.nomor - b.nomor);

  const handleDownloadPdf = async (bast: BastDocument) => {
    setBusyId(`pdf_${bast.id}`);
    try {
      await downloadBastPdf(bast, getItemsForBast(bast.id), settings);
      showQuickPopup(`PDF BAST ${bast.nomor_bast} berhasil diunduh!`, 'success');
    } finally {
      setBusyId(null);
    }
  };

  const handleSharePdf = async (bast: BastDocument) => {
    setBusyId(`share_${bast.id}`);
    try {
      showQuickPopup('Membuka menu Bagikan PDF...', 'info');
      await shareBastPdf(bast, getItemsForBast(bast.id), settings);
    } catch {
      // User dismissed share sheet
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (bast: BastDocument) => {
    setBusyId(`dup_${bast.id}`);
    try {
      await onDuplicateBast(bast);
      showQuickPopup(`BAST ${bast.nomor_bast} berhasil diduplikat!`, 'success');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmBast) return;
    setBusyId(`del_${deleteConfirmBast.id}`);
    try {
      await onDeleteBast(deleteConfirmBast);
      showQuickPopup(`BAST ${deleteConfirmBast.nomor_bast} berhasil dihapus`, 'info');
      setDeleteConfirmBast(null);
    } finally {
      setBusyId(null);
    }
  };

  // Circle SVG parameters for completion gauge
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (completionPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* =====================================================================
          MODE: UNIQUE EXECUTIVE HANDOVER STUDIO DASHBOARD
         ===================================================================== */}
      {mode === 'dashboard' ? (
        <>
          {/* 1. ASYMMETRIC BENTO COMMAND DECK */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Command Studio Card (7 cols) */}
            <div className="lg:col-span-7 relative overflow-hidden rounded-3xl bg-[#0B1E3B] text-white p-5 sm:p-6 shadow-md border border-blue-900/60 flex flex-col justify-between gap-5">
              {/* Subtle Architectural Blueprint Grid Pattern */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(#60A5FA 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              />

              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-[11px] font-semibold text-blue-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[240px]">
                      Cloud Terisolasi: {userEmail || 'Akun Aktif'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-200/80 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatTanggalIndonesia(todayIso)}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blue-300/90">
                    {settings.nama_perusahaan || 'CV. MULIA TEKHNIK ABADI'}
                  </p>
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mt-0.5 leading-snug">
                    Pusat Kendali Berita Acara Serah Terima
                  </h1>
                </div>

                {/* Live Next BAST Number Register Ticker */}
                <div className="p-3 rounded-2xl bg-slate-950/55 border border-blue-400/25 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                      Nomor Register BAST Berikutnya
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-emerald-300 tabular-nums">
                      {nextBastNumber}
                    </span>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30">
                    Siap Terbit A4
                  </span>
                </div>
              </div>

              {/* Tactile Command Buttons */}
              <div className="relative z-10 flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-white text-[#0B1E3B] text-xs sm:text-sm font-extrabold hover:bg-blue-50 active:scale-[0.99] flex items-center gap-2 shadow-sm transition"
                >
                  <FilePlus2 className="w-4 h-4 text-blue-800" />
                  + Buat BAST Baru
                </button>

                {onOpenImportExcel && (
                  <button
                    type="button"
                    onClick={onOpenImportExcel}
                    className="min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-blue-900/60 hover:bg-blue-800/80 border border-blue-400/30 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-300" />
                    Import Excel PT
                  </button>
                )}

                {onOpenCompanies && (
                  <button
                    type="button"
                    onClick={onOpenCompanies}
                    className="min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-blue-900/60 hover:bg-blue-800/80 border border-blue-400/30 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Building2 className="w-4 h-4 text-blue-300" />
                    {companies.length} Database PT
                  </button>
                )}
              </div>
            </div>

            {/* Right Operational Ledger & Completion Gauge Card (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-400 block">
                    Indeks Penyelesaian
                  </span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    Status Arsip &amp; Mitra
                  </h2>
                </div>

                {/* Circular SVG Gauge */}
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="7"
                      fill="transparent"
                      className="text-slate-100 dark:text-slate-800"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth="7"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="text-emerald-600 dark:text-emerald-400 transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                      {completionPercent}%
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-slate-400">
                      Selesai
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Mini Ledger Rows */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
                    <span>Klien PT</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {companies.length}
                  </p>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Item Jasa</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    {bastItems.length}
                  </p>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Final PDF</span>
                  </div>
                  <p className="text-lg font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                    {selesaiCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. INTERACTIVE 4-STAGE DOCUMENT PIPELINE STRIP */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter('Semua')}
              className={`text-left rounded-2xl p-4 border transition relative overflow-hidden ${
                statusFilter === 'Semua'
                  ? 'bg-white dark:bg-slate-900 border-blue-900 dark:border-blue-500 ring-2 ring-blue-900/15 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="h-1 w-full bg-slate-800 dark:bg-slate-300 absolute top-0 left-0 right-0" />
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>01 / TOTAL ARSIP</span>
                <FileText className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <p className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                {totalBast}
              </p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                Jumlah BAST
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('BulanIni')}
              className={`text-left rounded-2xl p-4 border transition relative overflow-hidden ${
                statusFilter === 'BulanIni'
                  ? 'bg-white dark:bg-slate-900 border-blue-900 dark:border-blue-500 ring-2 ring-blue-900/15 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="h-1 w-full bg-blue-700 absolute top-0 left-0 right-0" />
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>02 / PERIODE INI</span>
                <Calendar className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <p className="text-2xl font-extrabold font-mono tabular-nums text-blue-900 dark:text-blue-400 mt-1.5">
                {bastThisMonth}
              </p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                BAST Bulan Ini
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Draft')}
              className={`text-left rounded-2xl p-4 border transition relative overflow-hidden ${
                statusFilter === 'Draft'
                  ? 'bg-white dark:bg-slate-900 border-amber-600 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="h-1 w-full bg-amber-500 absolute top-0 left-0 right-0" />
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>03 / DALAM PROSES</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
                {draftCount}
              </p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                Status Draft
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('Selesai')}
              className={`text-left rounded-2xl p-4 border transition relative overflow-hidden ${
                statusFilter === 'Selesai'
                  ? 'bg-white dark:bg-slate-900 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="h-1 w-full bg-emerald-600 absolute top-0 left-0 right-0" />
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>04 / TERVERIFIKASI</span>
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1.5">
                {selesaiCount}
              </p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                Status Selesai
              </p>
            </button>
          </div>

          {/* 3. QUICK 1-CLICK BAST LAUNCHER PER CLIENT PT */}
          {companies.length > 0 && onCreateBastForCompany && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-800 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Terbitkan Cepat per Klien (1-Klik Buat BAST)
                  </h3>
                </div>
                {onOpenCompanies && (
                  <button
                    type="button"
                    onClick={onOpenCompanies}
                    className="text-xs font-semibold text-blue-900 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    Lihat Semua ({companies.length})
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {companies.slice(0, 8).map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => onCreateBastForCompany(comp)}
                    className="shrink-0 max-w-[240px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 hover:bg-blue-50/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:border-blue-400 text-left transition group"
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-900 dark:group-hover:text-blue-300">
                      {comp.nama_pt}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      Pejabat: {comp.nama_pejabat}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* =====================================================================
           MODE: BAST LIST HEADER
           ===================================================================== */
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Daftar Dokumen BAST
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kelola, lihat preview A4 penuh (VIEW PDF), download, atau bagikan
              dokumen BAST
            </p>
          </div>

          <button
            type="button"
            onClick={onCreateNew}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 active:scale-[0.99] flex items-center gap-2 shadow-xs transition"
          >
            <FilePlus2 className="w-4 h-4" />
            + Buat BAST
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari Nomor BAST, Nama PT, Pejabat, Nomor PO, atau Tanggal..."
            className="w-full min-h-[46px] pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        {/* Interactive Segmented Filter Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl shrink-0 overflow-x-auto">
          {(
            [
              { id: 'Semua', label: 'Semua' },
              { id: 'BulanIni', label: 'Bulan Ini' },
              { id: 'Draft', label: 'Draft' },
              { id: 'Selesai', label: 'Selesai' },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === st.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Dossier List or Empty State */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {bastDocuments.length === 0
                ? 'Belum Ada Dokumen BAST pada Akun Ini'
                : 'Dokumen BAST Tidak Ditemukan'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {bastDocuments.length === 0
                ? 'Setiap pengguna memiliki ruang penyimpanan Cloud tersendiri. Buat dokumen BAST pertama Anda sekarang.'
                : 'Tidak ada dokumen yang cocok dengan kata kunci pencarian atau filter status saat ini.'}
            </p>
          </div>
          {bastDocuments.length === 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onCreateNew}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-2"
              >
                <FilePlus2 className="w-4 h-4" />
                + Buat BAST Pertama
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredDocs.map((bast, index) => {
            const docItems = getItemsForBast(bast.id);
            const firstItem = docItems[0]?.nama_barang_jasa;
            const isSelesai = bast.status === 'Selesai';

            return (
              <div
                key={bast.id}
                className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-5 pr-4 sm:pr-5 py-4 flex flex-col gap-3.5 hover:border-slate-300 transition shadow-2xs"
              >
                {/* Left Vertical Status Spine */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isSelesai ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                />

                {/* Top Register Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      #{String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="font-bold text-blue-900 dark:text-blue-300">
                      {bast.nomor_bast}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {formatTanggalIndonesia(bast.tanggal_bast)}
                    </span>
                    {bast.nomor_po && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">
                          |
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          PO: {bast.nomor_po}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Official Status Stamp Badge */}
                  <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                    {isSelesai ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        SELESAI
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        DRAFT
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Handover Parties Dossier Box */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/80">
                  <div className="md:col-span-6">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Pihak Pertama (Perusahaan Klien)
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug mt-0.5">
                      {bast.pihak_pertama_pt}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                      Pejabat:{' '}
                      <strong className="font-semibold">
                        {bast.pihak_pertama_nama}
                      </strong>
                      {bast.pihak_pertama_jabatan
                        ? ` (${bast.pihak_pertama_jabatan})`
                        : ''}
                    </p>
                  </div>

                  <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200/70 dark:border-slate-800 pt-2 md:pt-0 md:pl-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Pihak Kedua &amp; Ringkasan Pekerjaan ({docItems.length}{' '}
                        Item)
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        Pelaksana: {bast.pihak_kedua_nama}
                      </p>
                    </div>
                    {firstItem && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                        • {firstItem}
                        {docItems.length > 1
                          ? ` (+${docItems.length - 1} item lainnya)`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Action Bar: VIEW PDF, Edit, Duplikat, Download PDF, Bagikan, Hapus */}
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewBast(bast)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-bold hover:bg-blue-800 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      VIEW PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditBast(bast)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={busyId === `dup_${bast.id}`}
                      onClick={() => handleDuplicate(bast)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      {busyId === `dup_${bast.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      Duplikat
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === `pdf_${bast.id}`}
                      onClick={() => handleDownloadPdf(bast)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 flex items-center gap-1.5"
                    >
                      {busyId === `pdf_${bast.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download PDF
                    </button>

                    <button
                      type="button"
                      disabled={busyId === `share_${bast.id}`}
                      onClick={() => handleSharePdf(bast)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-blue-800 text-blue-900 dark:text-blue-300 dark:border-blue-500 text-xs font-semibold hover:bg-blue-50 flex items-center gap-1.5"
                    >
                      {busyId === `share_${bast.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      Bagikan
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmBast(bast)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center"
                      title="Hapus BAST"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-Fit Full A4 Preview Modal */}
      {previewBast && (
        <BastPreviewModal
          bast={previewBast}
          items={getItemsForBast(previewBast.id)}
          settings={settings}
          onClose={() => setPreviewBast(null)}
          onEdit={() => {
            const target = previewBast;
            setPreviewBast(null);
            onEditBast(target);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmBast && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Konfirmasi Hapus BAST
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghapus dokumen BAST{' '}
              <strong>{deleteConfirmBast.nomor_bast}</strong> untuk{' '}
              <strong>{deleteConfirmBast.pihak_pertama_pt}</strong>? Tindakan
              ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmBast(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busyId === `del_${deleteConfirmBast.id}`}
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center gap-1.5"
              >
                {busyId === `del_${deleteConfirmBast.id}` && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Ya, Hapus BAST
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
