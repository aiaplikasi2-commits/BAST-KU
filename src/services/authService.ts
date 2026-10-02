import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

export interface ActiveAuthUser {
  uid: string;
  email: string;
  displayName: string;
  isCloudConnected: boolean;
}

interface StoredAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  saltHex: string;
  hashHex: string;
  createdAt: string;
  updatedAt: string;
}

const ACCOUNTS_STORAGE_KEY = 'bast_auth_accounts_v2';
const ACTIVE_SESSION_LOCAL_KEY = 'bast_active_session_v2';
const ACTIVE_SESSION_TEMP_KEY = 'bast_active_session_temp_v2';

const authListeners = new Set<(user: ActiveAuthUser | null) => void>();

function notifyAuthListeners(user: ActiveAuthUser | null) {
  authListeners.forEach((cb) => cb(user));
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : '0' + hex;
  const arr = new Uint8Array(clean.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/**
 * Derives a cryptographic PBKDF2-SHA256 hash using Web Crypto API.
 * Passwords are never stored in plain text.
 */
async function derivePasswordHash(
  password: string,
  saltHex: string
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = hexToBytes(saltHex);
  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits);
}

function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return bufferToHex(bytes);
}

export function generateDeterministicUid(email: string): string {
  const normalized = email.trim().toLowerCase();
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0, ch; i < normalized.length; i++) {
    ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex =
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0');
  return `usr_${hex}`;
}

function loadStoredAccounts(): Record<string, StoredAccountRecord> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, StoredAccountRecord>;
  } catch {
    // ignore
  }
  return {};
}

function saveStoredAccounts(accounts: Record<string, StoredAccountRecord>) {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore
  }
}

