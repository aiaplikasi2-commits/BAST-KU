import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { Company } from '../types';
import { generateSafeId } from '../utils/formatters';

interface ExcelImportViewProps {
  uid: string;
  existingCompanies: Company[];
  onSaveCompany: (
    company: Omit<Company, 'created_at' | 'updated_at'>,
    isUpdate: boolean
  ) => Promise<void>;
  onDone: () => void;
}

type DuplicateAction = 'skip' | 'update' | 'create_new';

interface ParsedExcelRow {
  rowIndex: number;
  rawNo: string;
  no: number | null;
  nama_pt: string;
  nama_pejabat: string;
  isValid: boolean;
  errorReason: string | null;
  existingCompany?: Company;
}

export const ExcelImportView: React.FC<ExcelImportViewProps> = ({
  uid,
  existingCompanies,
  onSaveCompany,
  onDone,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedExcelRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [duplicateAction, setDuplicateAction] =
    useState<DuplicateAction>('update');
  const [importing, setImporting] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Generates & downloads the official Excel Template (.xlsx)
   * Header: NO | NAMA PT | NAMA PEJABAT
   */
  const handleDownloadTemplate = () => {
    const rows = [
      ['NO', 'NAMA PT', 'NAMA PEJABAT'],
      [1, 'PT. KANSAI PAINT INDONESIA', 'MUHAMAD RIDHO'],
      [2, 'PT. CONTOH INDONESIA', 'BUDI SANTOSO'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 28 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Perusahaan');
    XLSX.writeFile(wb, 'Template_Import_Perusahaan_BAST.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setImportSuccessCount(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setFileError('File Excel tidak memiliki sheet yang dapat dibaca.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
      });

      if (!matrix || matrix.length === 0) {
        setFileError('File Excel kosong. Gunakan template yang disediakan.');
        return;
      }

      // Automatically detect the header row containing NO | NAMA PT | NAMA PEJABAT
      let headerRowIdx = -1;
      let colNo = -1;
      let colNamaPt = -1;
      let colNamaPejabat = -1;

      for (let r = 0; r < Math.min(10, matrix.length); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        const normalized = row.map((cell) =>
          String(cell ?? '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ')
        );

        const idxNo = normalized.findIndex((c) => c === 'NO' || c === 'NOMOR');
        const idxPt = normalized.findIndex(
          (c) => c === 'NAMA PT' || c === 'NAMA PERUSAHAAN'
        );
        const idxPejabat = normalized.findIndex(
          (c) => c === 'NAMA PEJABAT' || c === 'PEJABAT'
        );

        if (idxNo !== -1 && idxPt !== -1 && idxPejabat !== -1) {
          headerRowIdx = r;
          colNo = idxNo;
          colNamaPt = idxPt;
          colNamaPejabat = idxPejabat;
          break;
        }
      }

      if (headerRowIdx === -1) {
        setFileError(
          'Header kolom tidak sesuai. Pastikan baris header memiliki kolom persis: NO | NAMA PT | NAMA PEJABAT'
        );
        setParsedRows([]);
        return;
      }

      const existingMap = new Map<string, Company>();
      for (const comp of existingCompanies) {
        existingMap.set(comp.nama_pt.trim().toUpperCase(), comp);
      }

      const seenInFile = new Set<string>();
      const results: ParsedExcelRow[] = [];

      for (let r = headerRowIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;

        const rawNo = String(row[colNo] ?? '').trim();
        const rawPt = String(row[colNamaPt] ?? '').trim();
        const rawPejabat = String(row[colNamaPejabat] ?? '').trim();

        // Skip completely empty trailing rows
        if (!rawNo && !rawPt && !rawPejabat) continue;

        const parsedNo = Number(rawNo);
        const errors: string[] = [];

        if (!rawNo || isNaN(parsedNo) || parsedNo <= 0) {
          errors.push('Kolom NO harus berupa angka positif');
        }
        if (!rawPt) {
          errors.push('NAMA PT kosong');
        }
        if (!rawPejabat) {
          errors.push('NAMA PEJABAT kosong');
        }

        const ptKey = rawPt.toUpperCase();
        if (rawPt && seenInFile.has(ptKey)) {
          errors.push('Duplikat NAMA PT di dalam file Excel yang sama');
        }
        if (rawPt) {
          seenInFile.add(ptKey);
        }

        const existingMatch = rawPt ? existingMap.get(ptKey) : undefined;

        results.push({
          rowIndex: r + 1,
          rawNo,
          no: !isNaN(parsedNo) && parsedNo > 0 ? Math.floor(parsedNo) : null,
          nama_pt: rawPt,
          nama_pejabat: rawPejabat,
          isValid: errors.length === 0,
          errorReason: errors.length > 0 ? errors.join(', ') : null,
          existingCompany: existingMatch,
        });
      }

      if (results.length === 0) {
        setFileError('Tidak ditemukan baris data di bawah header Excel.');
        setParsedRows([]);
        return;
      }

      setParsedRows(results);
    } catch {
      setFileError(
        'Gagal membaca file Excel. Pastikan file berformat .xlsx yang valid.'
      );
      setParsedRows([]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const errorRows = parsedRows.filter((r) => !r.isValid);
  const duplicateRows = validRows.filter((r) => Boolean(r.existingCompany));

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setFileError(null);
    let importedCount = 0;

    try {
      for (const row of validRows) {
        if (row.existingCompany) {
          if (duplicateAction === 'skip') {
            continue;
          } else if (duplicateAction === 'update') {
            await onSaveCompany(
              {
                ...row.existingCompany,
                no: row.no || row.existingCompany.no || 1,
                nama_pt: row.nama_pt,
                nama_pejabat: row.nama_pejabat,
              },
              true
            );
            importedCount++;
            continue;
          }
          // If 'create_new', fall through and create a new company record
        }

        await onSaveCompany(
          {
            id: generateSafeId('comp'),
            user_id: uid,
            no: row.no || 1,
            nama_pt: row.nama_pt,
            nama_pejabat: row.nama_pejabat,
            jabatan_pejabat: '',
            alamat: '',
            kota: '',
            kode_pos: '',
            telepon: '',
            email: '',
            logo: '',
          },
          false
        );
        importedCount++;
      }

      setImportSuccessCount(importedCount);
      setParsedRows([]);
    } catch {
      setFileError('Terjadi kesalahan saat menyimpan data ke database cloud.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Import Data Perusahaan (Excel)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unduh template resmi .xlsx, isi daftar perusahaan, lalu periksa preview sebelum konfirmasi import
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 flex items-center gap-2 shadow-xs"
        >
          <Download className="w-4 h-4" />
          Download Template Excel (.xlsx)
        </button>
      </div>

      {/* Format Specification Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Format Header Wajib Template Excel
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          File Excel (.xlsx) wajib memiliki 3 kolom utama berikut. Alamat dan detail lainnya dapat dilengkapi setelah import:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse border border-slate-200 dark:border-slate-700">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 w-16 text-center">
                  NO
                </th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">
                  NAMA PT
                </th>
                <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left">
                  NAMA PEJABAT
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-700 dark:text-slate-300">
              <tr>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                  1
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                  PT. KANSAI PAINT INDONESIA
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                  MUHAMAD RIDHO
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                  2
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                  PT. CONTOH INDONESIA
                </td>
                <td className="border border-slate-200 dark:border-slate-700 px-3 py-2">
                  BUDI SANTOSO
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Box */}
      <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Pilih File Excel (.xlsx) untuk Diimport
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Data tidak akan langsung dimasukkan sebelum Anda memeriksa tabel preview dan menekan tombol Konfirmasi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Pilih File Excel (.xlsx)
        </button>
      </div>

      {fileError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="font-medium">{fileError}</span>
        </div>
      )}

      {importSuccessCount !== null && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              Berhasil mengimport {importSuccessCount} data perusahaan ke database cloud!
            </span>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800"
          >
            Lihat Data Perusahaan &rarr;
          </button>
        </div>
      )}

      {/* PREVIEW & VALIDATION RESULTS */}
      {parsedRows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Preview &amp; Validasi Import: {fileName}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Total Baris: {parsedRows.length} · Data Valid: {validRows.length}{' '}
                · Data Error: {errorRows.length} · Sudah Ada di DB:{' '}
                {duplicateRows.length}
              </p>
            </div>
          </div>

          {/* Summary Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Data Valid
              </p>
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200 font-mono tabular-nums mt-0.5">
                {validRows.length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                Nama PT Sudah Ada
              </p>
              <p className="text-xl font-bold text-amber-900 dark:text-amber-200 font-mono tabular-nums mt-0.5">
                {duplicateRows.length}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-xs text-red-800 dark:text-red-300 font-medium">
                Data Error
              </p>
              <p className="text-xl font-bold text-red-900 dark:text-red-200 font-mono tabular-nums mt-0.5">
                {errorRows.length}
              </p>
            </div>
          </div>

          {/* Conflict Resolution Selector when duplicate company names exist */}
          {duplicateRows.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2.5">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                 ditemukan {duplicateRows.length} Nama Perusahaan yang sudah ada di database. Pilih tindakan:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDuplicateAction('skip')}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                    duplicateAction === 'skip'
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300'
                  }`}
                >
                  1. Lewati (Jangan ubah)
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateAction('update')}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                    duplicateAction === 'update'
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300'
                  }`}
                >
                  2. Update Data Pejabat/No
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateAction('create_new')}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                    duplicateAction === 'create_new'
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300'
                  }`}
                >
                  3. Buat Sebagai Data Baru
                </button>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr className="text-left text-slate-700 dark:text-slate-200">
                  <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 w-16">
                    NO
                  </th>
                  <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                    NAMA PT
                  </th>
                  <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                    NAMA PEJABAT
                  </th>
                  <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                    STATUS VALIDASI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parsedRows.map((r) => (
                  <tr
                    key={r.rowIndex}
                    className={
                      !r.isValid
                        ? 'bg-red-50/50 dark:bg-red-950/20'
                        : r.existingCompany
                        ? 'bg-amber-50/40 dark:bg-amber-950/15'
                        : ''
                    }
                  >
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {r.rawNo || '-'}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                      {r.nama_pt || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {r.nama_pejabat || '-'}
                    </td>
                    <td className="px-3 py-2">
                      {!r.isValid ? (
                        <span className="text-red-600 font-medium">
                          Error: {r.errorReason}
                        </span>
                      ) : r.existingCompany ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Sudah ada di DB (
                          {duplicateAction === 'skip'
                            ? 'Akan dilewati'
                            : duplicateAction === 'update'
                            ? 'Akan diupdate'
                            : 'Dibuat baru'}
                          )
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          Valid (Siap diimport)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confirmation Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setParsedRows([])}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={importing || validRows.length === 0}
              onClick={handleConfirmImport}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-2 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Konfirmasi &amp; Import {validRows.length} Data Valid ke Database
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
