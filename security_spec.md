# Security Specification — BAST (Berita Acara Serah Terima)

## 1. Data Invariants & Master Source of Truth

1. **Strict Tenant Isolation (`user_id == request.auth.uid`)**:
   Every document in `/users/{userId}`, `/companies/{companyId}`, `/bast_documents/{bastId}`, `/bast_items/{itemId}`, and `/settings/{userId}` belongs exclusively to a single authenticated and email-verified user (`request.auth.uid`). No cross-user reads, list queries, writes, or deletes are permitted under any circumstances.
2. **Verified Identity Requirement**:
   All standard access requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable & ID Integrity**:
   All document IDs must match `^[a-zA-Z0-9_\-]+$` with length `<= 128`, and internal `id` / `user_id` fields must match the path parameter and `request.auth.uid`.
4. **Relational Integrity for Line Items (`bast_items`)**:
   A `BastItem` cannot be created unless its parent `/bast_documents/$(incoming().bast_id)` exists and is owned by `request.auth.uid`.
5. **Temporal & Immortal Field Integrity**:
   `created_at` must equal `request.time` on creation and remain immutable on updates. `updated_at` must equal `request.time` on both creation and updates. Ownership fields (`user_id`, `id`, `bast_id`) are strictly immutable after creation.
6. **Zero Shadow Fields**:
   Every `create` enforces exact required keys via `hasAll` and `hasOnly`. Every `update` validates the complete resulting document via `isValid[Entity](incoming())` AND restricts modified keys via `incoming().diff(existing()).affectedKeys().hasOnly(...)`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Company Create)**:
   Authenticated user `user_A` creates `/companies/comp_1` with `user_id: "user_B"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Shadow Field Injection on BAST Create)**:
   Authenticated user `user_A` creates `/bast_documents/bast_1` with an extra field `"isAdmin": true`. -> `PERMISSION_DENIED`
3. **Payload 3 (Unverified Email Write Attempt)**:
   Authenticated user `user_A` with `email_verified: false` attempts to create `/settings/user_A`. -> `PERMISSION_DENIED`
4. **Payload 4 (Cross-Tenant PII Read on `/users/{userId}`)**:
   Authenticated user `user_A` attempts `get` on `/users/user_B`. -> `PERMISSION_DENIED`
5. **Payload 5 (Unfiltered List Query Scraping on `/bast_documents`)**:
   Authenticated user `user_A` runs an unconstrained `list` query on `/bast_documents` where documents belong to `user_B`. -> `PERMISSION_DENIED`
6. **Payload 6 (Orphaned Line Item Create on `/bast_items`)**:
   Authenticated user `user_A` creates `/bast_items/item_1` pointing to a non-existent `bast_id: "ghost_bast"`. -> `PERMISSION_DENIED`
7. **Payload 7 (Cross-Tenant Parent Attachment on `/bast_items`)**:
   Authenticated user `user_A` creates `/bast_items/item_1` pointing to `bast_id: "bast_owned_by_B"`. -> `PERMISSION_DENIED`
8. **Payload 8 (Immortal Field Mutation on Update)**:
   Authenticated user `user_A` updates `/bast_documents/bast_1` and mutates `created_at` or `user_id`. -> `PERMISSION_DENIED`
9. **Payload 9 (Client Timestamp Forgery)**:
   Authenticated user `user_A` creates `/companies/comp_1` with a backdated `created_at` timestamp (`request.time - 1 day`). -> `PERMISSION_DENIED`
10. **Payload 10 (Denial of Wallet / Oversized Payload)**:
    Authenticated user `user_A` updates `/companies/comp_1` with `nama_pt` of length `5000` characters (exceeding `maxLength: 200`). -> `PERMISSION_DENIED`
11. **Payload 11 (Invalid Enum State Injection)**:
    Authenticated user `user_A` updates `/bast_documents/bast_1` with `status: "HackedStatus"` (not in `['Draft', 'Selesai']`). -> `PERMISSION_DENIED`
12. **Payload 12 (ID Poisoning Attack)**:
    Authenticated user `user_A` attempts to create `/companies/invalid$id!with*spaces` or ID > 128 chars. -> `PERMISSION_DENIED`
