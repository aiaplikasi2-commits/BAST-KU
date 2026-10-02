import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Edit3,
  Loader2,
  Maximize2,
  Save,
  Share2,
  ZoomIn,
} from 'lucide-react';
import { AppSettings, BastDocument, BastItem } from '../types';
import {
  formatKopAddressLines,
  getCorporateEmblemDataUrl,
} from '../utils/defaultLogo';
import {
  formatTanggalIndonesia,
  getKalimatTanggalBast,
} from '../utils/formatters';
import { downloadBastPdf, shareBastPdf } from '../utils/pdfGenerator';

interface BastPreviewModalProps {
  bast: BastDocument;
  items: BastItem[];
  settings: AppSettings;
  onClose: () => void;
  onEdit?: () => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
}

const A4_WIDTH_PX = 794;
const A4_MIN_HEIGHT_PX = 1123;

export const BastPreviewModal: React.FC<BastPreviewModalProps> = ({
  bast,
  items,
  settings,
  onClose,
  onEdit,
  onSave,
  isSaving = false,
}) => {
  const [pdfBusy, setPdfBusy] = useState<'download' | 'share' | null>(null);
  const [fitMode, setFitMode] = useState<'full' | 'width' | '100'>('full');
  const [scale, setScale] = useState<number>(1);
  const [sheetHeight, setSheetHeight] = useState<number>(A4_MIN_HEIGHT_PX);

  const viewportRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const sortedItems = [...items].sort(
    (a, b) => a.urutan - b.urutan || a.nomor - b.nomor
  );

  // Auto-Fit calculation so the user can view the full A4 document cleanly on any screen
  useEffect(() => {
    const computeScale = () => {
      const vp = viewportRef.current;
      const sh = sheetRef.current;
      if (!vp) return;

      const availW = Math.max(240, vp.clientWidth - 24);
      const availH = Math.max(280, vp.clientHeight - 24);
      const actualSheetH = sh
        ? Math.max(A4_MIN_HEIGHT_PX, sh.scrollHeight)
        : A4_MIN_HEIGHT_PX;

      setSheetHeight(actualSheetH);

      if (fitMode === '100') {
        setScale(1);
      } else if (fitMode === 'width') {
        setScale(Math.min(1.15, availW / A4_WIDTH_PX));
      } else {
        // 'full': Fit entire A4 page (both width & height) into the screen
        const scaleW = availW / A4_WIDTH_PX;
        const scaleH = availH / actualSheetH;
        setScale(Math.min(1, scaleW, scaleH));
      }
    };

    computeScale();
    window.addEventListener('resize', computeScale);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(computeScale);
      if (viewportRef.current) ro.observe(viewportRef.current);
      if (sheetRef.current) ro.observe(sheetRef.current);
    }

    return () => {
      window.removeEventListener('resize', computeScale);
      if (ro) ro.disconnect();
    };
  }, [fitMode, sortedItems.length, bast, settings]);

  const { kalimatLengkap } = getKalimatTanggalBast(bast.tanggal_bast);
  const tglMulaiIndo = formatTanggalIndonesia(bast.tanggal_mulai);
  const tglSelesaiIndo = formatTanggalIndonesia(bast.tanggal_selesai);
  const tglBastIndo = formatTanggalIndonesia(bast.tanggal_bast);
  const kotaText = bast.kota?.trim() || settings.kota?.trim() || 'Bogor';

  const companyName =
    settings.nama_perusahaan?.trim() || 'CV. MULIA TEKHNIK ABADI';
  const companyAddress =
    settings.alamat?.trim() ||
    'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966';
  const balancedAddressLines = formatKopAddressLines(companyAddress);
  const logoSrc =
    settings.logo?.trim() || getCorporateEmblemDataUrl(companyName);

  const sig1Src =
    bast.signature_party_1?.trim() || settings.signature_party_1?.trim() || '';
  const sig2Src =
    bast.signature_party_2?.trim() || settings.signature_party_2?.trim() || '';
  const stempelSrc =
    bast.use_stempel && settings.stempel?.trim()
      ? settings.stempel.trim()
      : '';
  const stempelTarget = settings.stempel_target || 'pihak_kedua';
  const stempelScale = (settings.stempel_scale || 100) / 100;

  const handleDownloadPdf = async () => {
    setPdfBusy('download');
    try {
      await downloadBastPdf(bast, sortedItems, settings);
    } finally {
      setPdfBusy(null);
    }
  };

  const handleSharePdf = async () => {
    setPdfBusy('share');
    try {
      await shareBastPdf(bast, sortedItems, settings);
    } catch {
      // User cancelled native share sheet
    } finally {
      setPdfBusy(null);
    }
  };

  const poClause = bast.nomor_po?.trim()
    ? ` dengan nomor PO ${bast.nomor_po.trim()}`
    : '';
  const descClause = bast.deskripsi_pekerjaan?.trim()
    ? ` (${bast.deskripsi_pekerjaan.trim()})`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex flex-col overflow-hidden">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </button>
          <div className="hidden sm:block">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
              VIEW PDF — A4 Portrait ({Math.round(scale * 100)}%)
            </h3>
            <p className="text-[11px] text-slate-500 font-mono tabular-nums">
              {bast.nomor_bast} · {bast.status}
            </p>
          </div>
        </div>

        {/* Zoom / Auto-Fit Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFitMode('full')}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
              fitMode === 'full'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
            title="Auto Fit 1 Halaman Penuh"
          >
            <Maximize2 className="w-3 h-3" />
            Fit Full
          </button>
          <button
            type="button"
            onClick={() => setFitMode('width')}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
              fitMode === 'width'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Fit Lebar
          </button>
          <button
            type="button"
            onClick={() => setFitMode('100')}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition ${
              fitMode === '100'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <ZoomIn className="w-3 h-3" />
            100%
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
          )}

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Simpan
            </button>
          )}

          <button
            type="button"
            onClick={handleSharePdf}
            disabled={pdfBusy !== null}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-blue-800 text-blue-900 dark:text-blue-300 dark:border-blue-500 text-xs font-semibold hover:bg-blue-50 flex items-center gap-1.5"
          >
            {pdfBusy === 'share' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            Bagikan
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy !== null}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5 shadow-xs"
          >
            {pdfBusy === 'download' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download PDF
          </button>
        </div>
      </div>

      {/* Auto-Fitting A4 Sheet Viewport */}
      <div
        ref={viewportRef}
        className="flex-1 overflow-auto p-3 flex items-start justify-center bg-slate-800/90 dark:bg-slate-950"
      >
        {/* Outer sizing box that matches the scaled A4 dimensions so there is no dead whitespace */}
        <div
          style={{
            width: `${Math.round(A4_WIDTH_PX * scale)}px`,
            height: `${Math.round(sheetHeight * scale)}px`,
          }}
          className="relative shrink-0 my-auto transition-all duration-150"
        >
          {/* True A4 Portrait Sheet (794px x 1123px) */}
          <div
            ref={sheetRef}
            style={{
              width: `${A4_WIDTH_PX}px`,
              minHeight: `${A4_MIN_HEIGHT_PX}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              fontFamily:
                "'Carlito', Calibri, 'Plus Jakarta Sans', Arial, Helvetica, sans-serif",
            }}
            className="bg-white text-slate-900 shadow-2xl border border-slate-300 px-[58px] py-[44px] text-[14px] leading-[1.48]"
          >
            {/* KOP SURAT RESMI / PROFESSIONAL HEADER */}
            <div className="flex items-center gap-5 pb-3">
              {/* Left Logo Column */}
              <div className="w-[150px] shrink-0 flex items-center justify-center">
                <img
                  src={logoSrc}
                  alt="Logo Perusahaan"
                  referrerPolicy="no-referrer"
                  className="max-h-[86px] max-w-[148px] object-contain"
                />
              </div>

              {/* Right/Center Kop Identity Column */}
              <div className="flex-1 text-center pr-2">
                <h1 className="text-[22px] font-bold tracking-[0.02em] text-[#2B4F71] uppercase leading-tight">
                  {companyName}
                </h1>
                <div className="mt-1 space-y-0.5 text-[13px] text-slate-800 leading-[1.35]">
                  {balancedAddressLines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                {settings.email && (
                  <p className="text-[13px] font-bold text-[#2B4F71] mt-0.5 leading-snug">
                    email.{' '}
                    <span className="underline decoration-[#2B4F71] underline-offset-2">
                      {settings.email}
                    </span>
                  </p>
                )}
                {settings.telepon && (
                  <p className="text-[13px] font-bold text-slate-900 mt-0.5 leading-snug">
                    Tlp {settings.telepon}
                  </p>
                )}
              </div>
            </div>

            {/* Official Double Horizontal Line (Garis Kop Surat) */}
            <div className="border-t-[3px] border-slate-800 pt-[2px] mb-6">
              <div className="border-t border-slate-800" />
            </div>

            {/* DOCUMENT TITLE */}
            <div className="text-center mb-6">
              <h2 className="text-[16.5px] font-bold uppercase underline decoration-slate-900 underline-offset-[3px] tracking-[0.02em] text-slate-900">
                BERITA ACARA SERAH TERIMA
              </h2>
              {bast.nomor_bast && (
                <p className="text-[13.5px] text-slate-800 mt-1 font-normal">
                  Nomor : {bast.nomor_bast}
                </p>
              )}
            </div>

            {/* PEMBUKA OTOMATIS TERBILANG */}
            <p className="mb-4 text-justify leading-[1.55]">{kalimatLengkap}</p>

            {/* PIHAK PERTAMA */}
            <div className="mb-4">
              <p className="mb-1.5">Yang disebut Pihak Pertama,</p>
              <table className="w-full text-[14px] leading-[1.45]">
                <tbody>
                  <tr>
                    <td className="w-[140px] py-0.5 align-top">Nama</td>
                    <td className="w-[14px] py-0.5 align-top">:</td>
                    <td className="py-0.5 font-bold">
                      {bast.pihak_pertama_nama || '-'}
                    </td>
                  </tr>
                  {bast.pihak_pertama_jabatan && (
                    <tr>
                      <td className="py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5 align-top">:</td>
                      <td className="py-0.5">{bast.pihak_pertama_jabatan}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5 align-top">Perusahaan</td>
                    <td className="py-0.5 align-top">:</td>
                    <td className="py-0.5 font-bold">
                      {bast.pihak_pertama_pt || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 align-top">Alamat</td>
                    <td className="py-0.5 align-top">:</td>
                    <td className="py-0.5">
                      {bast.pihak_pertama_alamat || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* PIHAK KEDUA */}
            <div className="mb-5">
              <p className="mb-1.5">Selanjutnya disebut Pihak Kedua,</p>
              <table className="w-full text-[14px] leading-[1.45]">
                <tbody>
                  <tr>
                    <td className="w-[140px] py-0.5 align-top">Nama</td>
                    <td className="w-[14px] py-0.5 align-top">:</td>
                    <td className="py-0.5 font-bold">
                      {bast.pihak_kedua_nama || '-'}
                    </td>
                  </tr>
                  {bast.pihak_kedua_jabatan && (
                    <tr>
                      <td className="py-0.5 align-top">Jabatan</td>
                      <td className="py-0.5 align-top">:</td>
                      <td className="py-0.5">{bast.pihak_kedua_jabatan}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5 align-top">Alamat</td>
                    <td className="py-0.5 align-top">:</td>
                    <td className="py-0.5">{bast.pihak_kedua_alamat || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ISI BERITA ACARA */}
            <p className="mb-3 text-justify leading-[1.55]">
              Dengan ini menerangkan bahwa pekerjaan
              {poClause ? <strong>{poClause}</strong> : ''}
              {descClause} telah selesai dikerjakan dengan rincian sebagai
              berikut :
            </p>

            {/* TABEL BARANG / JASA */}
            <div className="mb-6">
              <table className="w-full border-collapse border border-slate-900 text-[14px]">
                <thead>
                  <tr className="bg-slate-50/70">
                    <th className="border border-slate-900 px-2.5 py-2 w-[52px] text-center font-bold">
                      No
                    </th>
                    <th className="border border-slate-900 px-3.5 py-2 text-center font-bold">
                      Nama Barang / Jasa
                    </th>
                    <th className="border border-slate-900 px-3 py-2 w-[135px] text-center font-bold">
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="border border-slate-900 px-2.5 py-2 text-center">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 px-3.5 py-2">
                        {it.nama_barang_jasa}
                      </td>
                      <td className="border border-slate-900 px-3 py-2 text-center italic">
                        {it.keterangan || 'Sesuai'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PARAGRAF PENUTUP */}
            <p className="mb-3 text-justify leading-[1.55]">
              Telah selesai dikerjakan oleh Pihak Kedua yang dimulai pada
              tanggal <strong>{tglMulaiIndo}</strong> dan selesai pada tanggal{' '}
              <strong>{tglSelesaiIndo}</strong> dan selanjutnya diserahkan
              kepada Pihak Pertama dalam kondisi baik dan berfungsi.
            </p>
            <p className="mb-8 text-justify leading-[1.55]">
              Demikian Berita Acara Serah Terima ini dibuat untuk dapat
              digunakan sebagaimana mestinya.
            </p>

            {/* TANDA TANGAN & STEMPEL */}
            <div className="grid grid-cols-2 gap-8 pt-2">
              {/* Pihak Pertama */}
              <div>
                <p className="mb-0.5">
                  {kotaText}, {tglBastIndo}
                </p>
                <p className="mb-2">Pihak Pertama</p>

                <div className="relative h-24 flex items-center">
                  {sig1Src && (
                    <img
                      src={sig1Src}
                      alt="Tanda Tangan Pihak Pertama"
                      referrerPolicy="no-referrer"
                      className="max-h-20 max-w-[165px] object-contain z-10"
                    />
                  )}
                  {stempelSrc &&
                    (stempelTarget === 'pihak_pertama' ||
                      stempelTarget === 'both') && (
                      <img
                        src={stempelSrc}
                        alt="Stempel"
                        referrerPolicy="no-referrer"
                        style={{
                          transform: `translate(${
                            settings.stempel_x || 0
                          }px, ${
                            settings.stempel_y || 0
                          }px) scale(${stempelScale})`,
                        }}
                        className="absolute left-4 top-1 max-h-20 max-w-[135px] object-contain opacity-90 pointer-events-none z-20"
                      />
                    )}
                </div>

                <p className="font-bold uppercase mt-1">
                  {bast.pihak_pertama_nama || bast.pihak_pertama_pt}
                </p>
                <p className="text-[12.5px] text-slate-700">
                  {bast.pihak_pertama_jabatan || bast.pihak_pertama_pt}
                </p>
              </div>

              {/* Pihak Kedua */}
              <div className="pl-12">
                <p className="mb-0.5 invisible select-none">
                  {kotaText}, {tglBastIndo}
                </p>
                <p className="mb-2">Pihak Kedua</p>

                <div className="relative h-24 flex items-center">
                  {sig2Src && (
                    <img
                      src={sig2Src}
                      alt="Tanda Tangan Pihak Kedua"
                      referrerPolicy="no-referrer"
                      className="max-h-20 max-w-[165px] object-contain z-10"
                    />
                  )}
                  {stempelSrc &&
                    (stempelTarget === 'pihak_kedua' ||
                      stempelTarget === 'both') && (
                      <img
                        src={stempelSrc}
                        alt="Stempel"
                        referrerPolicy="no-referrer"
                        style={{
                          transform: `translate(${
                            settings.stempel_x || 0
                          }px, ${
                            settings.stempel_y || 0
                          }px) scale(${stempelScale})`,
                        }}
                        className="absolute left-2 top-1 max-h-20 max-w-[135px] object-contain opacity-90 pointer-events-none z-20"
                      />
                    )}
                </div>

                <p className="font-bold uppercase mt-1">
                  {bast.pihak_kedua_nama}
                </p>
                {bast.pihak_kedua_jabatan && (
                  <p className="text-[12.5px] text-slate-700">
                    {bast.pihak_kedua_jabatan}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
