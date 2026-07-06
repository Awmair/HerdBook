# Security

## Hard Rules

Never commit:

- OAuth client secrets
- service account JSON files
- refresh tokens
- access tokens
- API keys
- private keys
- `.env` files
- generated credential files
- real farm data

## Safe Public Config

A Google browser OAuth client ID may be present in frontend code because it is not a secret.

HerdBook is a browser-only app. It must not use or store a Google OAuth client secret.

## Data Boundary

The public GitHub repository contains app code and demo/sample data only. Real farm records belong in the user's own Google Drive and local iPhone storage.

## Local Storage Boundary

IndexedDB keeps a local mirror on the iPhone so the app is fast and resilient offline. If Safari website data is manually cleared, the local mirror can be removed. Google Drive sync and JSON backups are the recovery path.