async function fetchCloudAccount(
  uid: string
): Promise<StoredAccountRecord | null> {
  try {
    const snap = await getDoc(doc(db, 'auth_accounts', uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        uid: String(d.uid || uid),
        email: String(d.email || ''),
        displayName: String(d.displayName || 'Pengguna BAST'),
        saltHex: String(d.saltHex || ''),
        hashHex: String(d.hashHex || ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {
    // Offline or unavailable, fallback to local cache
  }
  return null;
}

async function saveCloudAccount(
  record: StoredAccountRecord,
  isUpdate = false
): Promise<void> {
  const ref = doc(db, 'auth_accounts', record.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists() || isUpdate) {
      await updateDoc(ref, {
        displayName: record.displayName.slice(0, 150),
        saltHex: record.saltHex,
        hashHex: record.hashHex,
        updated_at: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        id: record.uid,
        uid: record.uid,
        email: record.email.slice(0, 254),
        displayName: record.displayName.slice(0, 150),
        saltHex: record.saltHex,
        hashHex: record.hashHex,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    }
  } catch {
    // Offline fallback already saved in localStorage
  }
}

export function getSavedAuthSession(): ActiveAuthUser | null {
  try {
    const rawLocal = localStorage.getItem(ACTIVE_SESSION_LOCAL_KEY);
    if (rawLocal) return JSON.parse(rawLocal) as ActiveAuthUser;
    const rawTemp = sessionStorage.getItem(ACTIVE_SESSION_TEMP_KEY);
    if (rawTemp) return JSON.parse(rawTemp) as ActiveAuthUser;
  } catch {
    // ignore
  }

  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email || '',
      displayName:
        auth.currentUser.displayName ||
        auth.currentUser.email?.split('@')[0] ||
        'Pengguna BAST',
      isCloudConnected: true,
    };
  }

  return null;
}

function setSavedAuthSession(user: ActiveAuthUser | null, rememberMe = true) {
  try {
    localStorage.removeItem(ACTIVE_SESSION_LOCAL_KEY);
    sessionStorage.removeItem(ACTIVE_SESSION_TEMP_KEY);
    if (user) {
      if (rememberMe) {
        localStorage.setItem(ACTIVE_SESSION_LOCAL_KEY, JSON.stringify(user));
      } else {
        sessionStorage.setItem(ACTIVE_SESSION_TEMP_KEY, JSON.stringify(user));
      }
    }
  } catch {
    // ignore
  }
}

export function subscribeAuthChanges(
  callback: (user: ActiveAuthUser | null) => void
): () => void {
  authListeners.add(callback);

  const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
    const savedSession = getSavedAuthSession();
    if (fbUser) {
      // If there is already a different PBKDF2 user session active, do not overwrite it
      if (
        savedSession &&
        savedSession.uid.startsWith('usr_') &&
        savedSession.email.toLowerCase() !== (fbUser.email || '').toLowerCase()
      ) {
        notifyAuthListeners(savedSession);
        return;
      }

      const active: ActiveAuthUser = {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName:
          fbUser.displayName ||
          fbUser.email?.split('@')[0] ||
          'Pengguna BAST',
        isCloudConnected: true,
      };
      setSavedAuthSession(active, true);
      notifyAuthListeners(active);
    } else {
      notifyAuthListeners(savedSession);
    }
  });

  return () => {
    authListeners.delete(callback);
    unsubFirebase();
  };
}

export async function loginWithEmailAndPasswordService(
  emailInput: string,
  passwordInput: string,
  rememberMe: boolean
): Promise<ActiveAuthUser> {
  const cleanEmail = emailInput.trim().toLowerCase();

  // Clear any previous mismatched Firebase Auth session (e.g. from another user's Google login)
  if (
    auth.currentUser &&
    (auth.currentUser.email || '').toLowerCase() !== cleanEmail
  ) {
    await signOut(auth);
  }

  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );

  // 1. Try Firebase Auth first
  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      passwordInput
    );
    const active: ActiveAuthUser = {
      uid: cred.user.uid,
      email: cred.user.email || cleanEmail,
      displayName:
        cred.user.displayName || cleanEmail.split('@')[0] || 'Pengguna BAST',
      isCloudConnected: true,
    };
    setSavedAuthSession(active, rememberMe);
    notifyAuthListeners(active);
    return active;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: string }).code)
        : '';

    if (
      code !== 'auth/operation-not-allowed' &&
      code !== 'auth/wrong-password' &&
      code !== 'auth/invalid-credential' &&
      code !== 'auth/user-not-found'
    ) {
      throw err;
    }
  }

  // Ensure auth.currentUser is signed out so Firestore uses our deterministic PBKDF2 owner rules cleanly
  if (auth.currentUser) {
    await signOut(auth);
  }

  // 2. Online Cloud Firestore + PBKDF2-SHA256 Auth Engine
  const uid = generateDeterministicUid(cleanEmail);
  const accounts = loadStoredAccounts();
  let existing = await fetchCloudAccount(uid);

  if (existing) {
    accounts[cleanEmail] = existing;
    saveStoredAccounts(accounts);
  } else {
    existing = accounts[cleanEmail] || null;
  }

  if (existing) {
    const computedHash = await derivePasswordHash(
      passwordInput,
      existing.saltHex
    );
    if (computedHash !== existing.hashHex) {
      throw new Error(
        'Email atau password yang Anda masukkan salah. Silakan periksa kembali.'
      );
    }

    // Ensure synced to Cloud Firestore
    await saveCloudAccount(existing, false);

    const active: ActiveAuthUser = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      isCloudConnected: true,
    };
    setSavedAuthSession(active, rememberMe);
    notifyAuthListeners(active);
    return active;
  } else {
    // Auto-provision new cloud account on first login
    const saltHex = generateSaltHex();
    const hashHex = await derivePasswordHash(passwordInput, saltHex);
    const displayName = cleanEmail.split('@')[0] || 'Pengguna BAST';
    const now = new Date().toISOString();

    const newRecord: StoredAccountRecord = {
      uid,
      email: cleanEmail,
      displayName,
      saltHex,
      hashHex,
      createdAt: now,
      updatedAt: now,
    };

    accounts[cleanEmail] = newRecord;
    saveStoredAccounts(accounts);
    await saveCloudAccount(newRecord, false);

    const active: ActiveAuthUser = {
      uid,
      email: cleanEmail,
      displayName,
      isCloudConnected: true,
    };
    setSavedAuthSession(active, rememberMe);
    notifyAuthListeners(active);
    return active;
  }
}

