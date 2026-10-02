import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  AppSettings,
  BastDocument,
  BastItem,
  Company,
  UserProfile,
} from '../types';
import { generateSafeId } from '../utils/formatters';

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  const trimmed = typeof val === 'string' ? val.trim() : '';
  const str = trimmed.length > 0 ? trimmed : fallback;
  return str.slice(0, maxLen);
}

function clampRawStr(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val : fallback;
  return str.slice(0, maxLen);
}

function clampNum(val: unknown, min: number, max: number, fallback = 0): number {
  const n = Number(val);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  return cleaned || generateSafeId('doc');
}

/**
 * Prefix every document ID with the user's UID so User 1 and User 2 can NEVER
 * collide on document paths in Firestore (/companies, /bast_documents, /bast_items),
 * even when importing identical Excel files or backup files.
 */
function ensureUserScopedId(uid: string, rawId: string, prefix = 'doc'): string {
  const safeUid = sanitizeId(uid);
  const baseId = sanitizeId(rawId || generateSafeId(prefix));
  const userPrefix = `${safeUid}_`;
  if (baseId.startsWith(userPrefix)) {
    return baseId.slice(0, 128);
  }
  return `${userPrefix}${baseId}`.slice(0, 128);
}

function timestampToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    const sec = Number((val as { seconds: number }).seconds);
    return new Date(sec * 1000).toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function getDefaultSettings(uid: string, userEmail = ''): AppSettings {
  const now = new Date().toISOString();
  return {
    user_id: sanitizeId(uid),
    nama_perusahaan: 'CV. MULIA TEKHNIK ABADI',
    alamat:
      'Jl. Letda Nasir No.58 Desa Cikeas Udik Kecamatan Gunung Putri Kab. Bogor Kode Pos 16966',
    kota: 'Bogor',
    telepon: '0812-1085-2489 / 0878-4062-0432',
    email: userEmail || 'cvmuliatekhnikabadi@gmail.com',
    logo: '',
    logo_scale: 100,
    logo_x: 0,
    logo_y: 0,
    stempel: '',
    stempel_scale: 100,
    stempel_x: 0,
    stempel_y: 0,
    stempel_target: 'pihak_kedua',
    signature_party_1: '',
    signature_party_2: '',
    app_icon: '',
    auto_number_enabled: true,
    auto_number_format: 'BAST/{NO}/{ROMAN_MONTH}/{YEAR}',
    auto_number_counter: 1,
    theme: 'light',
    default_pihak_kedua_nama: 'MUHAMAD RIDHO',
    default_pihak_kedua_jabatan: 'Teknisi / Pelaksana',
    default_pihak_kedua_alamat:
      'Jln. Letda Nasir No. 58 Bogor, 16966 Kel. Cikeas Udik Kec. Gunung Putri Bogor',
    created_at: now,
    updated_at: now,
  };
}

// LocalStorage Cache & Reactive Bus for Instant Offline Support per isolated UID
const CACHE_PREFIX = 'bast_user_isolated_v2_';

export interface LocalUserCache {
  companies: Company[];
  bast_documents: BastDocument[];
  bast_items: BastItem[];
  settings: AppSettings | null;
  updatedAt: string;
}

type CacheListener = (cache: LocalUserCache) => void;
const cacheListeners = new Map<string, Set<CacheListener>>();

function emitCacheUpdate(uid: string, cache: LocalUserCache) {
  const set = cacheListeners.get(uid);
  if (set) {
    set.forEach((cb) => cb(cache));
  }
}

