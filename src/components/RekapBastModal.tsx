import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AppSettings, BastDocument, BastItem, BastStatus } from '../types';
import { downloadRekapBastPdf } from '../utils/pdfGenerator';
import { showQuickPopup } from '../utils/quickPopup';

interface RekapBastModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBastDocuments: BastDocument[];
  filteredBastDocuments: BastDocument[];
  allItems: BastItem[];
  settings: AppSettings;
}

export const RekapBastModal: React.FC<RekapBastModalProps> = ({
  isOpen,
  onClose,
  allBastDocuments,
  filteredBastDocuments,
  allItems,
  settings,
}) => {
  const [scope, setScope] = useState<'all' | 'filtered'>('all');
  const [statusFilter, setStatusFilter] = useState<'Semua' | BastStatus>('Semua');
  const [includeItemDetails, setIncludeItemDetails] = useState<boolean>(true);
  const [customTitle, setCustomTitle] = useState<string>(
    'REKAPITULASI BERITA ACARA SERAH TERIMA (BAST)'
  );
  const [customSubtitle, setCustomSubtitle] = useState<string>(
    'Laporan Rekapitulasi Keseluruhan & Rincian Barang / Jasa'
  );
  const [isGenerating, setIsGenerating] = useState(false);

  // Compute selected documents based on user choices
  const selectedDocs = useMemo(() => {
    const baseList = scope === 'all' ? allBastDocuments : filteredBastDocuments;
    if (statusFilter === 'Semua') {
      return baseList;
    }
    return baseList.filter((d) => d.status === statusFilter);
  }, [scope, statusFilter, allBastDocuments, filteredBastDocuments]);

  // Compute count of items belonging to the selected documents
  const selectedDocIds = useMemo(
    () => new Set(selectedDocs.map((d) => d.id)),
    [selectedDocs]
  );

  const selectedItemsCount = useMemo(() => {
    return allItems.filter((it) => selectedDocIds.has(it.bast_id)).length;
  }, [allItems, selectedDocIds]);

  const uniqueClientsCount = useMemo(() => {
    return new Set(selectedDocs.map((d) => d.pihak_pertama_pt.trim().toUpperCase()))
      .size;
  }, [selectedDocs]);

  const selesaiCount = useMemo(() => {
    return selectedDocs.filter((d) => d.status === 'Selesai').length;
  }, [selectedDocs]);

  const draftCount = useMemo(() => {
    return selectedDocs.filter((d) => d.status === 'Draft').length;
  }, [selectedDocs]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (selectedDocs.length === 0) {
      showQuickPopup('Tidak ada dokumen BAST yang dipilih untuk direkap.', 'warning');
      return;
    }

    setIsGenerating(true);
    showQuickPopup('Sedang menyusun PDF Rekap BAST...', 'info');

    try {
      await downloadRekapBastPdf(selectedDocs, allItems, settings, {
        title: customTitle.trim() || 'REKAPITULASI BERITA ACARA SERAH TERIMA (BAST)',
        subtitle:
          customSubtitle.trim() ||
          'Laporan Rekapitulasi Keseluruhan & Rincian Barang / Jasa',
        includeItemDetails,
      });
      showQuickPopup(
        `PDF Rekap BAST (${selectedDocs.length} Dokumen, ${selectedItemsCount} Rincian) berhasil diunduh!`,
        'success'
      );
      onClose();
    } catch (error) {
      console.error('Failed to generate Rekap BAST PDF:', error);
      showQuickPopup('Gagal membuat PDF Rekap BAST. Silakan coba lagi.', 'warning');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Download Rekap BAST Keseluruhan
              </h2>
              <p className="text-xs text-blue-200">
                Laporan PDF resmi A4 lengkap berikut tabel rincian barang/jasa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                BAST Terpilih
              </span>
              <p className="text-xl font-extrabold font-mono text-blue-950 dark:text-white mt-0.5">
                {selectedDocs.length}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Total Rincian
              </span>
              <p className="text-xl font-extrabold font-mono text-indigo-950 dark:text-white mt-0.5">
                {selectedItemsCount}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Status Selesai
              </span>
              <p className="text-xl font-extrabold font-mono text-emerald-950 dark:text-white mt-0.5">
                {selesaiCount}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Status Draft
              </span>
              <p className="text-xl font-extrabold font-mono text-amber-950 dark:text-white mt-0.5">
                {draftCount}
              </p>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
              Cakupan Dokumen yang Direkap
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  scope === 'all'
                    ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Semua BAST Tersimpan
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold">
                    {allBastDocuments.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Rekapitulasi seluruh arsip BAST yang pernah dibuat di akun Anda
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-3.5 rounded-2xl border text-left transition ${
                  scope === 'filtered'
                    ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Sesuai Filter &amp; Pencarian
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                    {filteredBastDocuments.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Hanya merekap dokumen yang sesuai hasil filter/pencarian di layar
                </p>
              </button>
            </div>
          </div>

          {/* Filter Status Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
              Filter Status Dokumen
            </label>
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
              {(['Semua', 'Selesai', 'Draft'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 min-h-[36px] py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'Semua' ? 'Semua Status' : `Hanya ${st}`}
                </button>
              ))}
            </div>
          </div>

          {/* Include Item Details Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeItemDetails}
                onChange={(e) => setIncludeItemDetails(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-blue-900 border-slate-300 focus:ring-blue-800"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Sertakan Rincian Barang / Jasa (Itemized Breakdown)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Mencantumkan seluruh tabel rincian detail barang dan pekerjaan untuk setiap nomor BAST pada laporan PDF
                </span>
              </div>
            </label>
          </div>

          {/* Titles & Customization */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Judul Laporan PDF
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="REKAPITULASI BERITA ACARA SERAH TERIMA (BAST)"
                className="w-full min-h-[42px] px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Subjudul Laporan PDF
              </label>
              <input
                type="text"
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                placeholder="Laporan Rekapitulasi Keseluruhan & Rincian Barang / Jasa"
                className="w-full min-h-[42px] px-3.5 py-2 text-xs font-medium bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating || selectedDocs.length === 0}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50 disabled:pointer-events-none"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                Menyiapkan PDF Rekap...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-300" />
                Unduh PDF Rekap BAST ({selectedDocs.length} Dokumen)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
