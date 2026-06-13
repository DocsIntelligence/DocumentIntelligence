# 10 — Document Vault (entities + their documents, secure, autofill) — RESUME

**Status:** IN PROGRESS (backend-first). **Last updated:** 2026-06-13.
**Goal:** a per-user (and per-org) **vault** of **entities** — a person, company, or other party —
each holding **structured details** (Aadhaar name, PAN, address, GSTIN, …) **and** the **original
documents** (Aadhaar card scan, PAN card, incorporation cert). The vault then **autofills** those
details into legal-document forms (pick "Landlord = Ramesh" → his fields drop into the party section),
so the user enters identity data once and reuses it everywhere.

## Why this is the right shape
- The platform drafts documents whose forms repeat the same party data (names, addresses, IDs). A
  reusable identity store removes re-typing and reduces transcription errors.
- It's a natural home for KYC-style uploads, and a clean seam for future OCR autofill (reuse the
  intelligence extractor to read an uploaded Aadhaar → prefill fields).

## Security model (this is the hard requirement — Aadhaar/PAN are sensitive PII)
- **Encryption at rest:** the entire structured-fields JSON is encrypted with **AES-256-GCM**
  (`VaultCryptoService`, key from `VAULT_ENCRYPTION_KEY`, 32 bytes base64). Plaintext field values
  never touch a column. Ciphertext stored as `iv:tag:ciphertext` (base64). Prod **requires** the key;
  dev derives a deterministic key with a loud warning.
- **Masking by default:** list/detail responses return sensitive fields masked (`XXXX-XXXX-1234`).
  Full values only via an explicit **reveal** endpoint, which writes a `VaultAccessLog` row.
- **Access control:** strictly owner-scoped (or org-scoped via `OrgMember`), same pattern as documents.
- **Documents in S3:** private; only short-lived **presigned** download URLs (reuse `StorageService`).
- **Audit:** `VaultAccessLog` records reveal / document-download / delete with userId + timestamp.
- **No PII in logs:** reuse `redactPii` (already added). Field keys logged, never values.
- **Legal note (not advice):** Aadhaar storage is constrained (Aadhaar Act §) and DPDP Act 2023
  applies — hence encryption + masking + audit + easy user-initiated delete (data minimisation).

## Data model (Prisma)
```
VaultEntity { id, ownerUserId?, ownerOrgId?, kind('person'|'company'|'other'),
              label (display, plaintext), dataEncrypted (String? — AES-GCM of {key:value}),
              createdAt, updatedAt }   // + documents[], accessLogs[]
VaultDocument { id, entityId, kind('aadhaar'|'pan'|'passport'|'incorporation'|'gst'|'other'),
                filename, contentType, byteSize?, s3Key, checksum?, createdAt }
VaultAccessLog { id, entityId, userId, action('reveal'|'download'|'update'|'delete'|'create'),
                 detail?, createdAt }
```
Field **keys** are canonical (e.g. `full_name`, `father_name`, `dob`, `aadhaar_number`, `pan`, `phone`,
`email`, `address_line1`, `city`, `state`, `pincode` for persons; `legal_name`, `cin`, `gstin`, `pan`,
`registered_office`, … for companies). The **sensitivity registry** (`SENSITIVE_KEYS`) marks which keys
are masked. Canonical keys are what makes **autofill** mappable onto form fields.

## API (`/vault`, JwtAuthGuard, owner/org-scoped)
- `GET /vault/entities` · `POST /vault/entities` · `GET /vault/entities/:id` (masked) ·
  `PATCH /vault/entities/:id` · `DELETE /vault/entities/:id`
- `GET /vault/entities/:id/reveal` — decrypted fields (audited) — for editing + autofill
- `POST /vault/entities/:id/documents` (multipart) · `GET …/documents/:docId/url` (presigned) ·
  `DELETE …/documents/:docId`
- `GET /vault/entities/:id/autofill` — canonical fields → consumed by the builder's "Insert from vault"

## Autofill integration (builder)
Pick an entity for a party section → its canonical fields map onto the section's form fields by a
canonical-key resolver. v1: return decrypted canonical fields; the builder merges by name heuristics
(`full_name`→name, `aadhaar_number`→aadhaar, address parts→address). Per-doc-type maps later.

## Build order / status
- [x] config key, design doc, ledger.
- [~] Prisma models + migration (via the drift-safe wrapper).
- [~] VaultCryptoService (AES-256-GCM) + VaultService (CRUD/encrypt/mask/reveal/docs/audit) + controller + DTO + module.
- [ ] Frontend: api-client + Vault page (list/create/detail, fields editor, doc upload, masked + reveal) + nav + i18n.
- [ ] Builder "Insert from vault" autofill affordance.
- [ ] Later: OCR autofill (uploaded Aadhaar/PAN → extract → prefill via the intelligence engine).