export function loadLocalCache(uid: string): LocalUserCache {
  const safeUid = sanitizeId(uid);
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${safeUid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalUserCache;
      return {
        companies: (parsed.companies || []).filter(
          (c) => c.user_id === safeUid
        ),
        bast_documents: (parsed.bast_documents || []).filter(
          (d) => d.user_id === safeUid
        ),
        bast_items: (parsed.bast_items || []).filter(
          (it) => it.user_id === safeUid
        ),
        settings:
          parsed.settings && parsed.settings.user_id === safeUid
            ? parsed.settings
            : null,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn('Failed to read local cache:', e);
  }
  return {
    companies: [],
    bast_documents: [],
    bast_items: [],
    settings: null,
    updatedAt: new Date().toISOString(),
  };
}

export function saveLocalCache(
  uid: string,
  partial: Partial<LocalUserCache>
): LocalUserCache {
  const safeUid = sanitizeId(uid);
  const current = loadLocalCache(safeUid);
  const next: LocalUserCache = {
    companies: (partial.companies ?? current.companies).filter(
      (c) => c.user_id === safeUid
    ),
    bast_documents: (partial.bast_documents ?? current.bast_documents).filter(
      (d) => d.user_id === safeUid
    ),
    bast_items: (partial.bast_items ?? current.bast_items).filter(
      (it) => it.user_id === safeUid
    ),
    settings:
      partial.settings !== undefined ? partial.settings : current.settings,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(`${CACHE_PREFIX}${safeUid}`, JSON.stringify(next));
  } catch (e) {
    console.warn('Failed to write local cache:', e);
  }
  emitCacheUpdate(safeUid, next);
  return next;
}

// ============================================================================
// User Profile Operations (Online Cloud Firestore)
// ============================================================================
export async function ensureUserProfile(
  uid: string,
  email: string,
  name: string
): Promise<UserProfile> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const cleanEmail = clampStr(email || 'user@bast.app', 254, 'user@bast.app');
  const cleanName = clampStr(
    name || cleanEmail.split('@')[0] || 'Pengguna BAST',
    150,
    'Pengguna BAST'
  );

  const ref = doc(db, 'users', safeUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeUid,
        email: cleanEmail,
        name: cleanName,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      return {
        id: safeUid,
        email: cleanEmail,
        name: cleanName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      const data = snap.data();
      return {
        id: safeUid,
        email: String(data.email || cleanEmail),
        name: String(data.name || cleanName),
        created_at: timestampToIso(data.created_at),
        updated_at: timestampToIso(data.updated_at),
      };
    }
  } catch (error) {
    console.warn('Cloud profile sync warning:', path, error);
    return {
      id: safeUid,
      email: cleanEmail,
      name: cleanName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

export async function updateUserProfileName(
  uid: string,
  name: string,
  email: string
) {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const cleanName = clampStr(name, 150, 'Pengguna BAST');
  const cleanEmail = clampStr(email, 254, 'user@bast.app');

  const ref = doc(db, 'users', safeUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeUid,
        email: cleanEmail,
        name: cleanName,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } else {
      try {
        await updateDoc(ref, {
          name: cleanName,
          email: cleanEmail,
          updated_at: serverTimestamp(),
        });
      } catch {
        await deleteDoc(ref);
        await setDoc(ref, {
          id: safeUid,
          email: cleanEmail,
          name: cleanName,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('Cloud profile update warning:', path, error);
  }
}

// ============================================================================
// Settings Operations (Online Cloud Firestore per userId)
// ============================================================================
export async function ensureUserSettings(
  uid: string,
  userEmail = ''
): Promise<AppSettings> {
  const safeUid = sanitizeId(uid);
  const defaults = getDefaultSettings(safeUid, userEmail);
  const cached = loadLocalCache(safeUid).settings;

  const path = `settings/${safeUid}`;
  const ref = doc(db, 'settings', safeUid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initial: AppSettings =
        cached && cached.user_id === safeUid
          ? { ...cached, user_id: safeUid }
          : defaults;

      await setDoc(ref, {
        user_id: safeUid,
        nama_perusahaan: clampStr(initial.nama_perusahaan, 200),
        alamat: clampStr(initial.alamat, 1000),
        kota: clampStr(initial.kota, 100),
        telepon: clampStr(initial.telepon, 100),
        email: clampStr(initial.email, 254),
        logo: clampRawStr(initial.logo, 350000),
        logo_scale: clampNum(initial.logo_scale, 30, 250, 100),
        logo_x: clampNum(initial.logo_x, -250, 250, 0),
        logo_y: clampNum(initial.logo_y, -250, 250, 0),
        stempel: clampRawStr(initial.stempel, 350000),
        stempel_scale: clampNum(initial.stempel_scale, 20, 250, 100),
        stempel_x: clampNum(initial.stempel_x, -200, 200, 0),
        stempel_y: clampNum(initial.stempel_y, -200, 200, 0),
        stempel_target: initial.stempel_target,
        signature_party_1: clampRawStr(initial.signature_party_1, 250000),
        signature_party_2: clampRawStr(initial.signature_party_2, 250000),
        app_icon: clampRawStr(initial.app_icon, 250000),
        auto_number_enabled: Boolean(initial.auto_number_enabled),
        auto_number_format: clampStr(
          initial.auto_number_format,
          100,
          'BAST/{NO}/{ROMAN_MONTH}/{YEAR}'
        ),
        auto_number_counter: clampNum(
          initial.auto_number_counter,
          0,
          1000000,
          1
        ),
        theme: initial.theme === 'dark' ? 'dark' : 'light',
        default_pihak_kedua_nama: clampStr(
          initial.default_pihak_kedua_nama,
          150
        ),
        default_pihak_kedua_jabatan: clampStr(
          initial.default_pihak_kedua_jabatan,
          150
        ),
        default_pihak_kedua_alamat: clampStr(
          initial.default_pihak_kedua_alamat,
          1000
        ),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      saveLocalCache(safeUid, { settings: initial });
      return initial;
    } else {
      const d = snap.data();
      const loaded: AppSettings = {
        user_id: safeUid,
        nama_perusahaan: String(d.nama_perusahaan ?? defaults.nama_perusahaan),
        alamat: String(d.alamat ?? defaults.alamat),
        kota: String(d.kota ?? defaults.kota),
        telepon: String(d.telepon ?? defaults.telepon),
        email: String(d.email ?? defaults.email),
        logo: String(d.logo ?? ''),
        logo_scale: clampNum(d.logo_scale, 30, 250, 100),
        logo_x: clampNum(d.logo_x, -250, 250, 0),
        logo_y: clampNum(d.logo_y, -250, 250, 0),
        stempel: String(d.stempel ?? ''),
        stempel_scale: clampNum(d.stempel_scale, 20, 250, 100),
        stempel_x: clampNum(d.stempel_x, -200, 200, 0),
        stempel_y: clampNum(d.stempel_y, -200, 200, 0),
        stempel_target:
          d.stempel_target === 'pihak_pertama' || d.stempel_target === 'both'
            ? d.stempel_target
            : 'pihak_kedua',
        signature_party_1: String(d.signature_party_1 ?? ''),
        signature_party_2: String(d.signature_party_2 ?? ''),
        app_icon: String(d.app_icon ?? ''),
        auto_number_enabled: Boolean(d.auto_number_enabled ?? true),
        auto_number_format: String(
          d.auto_number_format || 'BAST/{NO}/{ROMAN_MONTH}/{YEAR}'
        ),
        auto_number_counter: clampNum(d.auto_number_counter, 0, 1000000, 1),
        theme: d.theme === 'dark' ? 'dark' : 'light',
        default_pihak_kedua_nama: String(
          d.default_pihak_kedua_nama ?? defaults.default_pihak_kedua_nama
        ),
        default_pihak_kedua_jabatan: String(
          d.default_pihak_kedua_jabatan ?? defaults.default_pihak_kedua_jabatan
        ),
        default_pihak_kedua_alamat: String(
          d.default_pihak_kedua_alamat ?? defaults.default_pihak_kedua_alamat
        ),
        created_at: timestampToIso(d.created_at),
        updated_at: timestampToIso(d.updated_at),
      };
      saveLocalCache(safeUid, { settings: loaded });
      return loaded;
    }
  } catch (error) {
    if (cached && cached.user_id === safeUid) return cached;
    if (!navigator.onLine) return defaults;
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserSettings(
  uid: string,
  settings: AppSettings
): Promise<void> {
  const safeUid = sanitizeId(uid);

  saveLocalCache(safeUid, {
    settings: {
      ...settings,
      user_id: safeUid,
      updated_at: new Date().toISOString(),
    },
  });

  const path = `settings/${safeUid}`;
  const ref = doc(db, 'settings', safeUid);

  const payload = {
    nama_perusahaan: clampStr(settings.nama_perusahaan, 200),
    alamat: clampStr(settings.alamat, 1000),
    kota: clampStr(settings.kota, 100),
    telepon: clampStr(settings.telepon, 100),
    email: clampStr(settings.email, 254),
    logo: clampRawStr(settings.logo, 500000),
    logo_scale: clampNum(settings.logo_scale, 10, 300, 100),
    logo_x: clampNum(settings.logo_x, -500, 500, 0),
    logo_y: clampNum(settings.logo_y, -500, 500, 0),
    stempel: clampRawStr(settings.stempel, 500000),
    stempel_scale: clampNum(settings.stempel_scale, 10, 300, 100),
    stempel_x: clampNum(settings.stempel_x, -500, 500, 0),
    stempel_y: clampNum(settings.stempel_y, -500, 500, 0),
    stempel_target:
      settings.stempel_target === 'pihak_pertama' ||
      settings.stempel_target === 'both'
        ? settings.stempel_target
        : 'pihak_kedua',
    signature_party_1: clampRawStr(settings.signature_party_1, 500000),
    signature_party_2: clampRawStr(settings.signature_party_2, 500000),
    app_icon: clampRawStr(settings.app_icon, 500000),
    auto_number_enabled: Boolean(settings.auto_number_enabled),
    auto_number_format: clampStr(
      settings.auto_number_format,
      100,
      'BAST/{NO}/{ROMAN_MONTH}/{YEAR}'
    ),
    auto_number_counter: clampNum(settings.auto_number_counter, 0, 1000000, 1),
    theme: settings.theme === 'dark' ? 'dark' : 'light',
    default_pihak_kedua_nama: clampStr(settings.default_pihak_kedua_nama, 150),
    default_pihak_kedua_jabatan: clampStr(
      settings.default_pihak_kedua_jabatan,
      150
    ),
    default_pihak_kedua_alamat: clampStr(
      settings.default_pihak_kedua_alamat,
      1000
    ),
    updated_at: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        user_id: safeUid,
        ...payload,
        created_at: serverTimestamp(),
      });
    } else {
      try {
        await updateDoc(ref, payload);
      } catch {
        await deleteDoc(ref);
        await setDoc(ref, {
          user_id: safeUid,
          ...payload,
          created_at: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('Cloud settings sync warning (saved locally):', path, error);
  }
}

// ============================================================================
// Company CRUD Operations (Online Cloud Firestore isolated by user_id)
// ============================================================================
export async function saveCompanyRecord(
  uid: string,
  company: Omit<Company, 'created_at' | 'updated_at'> & {
    created_at?: string;
    updated_at?: string;
  },
  isUpdate = false
): Promise<Company> {
  const safeUid = sanitizeId(uid);
  const safeId = ensureUserScopedId(safeUid, company.id, 'comp');

  const nowIso = new Date().toISOString();
  const localRecord: Company = {
    id: safeId,
    user_id: safeUid,
    no: clampNum(company.no, 0, 1000000, 1),
    nama_pt: clampStr(company.nama_pt, 200, 'PT. Tanpa Nama'),
    nama_pejabat: clampStr(company.nama_pejabat, 150, '-'),
    jabatan_pejabat: clampStr(company.jabatan_pejabat, 150, ''),
    alamat: clampStr(company.alamat, 1000, ''),
    kota: clampStr(company.kota, 100, ''),
    kode_pos: clampStr(company.kode_pos, 20, ''),
    telepon: clampStr(company.telepon, 100, ''),
    email: clampStr(company.email, 254, ''),
    logo: clampRawStr(company.logo, 350000, ''),
    created_at: company.created_at || nowIso,
    updated_at: nowIso,
  };

  // Update local cache immediately
  const currentCache = loadLocalCache(safeUid);
  const otherCompanies = currentCache.companies.filter((c) => c.id !== safeId);
  const nextCompanies = [...otherCompanies, localRecord].sort(
    (a, b) => a.no - b.no || a.nama_pt.localeCompare(b.nama_pt)
  );
  saveLocalCache(safeUid, { companies: nextCompanies });

  const path = `companies/${safeId}`;
  const ref = doc(db, 'companies', safeId);

  const mutableFields = {
    no: localRecord.no,
    nama_pt: localRecord.nama_pt,
    nama_pejabat: localRecord.nama_pejabat,
    jabatan_pejabat: localRecord.jabatan_pejabat,
    alamat: localRecord.alamat,
    kota: localRecord.kota,
    kode_pos: localRecord.kode_pos,
    telepon: localRecord.telepon,
    email: localRecord.email,
    logo: localRecord.logo,
    updated_at: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        user_id: safeUid,
        ...mutableFields,
        created_at: serverTimestamp(),
      });
    } else {
      try {
        await updateDoc(ref, mutableFields);
      } catch {
        await deleteDoc(ref);
        await setDoc(ref, {
          id: safeId,
          user_id: safeUid,
          ...mutableFields,
          created_at: serverTimestamp(),
        });
      }
    }
    return localRecord;
  } catch (error) {
    console.warn('Cloud company sync warning (saved locally):', path, error);
    return localRecord;
  }
}

export async function deleteCompanyRecord(
  companyId: string,
  uid: string
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeId = sanitizeId(companyId);

  const currentCache = loadLocalCache(safeUid);
  saveLocalCache(safeUid, {
    companies: currentCache.companies.filter((c) => c.id !== safeId),
  });

  const path = `companies/${safeId}`;
  try {
    await deleteDoc(doc(db, 'companies', safeId));
  } catch (error) {
    console.warn('Cloud company delete warning:', path, error);
  }
}

// ============================================================================
// BAST Document & Line Items CRUD Operations (Online Cloud Firestore)
// ============================================================================
export async function saveBastWithItems(
  uid: string,
  bastInput: Omit<BastDocument, 'created_at' | 'updated_at'> & {
    created_at?: string;
    updated_at?: string;
  },
  itemsInput: Array<{
    id?: string;
    nomor: number;
    nama_barang_jasa: string;
    keterangan: string;
    urutan: number;
  }>,
  existingItemIds: string[] = []
): Promise<{ bast: BastDocument; items: BastItem[] }> {
  const safeUid = sanitizeId(uid);
  const safeBastId = ensureUserScopedId(safeUid, bastInput.id, 'bast');
  const safeCompanyId = bastInput.company_id
    ? ensureUserScopedId(safeUid, bastInput.company_id, 'comp')
    : '';
  const nowIso = new Date().toISOString();

  const savedBast: BastDocument = {
    id: safeBastId,
    user_id: safeUid,
    nomor_bast: clampStr(bastInput.nomor_bast, 150, 'BAST/001/X/2026'),
    tanggal_bast: clampStr(bastInput.tanggal_bast, 30, nowIso.slice(0, 10)),
    kota: clampStr(bastInput.kota, 100, 'Bogor'),
    company_id: safeCompanyId,
    pihak_pertama_pt: clampStr(bastInput.pihak_pertama_pt, 200, '-'),
    pihak_pertama_nama: clampStr(bastInput.pihak_pertama_nama, 150, '-'),
    pihak_pertama_jabatan: clampStr(bastInput.pihak_pertama_jabatan, 150, ''),
    pihak_pertama_alamat: clampStr(bastInput.pihak_pertama_alamat, 1000, '-'),
    pihak_kedua_nama: clampStr(bastInput.pihak_kedua_nama, 150, '-'),
    pihak_kedua_jabatan: clampStr(bastInput.pihak_kedua_jabatan, 150, ''),
    pihak_kedua_alamat: clampStr(bastInput.pihak_kedua_alamat, 1000, '-'),
    nomor_po: clampStr(bastInput.nomor_po, 150, ''),
    deskripsi_pekerjaan: clampStr(bastInput.deskripsi_pekerjaan, 1000, ''),
    tanggal_mulai: clampStr(
      bastInput.tanggal_mulai,
      30,
      bastInput.tanggal_bast || nowIso.slice(0, 10)
    ),
    tanggal_selesai: clampStr(
      bastInput.tanggal_selesai,
      30,
      bastInput.tanggal_bast || nowIso.slice(0, 10)
    ),
    status: bastInput.status === 'Selesai' ? 'Selesai' : 'Draft',
    signature_party_1: clampRawStr(bastInput.signature_party_1, 250000, ''),
    signature_party_2: clampRawStr(bastInput.signature_party_2, 250000, ''),
    use_stempel: Boolean(bastInput.use_stempel),
    created_at: bastInput.created_at || nowIso,
    updated_at: nowIso,
  };

  const savedItems: BastItem[] = itemsInput.map((rawItem, idx) => ({
    id: ensureUserScopedId(
      safeUid,
      rawItem.id || generateSafeId('item'),
      'item'
    ),
    user_id: safeUid,
    bast_id: safeBastId,
    nomor: clampNum(idx + 1, 1, 10000, idx + 1),
    nama_barang_jasa: clampStr(rawItem.nama_barang_jasa, 1000, '-'),
    keterangan: clampStr(rawItem.keterangan, 500, 'Sesuai'),
    urutan: clampNum(idx, 0, 10000, idx),
    created_at: nowIso,
    updated_at: nowIso,
  }));

  // Immediately update local cache
  const currentCache = loadLocalCache(safeUid);
  const nextBastDocs = [
    ...currentCache.bast_documents.filter((d) => d.id !== safeBastId),
    savedBast,
  ].sort(
    (a, b) =>
      b.tanggal_bast.localeCompare(a.tanggal_bast) ||
      b.updated_at.localeCompare(a.updated_at)
  );
  const nextBastItems = [
    ...currentCache.bast_items.filter((it) => it.bast_id !== safeBastId),
    ...savedItems,
  ];
  saveLocalCache(safeUid, {
    bast_documents: nextBastDocs,
    bast_items: nextBastItems,
  });

  const bastPath = `bast_documents/${safeBastId}`;
  const bastRef = doc(db, 'bast_documents', safeBastId);

  const mutableBastFields = {
    nomor_bast: savedBast.nomor_bast,
    tanggal_bast: savedBast.tanggal_bast,
    kota: savedBast.kota,
    company_id: savedBast.company_id,
    pihak_pertama_pt: savedBast.pihak_pertama_pt,
    pihak_pertama_nama: savedBast.pihak_pertama_nama,
    pihak_pertama_jabatan: savedBast.pihak_pertama_jabatan,
    pihak_pertama_alamat: savedBast.pihak_pertama_alamat,
    pihak_kedua_nama: savedBast.pihak_kedua_nama,
    pihak_kedua_jabatan: savedBast.pihak_kedua_jabatan,
    pihak_kedua_alamat: savedBast.pihak_kedua_alamat,
    nomor_po: savedBast.nomor_po,
    deskripsi_pekerjaan: savedBast.deskripsi_pekerjaan,
    tanggal_mulai: savedBast.tanggal_mulai,
    tanggal_selesai: savedBast.tanggal_selesai,
    status: savedBast.status,
    signature_party_1: savedBast.signature_party_1,
    signature_party_2: savedBast.signature_party_2,
    use_stempel: savedBast.use_stempel,
    updated_at: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(bastRef);
    if (!existingSnap.exists()) {
      await setDoc(bastRef, {
        id: safeBastId,
        user_id: safeUid,
        ...mutableBastFields,
        created_at: serverTimestamp(),
      });
    } else {
      try {
        await updateDoc(bastRef, mutableBastFields);
      } catch {
        await deleteDoc(bastRef);
        await setDoc(bastRef, {
          id: safeBastId,
          user_id: safeUid,
          ...mutableBastFields,
          created_at: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    console.warn('Cloud BAST sync warning (saved locally):', bastPath, error);
  }

  const keptIds = new Set<string>();
  for (const item of savedItems) {
    keptIds.add(item.id);
    const itemPath = `bast_items/${item.id}`;
    const itemRef = doc(db, 'bast_items', item.id);

    const itemMutable = {
      nomor: item.nomor,
      nama_barang_jasa: item.nama_barang_jasa,
      keterangan: item.keterangan,
      urutan: item.urutan,
      updated_at: serverTimestamp(),
    };

    try {
      const snap = await getDoc(itemRef);
      if (snap.exists()) {
        try {
          await updateDoc(itemRef, itemMutable);
        } catch {
          await deleteDoc(itemRef);
          await setDoc(itemRef, {
            id: item.id,
            user_id: safeUid,
            bast_id: safeBastId,
            ...itemMutable,
            created_at: serverTimestamp(),
          });
        }
      } else {
        await setDoc(itemRef, {
          id: item.id,
          user_id: safeUid,
          bast_id: safeBastId,
          ...itemMutable,
          created_at: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn('Cloud item sync warning (saved locally):', itemPath, error);
    }
  }

  for (const oldId of existingItemIds) {
    const scopedOldId = ensureUserScopedId(safeUid, oldId, 'item');
    if (!keptIds.has(scopedOldId) && !keptIds.has(oldId)) {
      try {
        await deleteDoc(doc(db, 'bast_items', sanitizeId(oldId)));
      } catch {
        // ignore if already removed
      }
    }
  }

  return { bast: savedBast, items: savedItems };
}

export async function deleteBastWithItems(
  bastId: string,
  itemIds: string[],
  uid: string
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const safeBastId = sanitizeId(bastId);

  const currentCache = loadLocalCache(safeUid);
  saveLocalCache(safeUid, {
    bast_documents: currentCache.bast_documents.filter(
      (d) => d.id !== safeBastId
    ),
    bast_items: currentCache.bast_items.filter(
      (it) => it.bast_id !== safeBastId
    ),
  });

  for (const itemId of itemIds) {
    const safeItemId = sanitizeId(itemId);
    try {
      await deleteDoc(doc(db, 'bast_items', safeItemId));
    } catch (error) {
      console.warn('Cloud item delete warning:', safeItemId, error);
    }
  }
  try {
    await deleteDoc(doc(db, 'bast_documents', safeBastId));
  } catch (error) {
    console.warn('Cloud BAST delete warning:', safeBastId, error);
  }
}

// ============================================================================
// Realtime Listeners (Cloud Firestore Online + Isolated Local Cache)
// ============================================================================
export function subscribeUserData(
  uid: string,
  callbacks: {
    onCompanies: (companies: Company[]) => void;
    onBastDocuments: (docs: BastDocument[]) => void;
    onBastItems: (items: BastItem[]) => void;
    onSettings: (settings: AppSettings) => void;
    onSyncState: (state: 'synced' | 'error', errorMsg?: string) => void;
  }
) {
  const safeUid = sanitizeId(uid);

  if (!cacheListeners.has(safeUid)) {
    cacheListeners.set(safeUid, new Set());
  }
  const localListener: CacheListener = (cache) => {
    callbacks.onCompanies(
      cache.companies.filter((c) => c.user_id === safeUid)
    );
    callbacks.onBastDocuments(
      cache.bast_documents.filter((d) => d.user_id === safeUid)
    );
    callbacks.onBastItems(
      cache.bast_items.filter((it) => it.user_id === safeUid)
    );
    if (cache.settings && cache.settings.user_id === safeUid) {
      callbacks.onSettings(cache.settings);
    }
  };
  cacheListeners.get(safeUid)!.add(localListener);

  const qCompanies = query(
    collection(db, 'companies'),
    where('user_id', '==', safeUid)
  );
  const unsubCompanies = onSnapshot(
    qCompanies,
    (snap) => {
      const list: Company[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            user_id: String(data.user_id || ''),
            no: Number(data.no || 0),
            nama_pt: String(data.nama_pt || ''),
            nama_pejabat: String(data.nama_pejabat || ''),
            jabatan_pejabat: String(data.jabatan_pejabat || ''),
            alamat: String(data.alamat || ''),
            kota: String(data.kota || ''),
            kode_pos: String(data.kode_pos || ''),
            telepon: String(data.telepon || ''),
            email: String(data.email || ''),
            logo: String(data.logo || ''),
            created_at: timestampToIso(data.created_at),
            updated_at: timestampToIso(data.updated_at),
          };
        })
        .filter((c) => c.user_id === safeUid);

      list.sort((a, b) => a.no - b.no || a.nama_pt.localeCompare(b.nama_pt));
      saveLocalCache(safeUid, { companies: list });
      callbacks.onSyncState('synced');
    },
    (error) => {
      callbacks.onSyncState('error', error.message);
      handleFirestoreError(error, OperationType.LIST, 'companies');
    }
  );

  const qBast = query(
    collection(db, 'bast_documents'),
    where('user_id', '==', safeUid)
  );
  const unsubBast = onSnapshot(
    qBast,
    (snap) => {
      const list: BastDocument[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            user_id: String(data.user_id || ''),
            nomor_bast: String(data.nomor_bast || ''),
            tanggal_bast: String(data.tanggal_bast || ''),
            kota: String(data.kota || ''),
            company_id: String(data.company_id || ''),
            pihak_pertama_pt: String(data.pihak_pertama_pt || ''),
            pihak_pertama_nama: String(data.pihak_pertama_nama || ''),
            pihak_pertama_jabatan: String(data.pihak_pertama_jabatan || ''),
            pihak_pertama_alamat: String(data.pihak_pertama_alamat || ''),
            pihak_kedua_nama: String(data.pihak_kedua_nama || ''),
            pihak_kedua_jabatan: String(data.pihak_kedua_jabatan || ''),
            pihak_kedua_alamat: String(data.pihak_kedua_alamat || ''),
            nomor_po: String(data.nomor_po || ''),
            deskripsi_pekerjaan: String(data.deskripsi_pekerjaan || ''),
            tanggal_mulai: String(data.tanggal_mulai || ''),
            tanggal_selesai: String(data.tanggal_selesai || ''),
            status:
              data.status === 'Selesai'
                ? ('Selesai' as const)
                : ('Draft' as const),
            signature_party_1: String(data.signature_party_1 || ''),
            signature_party_2: String(data.signature_party_2 || ''),
            use_stempel: Boolean(data.use_stempel),
            created_at: timestampToIso(data.created_at),
            updated_at: timestampToIso(data.updated_at),
          };
        })
        .filter((b) => b.user_id === safeUid);

      list.sort(
        (a, b) =>
          b.tanggal_bast.localeCompare(a.tanggal_bast) ||
          b.updated_at.localeCompare(a.updated_at)
      );
      saveLocalCache(safeUid, { bast_documents: list });
      callbacks.onSyncState('synced');
    },
    (error) => {
      callbacks.onSyncState('error', error.message);
      handleFirestoreError(error, OperationType.LIST, 'bast_documents');
    }
  );

  const qItems = query(
    collection(db, 'bast_items'),
    where('user_id', '==', safeUid)
  );
  const unsubItems = onSnapshot(
    qItems,
    (snap) => {
      const list: BastItem[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            user_id: String(data.user_id || ''),
            bast_id: String(data.bast_id || ''),
            nomor: Number(data.nomor || 1),
            nama_barang_jasa: String(data.nama_barang_jasa || ''),
            keterangan: String(data.keterangan || 'Sesuai'),
            urutan: Number(data.urutan || 0),
            created_at: timestampToIso(data.created_at),
            updated_at: timestampToIso(data.updated_at),
          };
        })
        .filter((it) => it.user_id === safeUid);

      list.sort((a, b) => a.urutan - b.urutan || a.nomor - b.nomor);
      saveLocalCache(safeUid, { bast_items: list });
    },
    (error) => {
      callbacks.onSyncState('error', error.message);
      handleFirestoreError(error, OperationType.LIST, 'bast_items');
    }
  );

  const settingsRef = doc(db, 'settings', safeUid);
  const unsubSettings = onSnapshot(
    settingsRef,
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (String(d.user_id || safeUid) !== safeUid) return;
        const defaults = getDefaultSettings(safeUid);
        const loaded: AppSettings = {
          user_id: safeUid,
          nama_perusahaan: String(d.nama_perusahaan ?? defaults.nama_perusahaan),
          alamat: String(d.alamat ?? defaults.alamat),
          kota: String(d.kota ?? defaults.kota),
          telepon: String(d.telepon ?? defaults.telepon),
          email: String(d.email ?? defaults.email),
          logo: String(d.logo ?? ''),
          logo_scale: clampNum(d.logo_scale, 30, 250, 100),
          logo_x: clampNum(d.logo_x, -250, 250, 0),
          logo_y: clampNum(d.logo_y, -250, 250, 0),
          stempel: String(d.stempel ?? ''),
          stempel_scale: clampNum(d.stempel_scale, 20, 250, 100),
          stempel_x: clampNum(d.stempel_x, -200, 200, 0),
          stempel_y: clampNum(d.stempel_y, -200, 200, 0),
          stempel_target:
            d.stempel_target === 'pihak_pertama' || d.stempel_target === 'both'
              ? d.stempel_target
              : 'pihak_kedua',
          signature_party_1: String(d.signature_party_1 ?? ''),
          signature_party_2: String(d.signature_party_2 ?? ''),
          app_icon: String(d.app_icon ?? ''),
          auto_number_enabled: Boolean(d.auto_number_enabled ?? true),
          auto_number_format: String(
            d.auto_number_format || 'BAST/{NO}/{ROMAN_MONTH}/{YEAR}'
          ),
          auto_number_counter: clampNum(d.auto_number_counter, 0, 1000000, 1),
          theme: d.theme === 'dark' ? 'dark' : 'light',
          default_pihak_kedua_nama: String(
            d.default_pihak_kedua_nama ?? defaults.default_pihak_kedua_nama
          ),
          default_pihak_kedua_jabatan: String(
            d.default_pihak_kedua_jabatan ?? defaults.default_pihak_kedua_jabatan
          ),
          default_pihak_kedua_alamat: String(
            d.default_pihak_kedua_alamat ?? defaults.default_pihak_kedua_alamat
          ),
          created_at: timestampToIso(d.created_at),
          updated_at: timestampToIso(d.updated_at),
        };
        saveLocalCache(safeUid, { settings: loaded });
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${safeUid}`);
    }
  );

  return () => {
    cacheListeners.get(safeUid)?.delete(localListener);
    unsubCompanies();
    unsubBast();
    unsubItems();
    unsubSettings();
  };
}

// ============================================================================
// Initial Per-User Sample Data Seeding (Isolated by user_id)
// ============================================================================
export async function seedInitialSampleDataIfEmpty(uid: string): Promise<void> {
  const safeUid = sanitizeId(uid);
  const seededKey = `bast_seeded_v3_${safeUid}`;
  if (localStorage.getItem(seededKey) === 'true') {
    return;
  }

  try {
    const existingBastSnap = await getDocs(
      query(collection(db, 'bast_documents'), where('user_id', '==', safeUid))
    );
    if (!existingBastSnap.empty) {
      localStorage.setItem(seededKey, 'true');
      return;
    }

    const compId = ensureUserScopedId(safeUid, 'comp_sample_kansai', 'comp');
    const bastId = ensureUserScopedId(safeUid, 'bast_sample_001', 'bast');

    await saveCompanyRecord(
      safeUid,
      {
        id: compId,
        user_id: safeUid,
        no: 1,
        nama_pt: 'PT. KANSAI PAINT INDONESIA',
        nama_pejabat: 'MUHAMAD RIDHO',
        jabatan_pejabat: 'Perwakilan Perusahaan',
        alamat:
          'Blok DD-7 & DD-6 Kawasan Industri MM2100 Cikarang Barat Kab. Bekasi, 17847',
        kota: 'Bekasi',
        kode_pos: '17847',
        telepon: '',
        email: '',
        logo: '',
      },
      false
    );

    await saveBastWithItems(
      safeUid,
      {
        id: bastId,
        user_id: safeUid,
        nomor_bast: 'BAST/001/V/2025',
        tanggal_bast: '2025-05-14',
        kota: 'Bogor',
        company_id: compId,
        pihak_pertama_pt: 'PT. KANSAI PAINT INDONESIA',
        pihak_pertama_nama: 'MUHAMAD RIDHO',
        pihak_pertama_jabatan: '',
        pihak_pertama_alamat:
          'Blok DD-7 & DD-6 Kawasan Industri MM2100 Cikarang Barat Kab. Bekasi, 17847',
        pihak_kedua_nama: 'MUHAMAD RIDHO',
        pihak_kedua_jabatan: '',
        pihak_kedua_alamat:
          'Jln. Letda Nasir No. 58 Bogor, 16966 Kel. Cikeas Udik Kec. Gunung Putri Bogor',
        nomor_po: 'KPIN-MIS-2503-035',
        deskripsi_pekerjaan:
          'Perbaikan Unit AC Floor Standing 10 PK Fuji Elektrik',
        tanggal_mulai: '2025-05-14',
        tanggal_selesai: '2025-05-14',
        status: 'Selesai',
        signature_party_1: '',
        signature_party_2: '',
        use_stempel: true,
      },
      [
        {
          id: ensureUserScopedId(safeUid, 'item_sample_1', 'item'),
          nomor: 1,
          nama_barang_jasa:
            'Rewinding Motor Fan Outdoor AC Floor Standing 10 PK Fuji Elektrik',
          keterangan: 'Sesuai',
          urutan: 0,
        },
        {
          id: ensureUserScopedId(safeUid, 'item_sample_2', 'item'),
          nomor: 2,
          nama_barang_jasa: 'Kapasitor Fan Outdoor 10uf mc',
          keterangan: 'Sesuai',
          urutan: 1,
        },
        {
          id: ensureUserScopedId(safeUid, 'item_sample_3', 'item'),
          nomor: 3,
          nama_barang_jasa: 'Bearing Koyo Japan',
          keterangan: 'Sesuai',
          urutan: 2,
        },
        {
          id: ensureUserScopedId(safeUid, 'item_sample_4', 'item'),
          nomor: 4,
          nama_barang_jasa: 'Jasa Perbaikan dan Bongkar Pasang',
          keterangan: 'Sesuai',
          urutan: 3,
        },
      ],
      []
    );

    localStorage.setItem(seededKey, 'true');
  } catch {
    // Ignore seed error when offline
  }
}

// ============================================================================
// Restore JSON Execution (Merge or Replace)
// ============================================================================
export async function restoreFromBackupPayload(
  uid: string,
  payload: {
    settings?: Partial<AppSettings>;
    companies: Company[];
    bast_documents: BastDocument[];
    bast_items: BastItem[];
  },
  mode: 'merge' | 'replace'
): Promise<void> {
  const safeUid = sanitizeId(uid);

  if (mode === 'replace') {
    saveLocalCache(safeUid, {
      companies: [],
      bast_documents: [],
      bast_items: [],
    });

    try {
      const existingItemsSnap = await getDocs(
        query(collection(db, 'bast_items'), where('user_id', '==', safeUid))
      );
      for (const d of existingItemsSnap.docs) {
        await deleteDoc(doc(db, 'bast_items', d.id));
      }

      const existingBastSnap = await getDocs(
        query(collection(db, 'bast_documents'), where('user_id', '==', safeUid))
      );
      for (const d of existingBastSnap.docs) {
        await deleteDoc(doc(db, 'bast_documents', d.id));
      }

      const existingCompSnap = await getDocs(
        query(collection(db, 'companies'), where('user_id', '==', safeUid))
      );
      for (const d of existingCompSnap.docs) {
        await deleteDoc(doc(db, 'companies', d.id));
      }
    } catch (error) {
      console.warn('Cloud replace cleanup warning:', error);
    }
  }

  if (payload.settings) {
    const defaults = getDefaultSettings(safeUid);
    await saveUserSettings(safeUid, {
      ...defaults,
      ...payload.settings,
      user_id: safeUid,
    });
  }

  const oldToNewCompId = new Map<string, string>();
  const validCompanyIds = new Set<string>();
  for (const comp of payload.companies || []) {
    const rawCompId = sanitizeId(comp.id || generateSafeId('comp'));
    const scopedCompId = ensureUserScopedId(safeUid, rawCompId, 'comp');
    const saved = await saveCompanyRecord(
      safeUid,
      {
        ...comp,
        id: scopedCompId,
        user_id: safeUid,
      },
      mode === 'merge'
    );
    oldToNewCompId.set(rawCompId, saved.id);
    oldToNewCompId.set(comp.id, saved.id);
    validCompanyIds.add(saved.id);
  }

  if (mode === 'merge') {
    const cachedComps = loadLocalCache(safeUid).companies;
    cachedComps.forEach((c) => validCompanyIds.add(c.id));
  }

  const itemsByBast = new Map<string, BastItem[]>();
  for (const item of payload.bast_items || []) {
    const bId = sanitizeId(item.bast_id || '');
    if (!itemsByBast.has(bId)) itemsByBast.set(bId, []);
    itemsByBast.get(bId)!.push(item);
  }

  for (const bast of payload.bast_documents || []) {
    const rawBastId = sanitizeId(bast.id || generateSafeId('bast'));
    const scopedBastId = ensureUserScopedId(safeUid, rawBastId, 'bast');
    const mappedCompId = bast.company_id
      ? oldToNewCompId.get(bast.company_id) ||
        ensureUserScopedId(safeUid, bast.company_id, 'comp')
      : '';
    const compId =
      mappedCompId && validCompanyIds.has(mappedCompId) ? mappedCompId : '';

    const relatedItems =
      itemsByBast.get(rawBastId) || itemsByBast.get(scopedBastId) || [];

    await saveBastWithItems(
      safeUid,
      {
        ...bast,
        id: scopedBastId,
        user_id: safeUid,
        company_id: compId,
      },
      relatedItems.map((it, i) => ({
        id: ensureUserScopedId(
          safeUid,
          it.id || generateSafeId('item'),
          'item'
        ),
        nomor: it.nomor || i + 1,
        nama_barang_jasa: it.nama_barang_jasa || '-',
        keterangan: it.keterangan || 'Sesuai',
        urutan: it.urutan ?? i,
      })),
      []
    );
  }
}
