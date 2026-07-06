# HerdBook

HerdBook is a Drive-first iPhone Home Screen web app for goat farm records. It is built as a static PWA so it can be hosted on GitHub Pages and shared with one farm owner through a normal HTTPS link.

## Current Status

The first local build is in place:

- iPhone-first PWA shell
- Open Book Goat app icon
- First-run farm setup
- Local IndexedDB persistence
- Dashboard
- Goat records
- Health records
- Breeding and kidding records
- Weight and milk logs
- Tasks
- Expenses and simple profit/loss summary
- JSON backup/import
- Goats CSV export
- QR/tag profile links
- Google Drive sync hooks

Google Drive sync is ready for configuration but needs a browser OAuth client ID in `config.js`.

## Run Locally

This is a static app. Open `index.html` directly for a quick look, or serve the folder locally so service worker behavior matches GitHub Pages more closely:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

## Deployment

Target deployment is GitHub Pages from the public `Awmair/HerdBook` repository:

```text
https://awmair.github.io/HerdBook/
```

No custom domain is planned for the first deployment.

## Security Rule

Do not commit private Google credentials, OAuth client secrets, service account files, tokens, `.env` files, private keys, or real farm data.

A browser OAuth client ID may be committed because it is public configuration, not a secret. HerdBook must never use a client secret in browser code.

## Documentation

- Product spec: [HERDBOOK_SPEC.md](HERDBOOK_SPEC.md)
- Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Google Drive setup: [docs/GOOGLE_DRIVE_SETUP.md](docs/GOOGLE_DRIVE_SETUP.md)
- Security: [docs/SECURITY.md](docs/SECURITY.md)
- Design direction: [docs/DESIGN.md](docs/DESIGN.md)
