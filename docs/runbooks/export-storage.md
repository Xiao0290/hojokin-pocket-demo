# Export Storage Runbook

Date: 2026-06-20 JST  
Gate: `v0.2-alpha-foundation`

## Purpose

This runbook covers generated DOCX/PDF exports after `ObjectStoragePort` was
introduced. Local development writes to disk, but services interact with the
storage port and signed URLs instead of exposing filesystem paths.

## Current Boundary

- Default adapter: `LocalObjectStorageAdapter`.
- Default directory: `data/exports`, override with `EXPORT_DIR`.
- Signing secret: `EXPORT_SIGNING_SECRET`, with a local development fallback.
- Export records include `storageKey`, `filename`, `mimeType`, `sizeBytes`,
  `checksum`, `expiresAt`, and signed `fileUrl`.
- Downloads require a token bound to `storageKey`, `userId`, and expiry.
- Missing, tampered, expired, or cross-user tokens return `404 NOT_FOUND`.
- Download audit events use `file.downloaded` and do not log signed tokens.

## Verification

Run focused checks:

```sh
node --test --test-concurrency=1 tests/object-storage-port.test.mjs tests/export-storage.test.mjs tests/server-services.test.mjs
```

Run the behavior gate:

```sh
npm run test:quality-gates
```

Run the full release gate:

```sh
npm run verify:ci
```

## Local Operation

For isolated local exports:

```sh
EXPORT_DIR=/tmp/hojokin-pocket-exports EXPORT_SIGNING_SECRET=local-only-secret npm run dev:api
```

The client should use the returned `fileUrl` as-is. Do not reconstruct a local
path from the URL.

## Cleanup and Retention

- Export records expire after 15 minutes in the local MVP.
- `cleanupExpiredExports` can remove expired local records and legacy local files.
- Future S3-compatible adapters must keep the same signed URL and expiry behavior.
- Production object lifecycle settings must be documented before any managed bucket is used.

## Troubleshooting

If a valid-looking download returns `404`:

- Confirm the caller is the same user that created the export.
- Confirm the token is copied with the full query string.
- Confirm the export record has not expired.
- Confirm `EXPORT_SIGNING_SECRET` did not change between export and download.
- Confirm the storage key does not contain path traversal segments.

## Pause Lines

Do not add production S3 credentials, remote object writes, customer data migration, marketplace behavior, success-fee, platform take-rate, proxy drafting/submission, jGrants POST, or production `SubmissionAdapter` in this storage boundary.