export async function registerWithEmailAndPasswordService(
  fullName: string,
  emailInput: string,
  passwordInput: string,
  rememberMe: boolean
): Promise<ActiveAuthUser> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanName = fullName.trim() || cleanEmail.split('@')[0] || 'Pengguna';

  if (
    auth.currentUser &&
    (auth.currentUser.email || '').toLowerCase() !== cleanEmail
  ) {
    await signOut(auth);
  }

  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );

  const uid = generateDeterministicUid(cleanEmail);
  const accounts = loadStoredAccounts();
  const cloudExisting = await fetchCloudAccount(uid);

  if (cloudExisting || accounts[cleanEmail]) {
    throw new Error(
      'Alamat email ini sudah terdaftar. Silakan masuk menggunakan menu Login.'
    );
  }

  // 1. Try Firebase Auth first
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      passwordInput
    );
    await updateProfile(cred.user, { displayName: cleanName });

    const active: ActiveAuthUser = {
      uid: cred.user.uid,
      email: cleanEmail,
      displayName: cleanName,
      isCloudConnected: true,
    };
    setSavedAuthSession(active, rememberMe);
    notifyAuthListeners(active);
    return active;
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: string }).code)
        : '';
    if (code === 'auth/email-already-in-use') {
      throw new Error(
        'Alamat email ini sudah terdaftar. Silakan masuk menggunakan menu Login.'
      );
    }
    if (code !== 'auth/operation-not-allowed') {
      throw err;
    }
  }

  if (auth.currentUser) {
    await signOut(auth);
  }

  // 2. Register in Cloud Firestore + PBKDF2-SHA256
  const saltHex = generateSaltHex();
  const hashHex = await derivePasswordHash(passwordInput, saltHex);
  const now = new Date().toISOString();

  const newRecord: StoredAccountRecord = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    saltHex,
    hashHex,
    createdAt: now,
    updatedAt: now,
  };

  accounts[cleanEmail] = newRecord;
  saveStoredAccounts(accounts);
  await saveCloudAccount(newRecord, false);

  const active: ActiveAuthUser = {
    uid,
    email: cleanEmail,
    displayName: cleanName,
    isCloudConnected: true,
  };
  setSavedAuthSession(active, rememberMe);
  notifyAuthListeners(active);
  return active;
}

export async function resetPasswordService(
  emailInput: string,
  newPassword?: string
): Promise<string> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const uid = generateDeterministicUid(cleanEmail);

  if (newPassword && newPassword.length >= 6) {
    const accounts = loadStoredAccounts();
    const cloudAcc = await fetchCloudAccount(uid);
    const existing = cloudAcc || accounts[cleanEmail];
    const saltHex = generateSaltHex();
    const hashHex = await derivePasswordHash(newPassword, saltHex);
    const now = new Date().toISOString();

    const updatedRecord: StoredAccountRecord = {
      uid,
      email: cleanEmail,
      displayName:
        existing?.displayName || cleanEmail.split('@')[0] || 'Pengguna BAST',
      saltHex,
      hashHex,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    accounts[cleanEmail] = updatedRecord;
    saveStoredAccounts(accounts);
    await saveCloudAccount(updatedRecord, Boolean(cloudAcc));
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return `Password berhasil diperbarui secara online dan tautan konfirmasi juga telah dikirim ke ${cleanEmail}. Silakan login dengan password baru Anda.`;
  } catch {
    if (newPassword && newPassword.length >= 6) {
      return `Password untuk akun ${cleanEmail} telah berhasil di-reset secara online. Silakan masuk menggunakan password baru Anda.`;
    }
    throw new Error(
      'Masukkan password baru minimal 6 karakter untuk me-reset password Anda.'
    );
  }
}

export async function changePasswordService(
  emailInput: string,
  newPassword: string
): Promise<void> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const uid = generateDeterministicUid(cleanEmail);
  const accounts = loadStoredAccounts();
  const cloudAcc = await fetchCloudAccount(uid);
  const existing = cloudAcc || accounts[cleanEmail];
  const saltHex = generateSaltHex();
  const hashHex = await derivePasswordHash(newPassword, saltHex);
  const now = new Date().toISOString();

  const updatedRecord: StoredAccountRecord = {
    uid,
    email: cleanEmail,
    displayName:
      existing?.displayName || cleanEmail.split('@')[0] || 'Pengguna BAST',
    saltHex,
    hashHex,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  accounts[cleanEmail] = updatedRecord;
  saveStoredAccounts(accounts);
  await saveCloudAccount(updatedRecord, Boolean(cloudAcc));

  if (
    auth.currentUser &&
    (auth.currentUser.email || '').toLowerCase() === cleanEmail
  ) {
    try {
      await updatePassword(auth.currentUser, newPassword);
    } catch {
      // Ignore if Google OAuth session
    }
  }
}

export async function loginWithGoogleService(
  rememberMe: boolean
): Promise<ActiveAuthUser> {
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );
  const cred = await signInWithPopup(auth, googleProvider);
  const active: ActiveAuthUser = {
    uid: cred.user.uid,
    email: cred.user.email || '',
    displayName:
      cred.user.displayName ||
      cred.user.email?.split('@')[0] ||
      'Pengguna BAST',
    isCloudConnected: true,
  };
  setSavedAuthSession(active, rememberMe);
  notifyAuthListeners(active);
  return active;
}

export async function logoutService(): Promise<void> {
  setSavedAuthSession(null, true);
  if (auth.currentUser) {
    await signOut(auth);
  }
  notifyAuthListeners(null);
}
