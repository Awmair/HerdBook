# Google Drive Setup

HerdBook uses Google Drive as the primary cloud copy and keeps a local IndexedDB mirror on the iPhone.

## Required Google Configuration

Create a Google Cloud project and configure OAuth for a browser-based web app.

Required API:

- Google Drive API

Required OAuth scope:

```text
https://www.googleapis.com/auth/drive.appdata
```

This scope lets HerdBook store app-specific files in the user's Google Drive app data folder without broad access to normal Drive files.

## Authorized JavaScript Origins

For local testing:

```text
http://127.0.0.1:5173
http://localhost:5173
```

For GitHub Pages:

```text
https://awmair.github.io
```

## Authorized Redirect URIs

The browser token flow used here does not require a classic server redirect URI, but Google Cloud may still show redirect settings depending on the selected OAuth client type. Use a Web application OAuth client, not an installed app client.

## Test User

For a private one-friend deployment, add the friend's Google email as an OAuth test user while the Google app is in testing mode.

## App Config

Set the browser OAuth client ID in `config.js`:

```js
window.HERDBOOK_CONFIG = {
  googleClientId: "YOUR_BROWSER_CLIENT_ID.apps.googleusercontent.com",
  driveFileName: "herdbook-farm.json",
  appUrl: "https://awmair.github.io/HerdBook/",
};
```

The client ID is public configuration. Do not add a client secret.

## Sync Behavior

- Edits save locally immediately.
- Save & Sync uploads the current farm file to Google Drive.
- The app should remain open until the Synced status appears.
- If offline, changes remain local and unsynced until the app is opened online again.
- If local and Drive copies both changed, HerdBook should protect against silent overwrite.
