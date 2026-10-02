/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  docId: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Company Create',
    collection: 'companies',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'comp_1',
    payload: { id: 'comp_1', user_id: 'user_B', no: 1, nama_pt: 'PT Test', nama_pejabat: 'Budi' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on BAST Create',
    collection: 'bast_documents',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'bast_1',
    payload: { id: 'bast_1', user_id: 'user_A', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Write Attempt',
    collection: 'settings',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: false },
    docId: 'user_A',
    payload: { user_id: 'user_A', nama_perusahaan: 'CV Mulia' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Cross-Tenant PII Read on /users/{userId}',
    collection: 'users',
    operation: 'get',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'user_B',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unfiltered List Query Scraping on /bast_documents',
    collection: 'bast_documents',
    operation: 'list',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: '*',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Line Item Create on /bast_items',
    collection: 'bast_items',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'item_1',
    payload: { id: 'item_1', user_id: 'user_A', bast_id: 'non_existent_bast', nomor: 1, nama_barang_jasa: 'AC', keterangan: 'Sesuai', urutan: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Cross-Tenant Parent Attachment on /bast_items',
    collection: 'bast_items',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'item_1',
    payload: { id: 'item_1', user_id: 'user_A', bast_id: 'bast_owned_by_B', nomor: 1, nama_barang_jasa: 'AC', keterangan: 'Sesuai', urutan: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation on Update',
    collection: 'bast_documents',
    operation: 'update',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'bast_1',
    payload: { user_id: 'user_B' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    collection: 'companies',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'comp_1',
    payload: { created_at: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Denial of Wallet / Oversized String Payload',
    collection: 'companies',
    operation: 'update',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'comp_1',
    payload: { nama_pt: 'A'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid Enum State Injection',
    collection: 'bast_documents',
    operation: 'update',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'bast_1',
    payload: { status: 'InvalidState' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'ID Poisoning Attack',
    collection: 'companies',
    operation: 'create',
    auth: { uid: 'user_A', email: 'a@example.com', email_verified: true },
    docId: 'invalid$id!with*spaces',
    payload: { id: 'invalid$id!with*spaces', user_id: 'user_A' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
