# Export Storage Boundary

Created: 2026-06-20 JST  

## Status

Generated DOCX/PDF exports now go through `ObjectStoragePort`. The default adapter is `LocalObjectStorageAdapter`; it writes to the local export directory for development and returns short-lived signed URLs.

The API response no longer exposes local filesystem paths. Export records keep storage metadata:

- `storageKey`
- `filename`
- `mimeType`
- `sizeBytes`
- `checksum`
- `expiresAt`
- signed `fileUrl`

## Signed URL Rules

- A signed URL is bound to `storageKey`, owner `userId`, and expiry time.
- Missing, tampered, expired, or cross-user tokens return `404 NOT_FOUND`.
- The download route reads via the storage port instead of reconstructing a path from the URL.
- Path traversal storage keys are rejected before writing or reading.

## Future Adapter

The port shape is ready for S3-compatible storage:

- `putObject`
- `getObject`
- `signGetUrl`
- `verifySignedUrl`
- `deleteObject`
- `cleanupPrefix`

No production S3 bucket, MinIO service, remote credentials, or customer data migration is introduced here.

## Pause Lines

No marketplace, success-fee, platform take-rate, proxy drafting/submission, jGrants POST, or production `SubmissionAdapter` is introduced.
