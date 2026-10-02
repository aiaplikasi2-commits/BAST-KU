export type BastStatus = 'Draft' | 'Selesai';

export type SyncStatus = 'loading' | 'saving' | 'synced' | 'offline' | 'error';

export type NavigationTab =
  | 'dashboard'
  | 'companies'
  | 'bast'
  | 'bast-form'
  | 'import-excel'
  | 'backup-restore'
  | 'settings';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  no: number;
  nama_pt: string;
  nama_pejabat: string;
  jabatan_pejabat: string;
  alamat: string;
  kota: string;
  kode_pos: string;
  telepon: string;
  email: string;
  logo: string;
  created_at: string;
  updated_at: string;
}

export interface BastItem {
  id: string;
  user_id: string;
  bast_id: string;
  nomor: number;
  nama_barang_jasa: string;
  keterangan: string;
  urutan: number;
  created_at: string;
  updated_at: string;
}

export interface BastDocument {
  id: string;
  user_id: string;
  nomor_bast: string;
  tanggal_bast: string; // YYYY-MM-DD
  kota: string;
  company_id: string;
  pihak_pertama_pt: string;
  pihak_pertama_nama: string;
  pihak_pertama_jabatan: string;
  pihak_pertama_alamat: string;
  pihak_kedua_nama: string;
  pihak_kedua_jabatan: string;
  pihak_kedua_alamat: string;
  nomor_po: string;
  deskripsi_pekerjaan: string;
  tanggal_mulai: string; // YYYY-MM-DD
  tanggal_selesai: string; // YYYY-MM-DD
  status: BastStatus;
  signature_party_1: string;
  signature_party_2: string;
  use_stempel: boolean;
  created_at: string;
  updated_at: string;
}

export type StempelTarget = 'pihak_kedua' | 'pihak_pertama' | 'both';

export interface AppSettings {
  user_id: string;
  nama_perusahaan: string;
  alamat: string;
  kota: string;
  telepon: string;
  email: string;
  logo: string;
  stempel: string;
  stempel_scale: number;
  stempel_x: number;
  stempel_y: number;
  stempel_target: StempelTarget;
  signature_party_1: string;
  signature_party_2: string;
  app_icon: string;
  auto_number_enabled: boolean;
  auto_number_format: string;
  auto_number_counter: number;
  theme: 'light' | 'dark';
  default_pihak_kedua_nama: string;
  default_pihak_kedua_jabatan: string;
  default_pihak_kedua_alamat: string;
  created_at: string;
  updated_at: string;
}

export interface BackupFilePayload {
  metadata: {
    app_name: string;
    backup_version: string;
    exported_at: string;
    user_id: string;
    user_email: string;
    company_count: number;
    bast_count: number;
    item_count: number;
    assets_note: string;
  };
  settings: AppSettings;
  companies: Company[];
  bast_documents: BastDocument[];
  bast_items: BastItem[];
}
