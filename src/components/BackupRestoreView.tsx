import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  AppSettings,
  BackupFilePayload,
  BastDocument,
  BastItem,
  Company,
} from '../types';

interface BackupRestoreViewProps {
  uid: string;
  userEmail: string;
  companies: Company[];
  bastDocuments: BastDocument[];
  bastItems: BastItem[];
  settings: AppSettings;
  onRestore: (
    payload: BackupFilePayload,
    mode: 'merge' | 'replace'
  ) => Promise<void>;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  uid,
  userEmail,
  companies,
  bastDocuments,
  bastItems,
  settings,
  onRestore,
}) => {
  const [restorePreview, setRestorePreview] =
    useState<BackupFilePayload | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Generates filename: BAST_Backup_YYYY-MM-DD_HH-mm.json
   */
  const getBackupFileName = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `BAST_Backup_${yyyy}-${mm}-${dd}_${hh}-${min}.json`;
  };

  const handleDownloadBackup = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: BackupFilePayload = {
      metadata: {
        app_name: 'BAST - Berita Acara Serah Terima',
        backup_version: '1.0.0',
        exported_at: new Date().toISOString(),
        user_id: uid,
        user_email: userEmail,
        company_count: companies.length,
        bast_count: bastDocuments.length,
        item_count: bastItems.length,
        assets_note:
          'Seluruh referensi gambar logo, stempel, dan tanda tangan disertakan langsung dalam format Data URL / URL pada objek settings dan bast_documents.',
      },
      settings,
      companies,
      bast_documents: bastDocuments,
      bast_items: bastItems,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = getBackupFileName();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccessMsg(`File backup "${filename}" berhasil dibuat dan diunduh.`);
  };

  const handleSelectRestoreFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setRestorePreview(null);

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupFilePayload>;

      // Validate structure
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.metadata ||
        !Array.isArray(parsed.companies) ||
        !Array.isArray(parsed.bast_documents) ||
        !Array.isArray(parsed.bast_items)
      ) {
        setErrorMsg(
          'File backup JSON tidak valid atau rusak. Pastikan Anda memilih file hasil fitur Backup JSON dari aplikasi BAST.'
        );
        return;
      }

      setRestorePreview(parsed as BackupFilePayload);
    } catch {
      setErrorMsg(
        'File tidak dapat dibaca karena format JSON rusak. Silakan pilih file backup JSON yang valid.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await onRestore(restorePreview, restoreMode);
      setSuccessMsg(
        `Pemulihan data berhasil diselesaikan (${restorePreview.companies.length} perusahaan & ${restorePreview.bast_documents.length} dokumen BAST).`
      );
      setRestorePreview(null);
    } catch {
      setErrorMsg(
        'Gagal memulihkan data ke database cloud. Periksa koneksi internet Anda dan coba lagi.'
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Backup &amp; Restore Data (JSON)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Perlindungan ganda: selain tersimpan otomatis di Cloud Database, Anda dapat mengunduh salinan lengkap data dalam format JSON
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* BACKUP JSON CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Backup JSON
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Unduh seluruh data perusahaan, dokumen BAST, rincian barang/jasa, pengaturan identitas, logo, stempel, dan tanda tangan ke dalam satu file JSON.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1 font-mono tabular-nums text-slate-700 dark:text-slate-300">
              <div>Data Perusahaan : {companies.length} PT</div>
              <div>Dokumen BAST    : {bastDocuments.length} Dokumen</div>
              <div>Item Pekerjaan  : {bastItems.length} Baris</div>
              <div className="text-[11px] text-slate-500 pt-1">
                Format Nama File: {getBackupFileName()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center justify-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4" />
            Backup JSON Sekarang
          </button>
        </div>

        {/* RESTORE JSON CARD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Restore JSON
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pulihkan data dari file backup JSON. Sistem akan menampilkan ringkasan isi file dan meminta konfirmasi Anda sebelum memulihkan data.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Mode Pemulihan Tersedia:
              </div>
              <div>
                • <strong>Merge</strong>: Menggabungkan backup dengan data yang ada
              </div>
              <div>
                • <strong>Replace</strong>: Mengganti seluruh data dengan isi backup
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleSelectRestoreFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 flex items-center justify-center gap-2"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            Pilih File Backup JSON untuk Restore
          </button>
        </div>
      </div>

      {/* RESTORE CONFIRMATION MODAL / PANEL */}
      {restorePreview && (
        <div className="bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-5 space-y-5 shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Konfirmasi Pemulihan Data (Restore JSON)
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                Data akan dipulihkan. Data yang ada dapat tertimpa.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block">Jumlah Perusahaan</span>
              <strong className="text-base font-mono tabular-nums text-slate-900 dark:text-white">
                {restorePreview.companies.length}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block">Jumlah BAST</span>
              <strong className="text-base font-mono tabular-nums text-slate-900 dark:text-white">
                {restorePreview.bast_documents.length}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block">Tanggal Backup</span>
              <strong className="text-xs font-mono tabular-nums text-slate-900 dark:text-white">
                {restorePreview.metadata.exported_at
                  ? new Date(
                      restorePreview.metadata.exported_at
                    ).toLocaleString('id-ID')
                  : '-'}
              </strong>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 block">Versi Backup</span>
              <strong className="text-sm font-mono tabular-nums text-slate-900 dark:text-white">
                v{restorePreview.metadata.backup_version || '1.0'}
              </strong>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Pilih Mode Restore:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRestoreMode('merge')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  restoreMode === 'merge'
                    ? 'border-blue-900 bg-blue-50/70 dark:bg-blue-950/50 text-blue-950 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-xs font-bold">
                  Mode Merge (Gabungkan Data)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Mempertahankan data yang sudah ada dan memperbarui/menambahkan data dari file backup.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  restoreMode === 'replace'
                    ? 'border-red-600 bg-red-50/70 dark:bg-red-950/40 text-red-950 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="text-xs font-bold">
                  Mode Replace (Ganti Seluruh Data)
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Menghapus data lama di akun ini dan menggantinya secara penuh dengan data dari file backup.
                </div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={restoring}
              onClick={() => setRestorePreview(null)}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={restoring}
              onClick={handleConfirmRestore}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-2 disabled:opacity-50"
            >
              {restoring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Konfirmasi &amp; Pulihkan Data ({restoreMode.toUpperCase()})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
