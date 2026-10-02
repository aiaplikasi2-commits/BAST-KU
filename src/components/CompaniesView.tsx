import React, { useState } from 'react';
import {
  Building2,
  Edit3,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Company } from '../types';
import { generateSafeId } from '../utils/formatters';
import { showQuickPopup } from '../utils/quickPopup';

interface CompaniesViewProps {
  uid: string;
  companies: Company[];
  onSaveCompany: (
    company: Omit<Company, 'created_at' | 'updated_at'>,
    isUpdate: boolean
  ) => Promise<void>;
  onDeleteCompany: (companyId: string) => Promise<void>;
  onOpenImportExcel: () => void;
  onCreateBastForCompany: (company: Company) => void;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  uid,
  companies,
  onSaveCompany,
  onDeleteCompany,
  onOpenImportExcel,
  onCreateBastForCompany,
}) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [no, setNo] = useState<number>(1);
  const [namaPt, setNamaPt] = useState('');
  const [namaPejabat, setNamaPejabat] = useState('');
  const [jabatanPejabat, setJabatanPejabat] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kota, setKota] = useState('');
  const [kodePos, setKodePos] = useState('');
  const [telepon, setTelepon] = useState('');
  const [email, setEmail] = useState('');

  const openAddModal = () => {
    const nextNo =
      companies.reduce((max, c) => Math.max(max, c.no || 0), 0) + 1;
    setEditingCompany(null);
    setNo(nextNo);
    setNamaPt('');
    setNamaPejabat('');
    setJabatanPejabat('');
    setAlamat('');
    setKota('');
    setKodePos('');
    setTelepon('');
    setEmail('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (comp: Company) => {
    setEditingCompany(comp);
    setNo(comp.no || 1);
    setNamaPt(comp.nama_pt);
    setNamaPejabat(comp.nama_pejabat);
    setJabatanPejabat(comp.jabatan_pejabat || '');
    setAlamat(comp.alamat || '');
    setKota(comp.kota || '');
    setKodePos(comp.kode_pos || '');
    setTelepon(comp.telepon || '');
    setEmail(comp.email || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!namaPt.trim()) {
      setFormError('Nama PT wajib diisi.');
      return;
    }
    if (!namaPejabat.trim()) {
      setFormError('Nama Pejabat wajib diisi.');
      return;
    }

    setBusy(true);
    try {
      await onSaveCompany(
        {
          id: editingCompany?.id || generateSafeId('comp'),
          user_id: uid,
          no: Number(no) || 1,
          nama_pt: namaPt.trim(),
          nama_pejabat: namaPejabat.trim(),
          jabatan_pejabat: jabatanPejabat.trim(),
          alamat: alamat.trim(),
          kota: kota.trim(),
          kode_pos: kodePos.trim(),
          telepon: telepon.trim(),
          email: email.trim(),
          logo: editingCompany?.logo || '',
        },
        Boolean(editingCompany)
      );
      showQuickPopup(
        editingCompany
          ? `Data ${namaPt.trim()} berhasil diperbarui!`
          : `Data ${namaPt.trim()} berhasil disimpan!`,
        'success'
      );
      setModalOpen(false);
    } catch {
      setFormError('Data gagal disimpan. Silakan coba lagi.');
      showQuickPopup('Data gagal disimpan. Silakan coba lagi.', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeleteCompany(deleteTarget.id);
      showQuickPopup(`Perusahaan ${deleteTarget.nama_pt} dihapus`, 'info');
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = companies.filter(
    (c) =>
      c.nama_pt.toLowerCase().includes(q) ||
      c.nama_pejabat.toLowerCase().includes(q) ||
      c.kota.toLowerCase().includes(q) ||
      c.alamat.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Data Perusahaan
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola daftar perusahaan klien (Pihak Pertama) beserta pejabat dan alamat lengkap
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenImportExcel}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Import Excel
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Tambah Perusahaan
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama PT, nama pejabat, atau kota..."
          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white"
        />
      </div>

      {/* Company List */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {companies.length === 0
                ? 'Belum ada data perusahaan'
                : 'Perusahaan tidak ditemukan'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {companies.length === 0
                ? 'Tambahkan data perusahaan secara manual atau import langsung dari file Excel (.xlsx).'
                : 'Coba gunakan kata kunci pencarian yang berbeda.'}
            </p>
          </div>
          {companies.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={openAddModal}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Tambah Manual
              </button>
              <button
                type="button"
                onClick={onOpenImportExcel}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Import dari Excel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((comp) => (
            <div
              key={comp.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      #{comp.no}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {comp.nama_pt}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(comp)}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                      title="Edit Perusahaan"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(comp)}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-red-600 hover:bg-red-50"
                      title="Hapus Perusahaan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{comp.nama_pejabat}</span>
                    {comp.jabatan_pejabat && (
                      <span className="text-slate-400">
                        · {comp.jabatan_pejabat}
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-500 dark:text-slate-400">
                      {comp.alamat
                        ? `${comp.alamat}${comp.kota ? `, ${comp.kota}` : ''}${
                            comp.kode_pos ? ` ${comp.kode_pos}` : ''
                          }`
                        : 'Alamat belum dilengkapi (Klik Edit untuk melengkapi)'}
                    </span>
                  </div>

                  {(comp.telepon || comp.email) && (
                    <div className="flex items-center gap-2 text-slate-500">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        {[comp.telepon, comp.email].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openEditModal(comp)}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Lengkapi Detail
                </button>
                <button
                  type="button"
                  onClick={() => onCreateBastForCompany(comp)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100"
                >
                  + Buat BAST PT Ini
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingCompany
                  ? 'Edit Data Perusahaan'
                  : 'Tambah Data Perusahaan'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 overflow-y-auto space-y-4"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No Urut
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={no}
                    onChange={(e) => setNo(Number(e.target.value) || 1)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama PT / Perusahaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPt}
                    onChange={(e) => setNamaPt(e.target.value)}
                    placeholder="PT. KANSAI PAINT INDONESIA"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pejabat *
                  </label>
                  <input
                    type="text"
                    required
                    value={namaPejabat}
                    onChange={(e) => setNamaPejabat(e.target.value)}
                    placeholder="MUHAMAD RIDHO"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Jabatan Pejabat
                  </label>
                  <input
                    type="text"
                    value={jabatanPejabat}
                    onChange={(e) => setJabatanPejabat(e.target.value)}
                    placeholder="Contoh: Manajer Operasional"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat Lengkap
                </label>
                <textarea
                  rows={2}
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  placeholder="Blok DD-7 & DD-6 Kawasan Industri MM2100 Cikarang Barat"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kota / Kabupaten
                  </label>
                  <input
                    type="text"
                    value={kota}
                    onChange={(e) => setKota(e.target.value)}
                    placeholder="Kab. Bekasi"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kode Pos
                  </label>
                  <input
                    type="text"
                    value={kodePos}
                    onChange={(e) => setKodePos(e.target.value)}
                    placeholder="17847"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Telepon
                  </label>
                  <input
                    type="text"
                    value={telepon}
                    onChange={(e) => setTelepon(e.target.value)}
                    placeholder="021-8998xxxx"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@perusahaan.co.id"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Perusahaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Hapus Data Perusahaan?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghapus{' '}
              <strong>{deleteTarget.nama_pt}</strong>? Dokumen BAST yang sudah
              dibuat sebelumnya tetap tersimpan dengan aman.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center gap-1.5"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
