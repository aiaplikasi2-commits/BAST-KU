import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Minus,
  Moon,
  Plus,
  Save,
  Stamp,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { changePasswordService } from '../services/authService';
import { AppSettings, StempelTarget } from '../types';
import {
  formatKopAddressLines,
  getCorporateEmblemDataUrl,
} from '../utils/defaultLogo';
import {
  compressImageFile,
  convertGoogleDriveUrl,
} from '../utils/formatters';
import { showQuickPopup } from '../utils/quickPopup';
import { SignatureControl } from './SignatureControl';

interface SettingsViewProps {
  uid: string;
  userEmail: string;
  userName: string;
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onUpdateUserName: (name: string) => Promise<void>;
  onOpenBackupRestore: () => void;
  onLogout: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userEmail,
  userName,
  settings,
  onSaveSettings,
  onUpdateUserName,
  onOpenBackupRestore,
  onLogout,
}) => {
  const [profileName, setProfileName] = useState(userName);
  const [form, setForm] = useState<AppSettings>(settings);
  const [driveIconUrl, setDriveIconUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    setProfileName(userName);
  }, [userName]);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const stempelInputRef = useRef<HTMLInputElement | null>(null);
  const iconInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadAsset = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logo' | 'stempel' | 'app_icon'
  ) => {
    setStatusMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setStatusMsg({
        type: 'error',
        text: 'Format gambar harus berupa PNG, JPG, atau JPEG.',
      });
      return;
    }

    try {
      const maxDim = field === 'app_icon' ? 256 : 520;
      const dataUrl = await compressImageFile(file, maxDim, maxDim, true);
      const updated = { ...form, [field]: dataUrl };
      setForm(updated);
      await onSaveSettings(updated);
      setStatusMsg({
        type: 'success',
        text: `Gambar ${
          field === 'logo'
            ? 'Logo Perusahaan'
            : field === 'stempel'
            ? 'Stempel'
            : 'Ikon Aplikasi'
        } berhasil diupload dan disimpan ke Cloud.`,
      });
      showQuickPopup('Gambar berhasil diupload & disimpan ke Cloud!', 'success');
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Gagal memproses gambar. Silakan coba file lain.',
      });
      showQuickPopup('Gagal memproses gambar', 'warning');
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyDriveIconUrl = async () => {
    if (!driveIconUrl.trim()) return;
    const converted = convertGoogleDriveUrl(driveIconUrl);
    const updated = { ...form, app_icon: converted };
    setForm(updated);
    await onSaveSettings(updated);
    setStatusMsg({
      type: 'success',
      text: 'URL Ikon Aplikasi (Google Drive / Direct Image) berhasil dikonversi dan diterapkan.',
    });
    showQuickPopup('URL Ikon Aplikasi berhasil diterapkan!', 'success');
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      if (profileName.trim() && profileName.trim() !== userName) {
        await onUpdateUserName(profileName.trim());
      }
      await onSaveSettings(form);
      setStatusMsg({
        type: 'success',
        text: 'Pengaturan berhasil disimpan dan disinkronkan ke Cloud.',
      });
      showQuickPopup('Pengaturan berhasil disimpan ke Cloud!', 'success');
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Data gagal disimpan. Silakan coba lagi.',
      });
      showQuickPopup('Data gagal disimpan. Silakan coba lagi.', 'warning');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setStatusMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setStatusMsg({
        type: 'error',
        text: 'Password baru minimal harus 6 karakter.',
      });
      showQuickPopup('Password baru minimal 6 karakter', 'warning');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setStatusMsg({
        type: 'error',
        text: 'Konfirmasi password baru tidak cocok.',
      });
      showQuickPopup('Konfirmasi password baru tidak cocok', 'warning');
      return;
    }

    setSaving(true);
    try {
      await changePasswordService(userEmail, newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setStatusMsg({
        type: 'success',
        text: 'Password akun berhasil diperbarui dengan enkripsi PBKDF2-SHA256.',
      });
      showQuickPopup('Password akun berhasil diperbarui!', 'success');
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Gagal memperbarui password. Silakan coba lagi.',
      });
      showQuickPopup('Gagal memperbarui password', 'warning');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Pengaturan Aplikasi &amp; Dokumen
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Atur Kop Surat, Logo, Stempel, Tanda Tangan Default, Penomoran BAST, dan Akun
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-2 shadow-xs disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Simpan Semua Pengaturan
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-2.5 text-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium leading-relaxed">{statusMsg.text}</span>
        </div>
      )}

      {/* 1. PROFIL & TAMPILAN */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            1. Profil Pengguna &amp; Tampilan
          </h2>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setForm({ ...form, theme: 'light' })}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                form.theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              Terang
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, theme: 'dark' })}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                form.theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              Gelap
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Pengguna
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Terdaftar
            </label>
            <input
              type="email"
              disabled
              value={userEmail}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500"
            />
          </div>
        </div>
      </section>

      {/* 2. IDENTITAS DOKUMEN / KOP SURAT & PIHAK KEDUA DEFAULT */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            2. Identitas Dokumen (Kop Surat PDF) &amp; Default Pihak Kedua
          </h2>
          <p className="text-xs text-slate-500">
            Data ini ditampilkan pada bagian Header atas PDF BAST
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Perusahaan (Kop Surat)
            </label>
            <input
              type="text"
              value={form.nama_perusahaan}
              onChange={(e) =>
                setForm({ ...form, nama_perusahaan: e.target.value })
              }
              placeholder="CV. MULIA TEKHNIK ABADI"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kota Default
            </label>
            <input
              type="text"
              value={form.kota}
              onChange={(e) => setForm({ ...form, kota: e.target.value })}
              placeholder="Bogor"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Alamat Kop Surat
            </label>
            <textarea
              rows={2}
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Telepon Kop Surat
            </label>
            <input
              type="text"
              value={form.telepon}
              onChange={(e) => setForm({ ...form, telepon: e.target.value })}
              placeholder="0812-1085-2489 / 0878-4062-0432"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Email Kop Surat
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="cvmuliatekhnikabadi@gmail.com"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        {/* Default Pihak Kedua & Penomoran BAST */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Pihak Kedua Default
            </label>
            <input
              type="text"
              value={form.default_pihak_kedua_nama}
              onChange={(e) =>
                setForm({ ...form, default_pihak_kedua_nama: e.target.value })
              }
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Jabatan Pihak Kedua Default
            </label>
            <input
              type="text"
              value={form.default_pihak_kedua_jabatan}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_pihak_kedua_jabatan: e.target.value,
                })
              }
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Format Nomor BAST Otomatis
            </label>
            <input
              type="text"
              value={form.auto_number_format}
              onChange={(e) =>
                setForm({ ...form, auto_number_format: e.target.value })
              }
              placeholder="BAST/{NO}/{ROMAN_MONTH}/{YEAR}"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* 3. PENGATURAN > LOGO & STEMPEL */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            3. Logo Perusahaan &amp; Stempel Resmi
          </h2>
          <p className="text-xs text-slate-500">
            Prioritaskan format PNG transparan agar tampilan pada dokumen PDF BAST bersih dan presisi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* LOGO CARD */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Logo Perusahaan (Kop PDF)
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {form.logo ? 'Ganti Logo' : 'Upload Logo'}
                </button>
                {form.logo && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo: '' })}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 flex items-center"
                    title="Hapus Logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => handleUploadAsset(e, 'logo')}
              className="hidden"
            />

            <div className="min-h-[110px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-3">
              {form.logo ? (
                <img
                  src={form.logo}
                  alt="Preview Logo"
                  referrerPolicy="no-referrer"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <img
                    src={getCorporateEmblemDataUrl(
                      form.nama_perusahaan || 'CV.MULIA TEKHNIK ABADI'
                    )}
                    alt="Default Corporate Emblem"
                    className="h-14 object-contain"
                  />
                  <p className="text-[11px] text-slate-500">
                    Emblem otomatis aktif. Upload file PNG/JPG untuk menggunakan logo khusus.
                  </p>
                </div>
              )}
            </div>

            {/* Pengaturan Perbesar / Perkecil & Posisi Logo di KOP */}
            <div className="pt-2 space-y-3 text-xs">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Ukuran Logo di KOP ({form.logo_scale || 100}%)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          logo_scale: Math.max(
                            40,
                            (form.logo_scale || 100) - 10
                          ),
                        })
                      }
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      title="Perkecil Logo (-10%)"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          logo_scale: 100,
                          logo_x: 0,
                          logo_y: 0,
                        })
                      }
                      className="px-2 h-7 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-blue-900 dark:text-blue-300 hover:bg-blue-50"
                      title="Reset Ukuran (100%) & Posisi (0, 0)"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          logo_scale: Math.min(
                            220,
                            (form.logo_scale || 100) + 10
                          ),
                        })
                      }
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                      title="Perbesar Logo (+10%)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={40}
                  max={220}
                  step={5}
                  value={form.logo_scale || 100}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logo_scale: Number(e.target.value) || 100,
                    })
                  }
                  className="w-full accent-blue-900 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-600 dark:text-slate-400">
                      Geser Kiri/Kanan X ({form.logo_x || 0})
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-100}
                      max={180}
                      value={form.logo_x || 0}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          logo_x: Number(e.target.value) || 0,
                        })
                      }
                      className="flex-1 accent-blue-900 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={-150}
                      max={220}
                      value={form.logo_x || 0}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          logo_x: Number(e.target.value) || 0,
                        })
                      }
                      className="w-14 min-h-[34px] px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-center bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-600 dark:text-slate-400">
                      Geser Atas/Bawah Y ({form.logo_y || 0})
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      value={form.logo_y || 0}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          logo_y: Number(e.target.value) || 0,
                        })
                      }
                      className="flex-1 accent-blue-900 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={-120}
                      max={120}
                      value={form.logo_y || 0}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          logo_y: Number(e.target.value) || 0,
                        })
                      }
                      className="w-14 min-h-[34px] px-1.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-center bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Posisi awal (0, 0) berada tepat di ujung kiri garis Kop. Geser slider X/Y di atas atau geser langsung logo pada layar VIEW PDF.
              </p>
            </div>
          </div>

          {/* STEMPEL CARD */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Stempel Perusahaan
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stempelInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-900 text-white text-xs font-semibold hover:bg-blue-800 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {form.stempel ? 'Ganti Stempel' : 'Upload Stempel'}
                </button>
                {form.stempel && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, stempel: '' })}
                    className="min-h-[38px] px-2.5 py-1.5 rounded-xl text-red-600 hover:bg-red-50 flex items-center"
                    title="Hapus Stempel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <input
              ref={stempelInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => handleUploadAsset(e, 'stempel')}
              className="hidden"
            />

            <div className="min-h-[110px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-3">
              {form.stempel ? (
                <img
                  src={form.stempel}
                  alt="Preview Stempel"
                  referrerPolicy="no-referrer"
                  className="max-h-24 max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-slate-400 text-center">
                  Belum ada stempel. Upload PNG transparan untuk ditempatkan pada area tanda tangan PDF.
                </p>
              )}
            </div>

            {/* Pengaturan Posisi & Ukuran Stempel */}
            <div className="pt-2 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Posisi Area
                  </label>
                  <select
                    value={form.stempel_target}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        stempel_target: e.target.value as StempelTarget,
                      })
                    }
                    className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="pihak_kedua">Pihak Kedua</option>
                    <option value="pihak_pertama">Pihak Pertama</option>
                    <option value="both">Kedua Pihak</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Ukuran ({form.stempel_scale}%)
                  </label>
                  <input
                    type="range"
                    min={50}
                    max={180}
                    value={form.stempel_scale}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        stempel_scale: Number(e.target.value),
                      })
                    }
                    className="w-full mt-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Geser X / Y ({form.stempel_x}, {form.stempel_y})
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={form.stempel_x}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stempel_x: Number(e.target.value) || 0,
                        })
                      }
                      className="w-1/2 min-h-[36px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-center"
                      title="Offset Horizontal"
                    />
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={form.stempel_y}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stempel_y: Number(e.target.value) || 0,
                        })
                      }
                      className="w-1/2 min-h-[36px] px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-mono text-center"
                      title="Offset Vertikal"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LIVE PREVIEW KOP SURAT RESMI (SESUAI GAMBAR REFERENSI) */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Pratinjau Langsung Kop Surat Resmi (Ukuran &amp; Posisi Logo KOP + Header 1 Tebal)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Skala: {form.logo_scale || 100}% · Posisi: ({form.logo_x || 0}, {form.logo_y || 0})
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-slate-100 dark:bg-slate-950 p-4">
            <div
              style={{
                minWidth: '640px',
                fontFamily:
                  "'Carlito', Calibri, 'Plus Jakarta Sans', Arial, Helvetica, sans-serif",
              }}
              className="bg-white text-slate-900 rounded-xl shadow-xs border border-slate-200 px-8 py-5"
            >
              <div
                style={{
                  minHeight: `${Math.max(102, Math.round(58 * ((form.logo_scale || 100) / 100)) + 16)}px`,
                }}
                className="relative pb-2.5 flex flex-col justify-end"
              >
                {/* LOGO: ANCHORED AT LEFT EDGE OF THE HORIZONTAL LINE + USER OFFSET (logo_x, logo_y) */}
                <div
                  style={{
                    width: `${Math.round(152 * ((form.logo_scale || 100) / 100))}px`,
                    height: `${Math.round(58 * ((form.logo_scale || 100) / 100))}px`,
                    left: `${form.logo_x || 0}px`,
                    bottom: `${8 - (form.logo_y || 0)}px`,
                  }}
                  className="absolute z-10 flex items-end justify-start pointer-events-none"
                >
                  <img
                    src={
                      form.logo?.trim() ||
                      getCorporateEmblemDataUrl(
                        form.nama_perusahaan || 'CV.MULIA TEKHNIK ABADI'
                      )
                    }
                    alt="Logo Kop"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain object-left-bottom"
                  />
                </div>

                {/* KOP HEADER 1 & ADDRESS */}
                <div className="w-full pl-[68px] text-center">
                  <h4
                    style={{
                      fontFamily:
                        "'Arial Black', 'Plus Jakarta Sans', Calibri, sans-serif",
                      WebkitTextStroke: '0.75px #3B6E8C',
                    }}
                    className="text-[24px] font-black tracking-[0.03em] text-[#3B6E8C] uppercase leading-[1.12]"
                  >
                    {form.nama_perusahaan || 'CV.MULIA TEKHNIK ABADI'}
                  </h4>
                  <div className="mt-1 space-y-0.5 text-[12.5px] font-medium text-slate-700 leading-[1.3]">
                    {formatKopAddressLines(
                      form.alamat ||
                        'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966'
                    ).map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                  {form.email && (
                    <p className="text-[12.5px] font-bold text-slate-700 mt-0.5 leading-snug">
                      email.{' '}
                      <span className="text-[#3B6E8C] underline decoration-[#3B6E8C] decoration-[1.5px] underline-offset-2">
                        {form.email}
                      </span>
                    </p>
                  )}
                  {form.telepon && (
                    <p className="text-[12.5px] font-bold text-slate-800 mt-0.5 leading-snug">
                      Tlp {form.telepon}
                    </p>
                  )}
                </div>
              </div>

              {/* Compound Horizontal Line */}
              <div className="w-full">
                <div className="border-t border-slate-700" />
                <div className="border-t-[2.5px] border-slate-800 my-[1.5px]" />
                <div className="border-t border-slate-700" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TANDA TANGAN DEFAULT */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            4. Tanda Tangan Digital Default
          </h2>
          <p className="text-xs text-slate-500">
            Dapat dibuat dengan coretan layar (Signature Pad) atau upload gambar PNG/JPG
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignatureControl
            label="Tanda Tangan Default Pihak Pertama"
            subtitle="Digunakan jika BAST tidak memiliki tanda tangan khusus"
            value={form.signature_party_1}
            onChange={(val) => setForm({ ...form, signature_party_1: val })}
          />
          <SignatureControl
            label="Tanda Tangan Default Pihak Kedua"
            subtitle="Tanda tangan Anda / pelaksana pekerjaan"
            value={form.signature_party_2}
            onChange={(val) => setForm({ ...form, signature_party_2: val })}
          />
        </div>
      </section>

      {/* 5. IKON APLIKASI (CUSTOM / GOOGLE DRIVE URL CONVERTER) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            5. Ikon Aplikasi &amp; Konversi URL Google Drive
          </h2>
          <p className="text-xs text-slate-500">
            Masukkan tautan gambar Google Drive (otomatis dikonversi) atau upload ikon secara manual
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-900 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
            <img
              src={form.app_icon || '/icon.svg'}
              alt="App Icon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="url"
                value={driveIconUrl}
                onChange={(e) => setDriveIconUrl(e.target.value)}
                placeholder="Tempel URL Google Drive atau URL gambar langsung..."
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyDriveIconUrl}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 shrink-0"
            >
              Terapkan URL
            </button>
            <button
              type="button"
              onClick={() => iconInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Manual
            </button>
            <input
              ref={iconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => handleUploadAsset(e, 'app_icon')}
              className="hidden"
            />
          </div>
        </div>
      </section>

      {/* 6. KEAMANAN AKUN, BACKUP & LOGOUT */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            6. Keamanan Akun, Backup Data &amp; Sesi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Konfirmasi Password Baru
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl"
            />
          </div>
          <button
            type="button"
            onClick={handleChangePassword}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-4 h-4" />
            Perbarui Password
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenBackupRestore}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 flex items-center gap-2"
          >
            <Database className="w-4 h-4 text-blue-800" />
            Buka Menu Backup &amp; Restore JSON
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar (Logout)
          </button>
        </div>
      </section>
    </form>
  );
};
