import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building2,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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
  generateNomorBast,
  generateSafeId,
  getKalimatTanggalBast,
  getUniqueNextNomorBast,
} from '../utils/formatters';
import { showQuickPopup } from '../utils/quickPopup';
import { BastPreviewModal } from './BastPreviewModal';
import { SignatureControl } from './SignatureControl';

interface BastFormViewProps {
  uid: string;
  companies: Company[];
  settings: AppSettings;
  existingBast?: BastDocument | null;
  existingItems?: BastItem[];
  allBastDocuments: BastDocument[];
  onSave: (
    bastData: Omit<BastDocument, 'created_at' | 'updated_at'>,
    itemsData: Array<{
      id?: string;
      nomor: number;
      nama_barang_jasa: string;
      keterangan: string;
      urutan: number;
    }>,
    incrementCounter: boolean
  ) => Promise<void>;
  onQuickSaveCompany: (company: Omit<Company, 'created_at' | 'updated_at'>) => Promise<Company>;
  onCancel: () => void;
}

interface EditableItem {
  id: string;
  nama_barang_jasa: string;
  keterangan: string;
}

export const BastFormView: React.FC<BastFormViewProps> = ({
  uid,
  companies,
  settings,
  existingBast,
  existingItems = [],
  allBastDocuments,
  onSave,
  onQuickSaveCompany,
  onCancel,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const isEditing = Boolean(
    existingBast && existingBast.nomor_bast.trim() !== ''
  );

  const [useAutoNumber, setUseAutoNumber] = useState<boolean>(
    existingBast ? false : settings.auto_number_enabled
  );
  const [nomorBast, setNomorBast] = useState<string>(
    existingBast?.nomor_bast || ''
  );
  const [tanggalBast, setTanggalBast] = useState<string>(
    existingBast?.tanggal_bast || todayIso
  );
  const [kota, setKota] = useState<string>(
    existingBast?.kota || settings.kota || 'Bogor'
  );

  // Pihak Pertama
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    existingBast?.company_id || ''
  );
  const [pihakPertamaPt, setPihakPertamaPt] = useState<string>(
    existingBast?.pihak_pertama_pt || ''
  );
  const [pihakPertamaNama, setPihakPertamaNama] = useState<string>(
    existingBast?.pihak_pertama_nama || ''
  );
  const [pihakPertamaJabatan, setPihakPertamaJabatan] = useState<string>(
    existingBast?.pihak_pertama_jabatan || ''
  );
  const [pihakPertamaAlamat, setPihakPertamaAlamat] = useState<string>(
    existingBast?.pihak_pertama_alamat || ''
  );

  // Pihak Kedua
  const [pihakKeduaNama, setPihakKeduaNama] = useState<string>(
    existingBast?.pihak_kedua_nama ||
      settings.default_pihak_kedua_nama ||
      'MUHAMAD RIDHO'
  );
  const [pihakKeduaJabatan, setPihakKeduaJabatan] = useState<string>(
    existingBast?.pihak_kedua_jabatan ||
      settings.default_pihak_kedua_jabatan ||
      'Teknisi / Pelaksana'
  );
  const [pihakKeduaAlamat, setPihakKeduaAlamat] = useState<string>(
    existingBast?.pihak_kedua_alamat ||
      settings.default_pihak_kedua_alamat ||
      settings.alamat ||
      ''
  );

  // Pekerjaan
  const [nomorPo, setNomorPo] = useState<string>(existingBast?.nomor_po || '');
  const [deskripsiPekerjaan, setDeskripsiPekerjaan] = useState<string>(
    existingBast?.deskripsi_pekerjaan || ''
  );
  const [tanggalMulai, setTanggalMulai] = useState<string>(
    existingBast?.tanggal_mulai || todayIso
  );
  const [tanggalSelesai, setTanggalSelesai] = useState<string>(
    existingBast?.tanggal_selesai || todayIso
  );

  // Default 4 rows matching the official BAST reference
  const getDefaultFourItems = (): EditableItem[] => [
    {
      id: generateSafeId('item'),
      nama_barang_jasa:
        'Rewinding Motor Fan Outdoor AC Floor Standing 10 PK Fuji Elektrik',
      keterangan: 'Sesuai',
    },
    {
      id: generateSafeId('item'),
      nama_barang_jasa: 'Kapasitor Fan Outdoor 10uf mc',
      keterangan: 'Sesuai',
    },
    {
      id: generateSafeId('item'),
      nama_barang_jasa: 'Bearing Koyo Japan',
      keterangan: 'Sesuai',
    },
    {
      id: generateSafeId('item'),
      nama_barang_jasa: 'Jasa Perbaikan dan Bongkar Pasang',
      keterangan: 'Sesuai',
    },
  ];

  // Items
  const [items, setItems] = useState<EditableItem[]>(() => {
    if (existingItems.length > 0) {
      return [...existingItems]
        .sort((a, b) => a.urutan - b.urutan || a.nomor - b.nomor)
        .map((it) => ({
          id: it.id,
          nama_barang_jasa: it.nama_barang_jasa,
          keterangan: it.keterangan || 'Sesuai',
        }));
    }
    return getDefaultFourItems();
  });

  // Sync items if existingItems loads asynchronously when editing an existing BAST
  useEffect(() => {
    if (existingItems.length > 0) {
      setItems(
        [...existingItems]
          .sort((a, b) => a.urutan - b.urutan || a.nomor - b.nomor)
          .map((it) => ({
            id: it.id,
            nama_barang_jasa: it.nama_barang_jasa,
            keterangan: it.keterangan || 'Sesuai',
          }))
      );
    }
  }, [existingBast?.id, existingItems.length]);

  // Signatures & Stamp - synchronized with Pengaturan so user never does double work
  const [signatureParty1, setSignatureParty1] = useState<string>(
    existingBast?.signature_party_1 || settings.signature_party_1 || ''
  );
  const [signatureParty2, setSignatureParty2] = useState<string>(
    existingBast?.signature_party_2 || settings.signature_party_2 || ''
  );
  const [useStempel, setUseStempel] = useState<boolean>(
    existingBast ? existingBast.use_stempel : true
  );

  // Automatically keep Pihak Kedua signature synchronized from Pengaturan for new BASTs or if empty
  useEffect(() => {
    if (!existingBast && !signatureParty2 && settings.signature_party_2) {
      setSignatureParty2(settings.signature_party_2);
    }
  }, [settings.signature_party_2, existingBast, signatureParty2]);

  const [status, setStatus] = useState<BastStatus>(
    existingBast?.status || 'Draft'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<BastStatus | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [companySavedToast, setCompanySavedToast] = useState(false);

  // Check if current nomor_bast is already used by another document
  const isDuplicateNomor = useMemo(() => {
    const clean = nomorBast.trim().toUpperCase();
    if (!clean) return false;
    return allBastDocuments.some(
      (b) =>
        b.nomor_bast.trim().toUpperCase() === clean &&
        b.id !== existingBast?.id
    );
  }, [nomorBast, allBastDocuments, existingBast?.id]);

  const duplicateExistingBast = useMemo(() => {
    const clean = nomorBast.trim().toUpperCase();
    if (!clean) return null;
    return (
      allBastDocuments.find(
        (b) =>
          b.nomor_bast.trim().toUpperCase() === clean &&
          b.id !== existingBast?.id
      ) || null
    );
  }, [nomorBast, allBastDocuments, existingBast?.id]);

  const handleGenerateUniqueNomor = () => {
    const existingSet = new Set(
      allBastDocuments
        .filter((b) => b.id !== existingBast?.id)
        .map((b) => b.nomor_bast.trim().toUpperCase())
    );
    const { nomor } = getUniqueNextNomorBast(
      settings.auto_number_format,
      Math.max(1, settings.auto_number_counter || 1),
      tanggalBast || todayIso,
      existingSet
    );
    setNomorBast(nomor);
    setUseAutoNumber(false);
    showQuickPopup(`Nomor BAST unik baru: ${nomor}`, 'success');
  };

  // Generate unique automatic BAST number when useAutoNumber or tanggalBast changes
  useEffect(() => {
    if (!isEditing && useAutoNumber) {
      let counter = Math.max(1, settings.auto_number_counter || 1);
      const existingNumbers = new Set(
        allBastDocuments.map((d) => d.nomor_bast.trim().toUpperCase())
      );
      const { nomor } = getUniqueNextNomorBast(
        settings.auto_number_format,
        counter,
        tanggalBast || todayIso,
        existingNumbers
      );
      setNomorBast(nomor);
    }
  }, [
    isEditing,
    useAutoNumber,
    tanggalBast,
    todayIso,
    settings.auto_number_counter,
    settings.auto_number_format,
    allBastDocuments,
  ]);

  const handleSelectCompany = (compId: string) => {
    setSelectedCompanyId(compId);
    const found = companies.find((c) => c.id === compId);
    if (found) {
      setPihakPertamaPt(found.nama_pt);
      setPihakPertamaNama(found.nama_pejabat);
      setPihakPertamaJabatan(found.jabatan_pejabat || '');
      const fullAddr = [
        found.alamat,
        found.kota,
        found.kode_pos,
      ]
        .map((s) => s?.trim())
        .filter(Boolean)
        .join(', ');
      if (fullAddr) {
        setPihakPertamaAlamat(fullAddr);
      }
    }
  };

  const handleSaveCurrentAsCompany = async () => {
    if (!pihakPertamaPt.trim() || !pihakPertamaNama.trim()) {
      setErrorMsg(
        'Isi Nama PT dan Nama Pejabat terlebih dahulu untuk menyimpan ke Database Perusahaan.'
      );
      return;
    }
    const nextNo =
      companies.reduce((max, c) => Math.max(max, c.no || 0), 0) + 1;
    const newComp = await onQuickSaveCompany({
      id: generateSafeId('comp'),
      user_id: uid,
      no: nextNo,
      nama_pt: pihakPertamaPt.trim(),
      nama_pejabat: pihakPertamaNama.trim(),
      jabatan_pejabat: pihakPertamaJabatan.trim(),
      alamat: pihakPertamaAlamat.trim(),
      kota: kota.trim(),
      kode_pos: '',
      telepon: '',
      email: '',
      logo: '',
    });
    setSelectedCompanyId(newComp.id);
    setCompanySavedToast(true);
    showQuickPopup('Data Perusahaan berhasil disimpan ke Database PT!', 'success');
    setTimeout(() => setCompanySavedToast(false), 3000);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateSafeId('item'),
        nama_barang_jasa: '',
        keterangan: 'Sesuai',
      },
    ]);
    showQuickPopup('Baris rincian baru ditambahkan', 'info');
  };

  const handleLoadExampleItems = () => {
    setItems(getDefaultFourItems());
    showQuickPopup('4 Baris rincian default dimuat', 'success');
  };

  const handleResetToSingleEmptyRow = () => {
    setItems([
      {
        id: generateSafeId('item'),
        nama_barang_jasa: '',
        keterangan: 'Sesuai',
      },
    ]);
    showQuickPopup('Rincian dikosongkan menjadi 1 baris', 'info');
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
    showQuickPopup(`Baris rincian #${idx + 1} dihapus`, 'info');
  };

  const handleMoveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = temp;
      return copy;
    });
    showQuickPopup('Urutan baris rincian dipindahkan', 'info');
  };

  const handleItemChange = (
    idx: number,
    field: 'nama_barang_jasa' | 'keterangan',
    val: string
  ) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    );
  };

  const validateForm = (targetStatus: BastStatus): string | null => {
    if (isDuplicateNomor) {
      const info = duplicateExistingBast
        ? ` (sudah terpakai pada BAST tertanggal ${duplicateExistingBast.tanggal_bast} untuk ${duplicateExistingBast.pihak_pertama_pt})`
        : '';
      return `Nomor BAST "${nomorBast.trim()}" sudah pernah digunakan${info}! Nomor BAST tidak boleh dipakai 2x. Silakan ubah nomor BAST atau klik tombol "Buat Nomor Unik".`;
    }
    if (!pihakPertamaPt.trim()) {
      return 'Nama PT / Perusahaan (Pihak Pertama) wajib diisi.';
    }
    if (targetStatus === 'Selesai' && !pihakPertamaNama.trim()) {
      return 'Nama Pejabat / Perwakilan (Pihak Pertama) wajib diisi.';
    }

    const validItems = items.filter((it) => it.nama_barang_jasa.trim() !== '');
    if (validItems.length === 0) {
      return 'Minimal satu baris Rincian Barang / Jasa harus diisi.';
    }
    return null;
  };

  const buildCurrentObjects = (
    targetStatus: BastStatus
  ): {
    bast: BastDocument;
    itemsList: BastItem[];
  } => {
    const bastId = existingBast?.id || generateSafeId('bast');
    const nowIso = new Date().toISOString();
    const validItems = items.filter((it) => it.nama_barang_jasa.trim() !== '');
    const sourceItems = validItems.length > 0 ? validItems : items;

    const finalNomorBast =
      nomorBast.trim() ||
      generateNomorBast(
        settings.auto_number_format,
        Math.max(1, settings.auto_number_counter || 1),
        tanggalBast || todayIso
      );

    const bastObj: BastDocument = {
      id: bastId,
      user_id: uid,
      nomor_bast: finalNomorBast,
      tanggal_bast: tanggalBast.trim() || todayIso,
      kota: kota.trim() || settings.kota || 'Bogor',
      company_id: selectedCompanyId,
      pihak_pertama_pt: pihakPertamaPt.trim() || '-',
      pihak_pertama_nama: pihakPertamaNama.trim() || '-',
      pihak_pertama_jabatan: pihakPertamaJabatan.trim(),
      pihak_pertama_alamat: pihakPertamaAlamat.trim() || '-',
      pihak_kedua_nama:
        pihakKeduaNama.trim() ||
        settings.default_pihak_kedua_nama ||
        'MUHAMAD RIDHO',
      pihak_kedua_jabatan: pihakKeduaJabatan.trim(),
      pihak_kedua_alamat:
        pihakKeduaAlamat.trim() ||
        settings.default_pihak_kedua_alamat ||
        settings.alamat ||
        '-',
      nomor_po: nomorPo.trim(),
      deskripsi_pekerjaan: deskripsiPekerjaan.trim(),
      tanggal_mulai: tanggalMulai.trim() || tanggalBast.trim() || todayIso,
      tanggal_selesai: tanggalSelesai.trim() || tanggalBast.trim() || todayIso,
      status: targetStatus,
      signature_party_1:
        signatureParty1 || (!existingBast ? (settings.signature_party_1 || '') : ''),
      signature_party_2:
        signatureParty2 || settings.signature_party_2 || '',
      use_stempel: useStempel,
      created_at: existingBast?.created_at || nowIso,
      updated_at: nowIso,
    };

    const itemsList: BastItem[] = sourceItems.map((it, idx) => ({
      id: it.id,
      user_id: uid,
      bast_id: bastId,
      nomor: idx + 1,
      nama_barang_jasa: it.nama_barang_jasa.trim() || '-',
      keterangan: it.keterangan.trim() || 'Sesuai',
      urutan: idx,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    return { bast: bastObj, itemsList };
  };

  const handleOpenPreview = () => {
    setErrorMsg(null);
    setShowPreview(true);
    showQuickPopup('Membuka VIEW PDF A4...', 'info');
  };

  const handleSaveSubmit = async (targetStatus: BastStatus) => {
    setErrorMsg(null);
    const validationErr = validateForm(targetStatus);
    if (validationErr) {
      setErrorMsg(validationErr);
      showQuickPopup(validationErr, 'warning');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSavingState(targetStatus);
    try {
      const { bast, itemsList } = buildCurrentObjects(targetStatus);
      await onSave(
        bast,
        itemsList,
        !isEditing && useAutoNumber
      );
      showQuickPopup(
        `Dokumen BAST (${targetStatus}) berhasil disimpan!`,
        'success'
      );
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Data gagal disimpan. Silakan coba lagi.';
      setErrorMsg(msg);
      showQuickPopup(msg, 'warning');
    } finally {
      setSavingState(null);
    }
  };

  const { kalimatLengkap } = getKalimatTanggalBast(tanggalBast);
  const previewData = buildCurrentObjects(status);

  return (
    <div className="space-y-6 pb-24">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Dokumen BAST' : 'Buat BAST Baru'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Lengkapi formulir di bawah untuk menghasilkan dokumen BAST resmi ukuran A4
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenPreview}
          className="min-h-[44px] px-4 py-2.5 rounded-xl border border-blue-800 text-blue-900 dark:text-blue-300 dark:border-blue-500 text-xs font-bold hover:bg-blue-50 flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          VIEW PDF
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="font-medium leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {companySavedToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Data perusahaan berhasil disimpan ke Database Perusahaan.</span>
        </div>
      )}

      {/* SECTION A: IDENTITAS DOKUMEN */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            A. Identitas Dokumen
          </h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            Status: {status}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nomor BAST *
              </label>
              <div className="flex items-center gap-1.5">
                {isDuplicateNomor && (
                  <button
                    type="button"
                    onClick={handleGenerateUniqueNomor}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                    title="Buat nomor unik baru yang belum pernah dipakai"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Buat Nomor Unik
                  </button>
                )}
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setUseAutoNumber(!useAutoNumber)}
                    className="text-[11px] font-semibold text-blue-800 dark:text-blue-400 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {useAutoNumber ? 'Mode Otomatis' : 'Mode Manual'}
                  </button>
                )}
              </div>
            </div>
            <input
              type="text"
              value={nomorBast}
              onChange={(e) => {
                setUseAutoNumber(false);
                setNomorBast(e.target.value);
              }}
              placeholder="Contoh: BAST/001/X/2026"
              className={`w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 rounded-xl text-slate-900 dark:text-white transition ${
                isDuplicateNomor
                  ? 'border-2 border-red-500 focus:border-red-600 ring-2 ring-red-100 dark:ring-red-950/40 text-red-950 dark:text-red-200'
                  : 'border border-slate-300 dark:border-slate-700'
              }`}
            />
            {isDuplicateNomor && (
              <div className="mt-1.5 p-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 flex items-start gap-1.5 text-[11px] text-red-800 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <span className="font-bold">Nomor BAST sudah pernah dipakai!</span>{' '}
                  Nomor BAST tidak boleh dipakai 2x.{' '}
                  <button
                    type="button"
                    onClick={handleGenerateUniqueNomor}
                    className="underline font-bold text-red-900 dark:text-red-200 ml-1 hover:text-red-700"
                  >
                    Ganti ke nomor unik
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tanggal BAST *
            </label>
            <input
              type="date"
              value={tanggalBast}
              onChange={(e) => setTanggalBast(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kota Penerbitan *
            </label>
            <input
              type="text"
              value={kota}
              onChange={(e) => setKota(e.target.value)}
              placeholder="Contoh: Bogor"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Live Terbilang Preview */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Kalimat Pembuka Otomatis:{' '}
          </span>
          {kalimatLengkap}
        </div>
      </section>

      {/* SECTION B: PIHAK PERTAMA */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              B. Pihak Pertama (Perusahaan Pemberi Kerja / Klien)
            </h2>
            <p className="text-xs text-slate-500">
              Pilih dari database perusahaan agar terisi otomatis, atau ketik manual
            </p>
          </div>
          {!selectedCompanyId && pihakPertamaPt.trim() && (
            <button
              type="button"
              onClick={handleSaveCurrentAsCompany}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-blue-900 dark:text-blue-300 hover:bg-slate-200 flex items-center gap-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              + Simpan ke Data Perusahaan
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pilih dari Database Perusahaan ({companies.length} perusahaan tersedia)
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => handleSelectCompany(e.target.value)}
            className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          >
            <option value="">-- Ketik Manual / Pilih Perusahaan --</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.no}. {c.nama_pt} — {c.nama_pejabat}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama PT / Perusahaan *
            </label>
            <input
              type="text"
              value={pihakPertamaPt}
              onChange={(e) => setPihakPertamaPt(e.target.value)}
              placeholder="Contoh: PT. KANSAI PAINT INDONESIA"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Pejabat / Perwakilan *
            </label>
            <input
              type="text"
              value={pihakPertamaNama}
              onChange={(e) => setPihakPertamaNama(e.target.value)}
              placeholder="Contoh: Bapak / Ibu Perwakilan PT"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jabatan Pejabat (Opsional)
            </label>
            <input
              type="text"
              value={pihakPertamaJabatan}
              onChange={(e) => setPihakPertamaJabatan(e.target.value)}
              placeholder="Contoh: Supervisor Maintenance / Purchasing"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Lengkap Perusahaan *
            </label>
            <textarea
              rows={2}
              value={pihakPertamaAlamat}
              onChange={(e) => setPihakPertamaAlamat(e.target.value)}
              placeholder="Contoh: Blok DD-7 & DD-6 Kawasan Industri MM2100 Cikarang Barat Kab. Bekasi, 17847"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* SECTION C: PIHAK KEDUA */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            C. Pihak Kedua (Pelaksana / Penyerah Pekerjaan)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Lengkap *
            </label>
            <input
              type="text"
              value={pihakKeduaNama}
              onChange={(e) => setPihakKeduaNama(e.target.value)}
              placeholder="Contoh: MUHAMAD RIDHO"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jabatan (Opsional)
            </label>
            <input
              type="text"
              value={pihakKeduaJabatan}
              onChange={(e) => setPihakKeduaJabatan(e.target.value)}
              placeholder="Contoh: Teknisi / Pelaksana"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Pihak Kedua *
            </label>
            <textarea
              rows={2}
              value={pihakKeduaAlamat}
              onChange={(e) => setPihakKeduaAlamat(e.target.value)}
              placeholder="Contoh: Jln. Letda Nasir No. 58 Bogor, 16966 Kel. Cikeas Udik Kec. Gunung Putri Bogor"
              className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* SECTION D: PEKERJAAN */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            D. Informasi Pekerjaan &amp; Nomor PO
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nomor PO (Opsional)
            </label>
            <input
              type="text"
              value={nomorPo}
              onChange={(e) => setNomorPo(e.target.value)}
              placeholder="Contoh: KPIN-MIS-2503-035"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Deskripsi Singkat Pekerjaan (Opsional)
            </label>
            <input
              type="text"
              value={deskripsiPekerjaan}
              onChange={(e) => setDeskripsiPekerjaan(e.target.value)}
              placeholder="Contoh: Perbaikan Unit AC Floor Standing 10 PK"
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tanggal Mulai Pekerjaan *
            </label>
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tanggal Selesai Pekerjaan *
            </label>
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* SECTION E: DETAIL BARANG / JASA */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                E. Rincian Barang / Jasa
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 text-[11px] font-mono font-bold text-blue-900 dark:text-blue-300">
                {items.length} Baris
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tambah, edit, hapus, atau ubah urutan baris rincian pekerjaan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadExampleItems}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Isi Default (4 Baris)
            </button>
            <button
              type="button"
              onClick={handleResetToSingleEmptyRow}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Kosongkan
            </button>
            <button
              type="button"
              onClick={handleAddItem}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Tambah Baris
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
            >
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-900/10 dark:bg-blue-900/40 text-blue-900 dark:text-blue-300 font-mono tabular-nums text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                {/* Mobile controls for reorder/delete */}
                <div className="flex sm:hidden items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveItem(idx, -1)}
                    disabled={idx === 0}
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 disabled:opacity-30"
                    title="Pindah ke atas"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveItem(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 disabled:opacity-30"
                    title="Pindah ke bawah"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-red-200 text-red-600 flex items-center justify-center disabled:opacity-30"
                    title="Hapus baris"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <input
                  type="text"
                  value={item.nama_barang_jasa}
                  onChange={(e) =>
                    handleItemChange(idx, 'nama_barang_jasa', e.target.value)
                  }
                  placeholder="Nama Barang / Jasa (Contoh: Rewinding Motor Fan Outdoor AC 10 PK)"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div className="w-full sm:w-44">
                <input
                  type="text"
                  value={item.keterangan}
                  onChange={(e) =>
                    handleItemChange(idx, 'keterangan', e.target.value)
                  }
                  placeholder="Keterangan (Sesuai)"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {/* Desktop controls */}
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveItem(idx, -1)}
                  disabled={idx === 0}
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  title="Pindah ke atas"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  title="Pindah ke bawah"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(idx)}
                  disabled={items.length <= 1}
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center disabled:opacity-30"
                  title="Hapus baris"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="w-full min-h-[44px] py-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-700 hover:text-blue-800 flex items-center justify-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" />
          Tambah Baris Barang / Jasa
        </button>
      </section>

      {/* SECTION F: TANDA TANGAN & STEMPEL */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                F. Tanda Tangan Digital &amp; Stempel
              </h2>
              {settings.signature_party_2 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  TTD Pihak 2 Sinkron Pengaturan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tanda tangan Pihak Kedua otomatis terisi dari menu Pengaturan akun Anda. Anda juga dapat mengupload file PNG/JPG atau coret layar langsung di sini.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            <input
              type="checkbox"
              checked={useStempel}
              onChange={(e) => setUseStempel(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-900"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Tampilkan Stempel Perusahaan pada PDF
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureControl
            label="Tanda Tangan Pihak Pertama (Klien)"
            subtitle="Tanda tangan perwakilan perusahaan klien"
            value={signatureParty1}
            onChange={setSignatureParty1}
            defaultSettingSignature={settings.signature_party_1}
            onUseDefaultFromSettings={
              settings.signature_party_1
                ? () => {
                    setSignatureParty1(settings.signature_party_1);
                    showQuickPopup('TTD Pihak 1 disinkronkan dari Pengaturan', 'info');
                  }
                : undefined
            }
          />
          <SignatureControl
            label="Tanda Tangan Pihak Kedua (Pelaksana)"
            subtitle={`Pelaksana pekerjaan (${settings.default_pihak_kedua_nama || 'MUHAMAD RIDHO'})`}
            value={signatureParty2}
            onChange={setSignatureParty2}
            defaultSettingSignature={settings.signature_party_2}
            onUseDefaultFromSettings={
              settings.signature_party_2
                ? () => {
                    setSignatureParty2(settings.signature_party_2);
                    showQuickPopup('TTD Pihak 2 disinkronkan dari Pengaturan!', 'success');
                  }
                : undefined
            }
          />
        </div>
      </section>

      {/* STICKY ACTION FOOTER */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleOpenPreview}
          className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-1.5"
        >
          <Eye className="w-4 h-4" />
          VIEW PDF
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={savingState !== null}
            onClick={() => handleSaveSubmit('Draft')}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
          >
            {savingState === 'Draft' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan Draft
          </button>

          <button
            type="button"
            disabled={savingState !== null}
            onClick={() => handleSaveSubmit('Selesai')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {savingState === 'Selesai' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Simpan &amp; Selesai
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <BastPreviewModal
          bast={previewData.bast}
          items={previewData.itemsList}
          settings={settings}
          onClose={() => setShowPreview(false)}
          onEdit={() => setShowPreview(false)}
          onSave={async () => {
            await handleSaveSubmit('Selesai');
            setShowPreview(false);
          }}
          isSaving={savingState !== null}
        />
      )}
    </div>
  );
};
