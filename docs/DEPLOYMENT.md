# Deployment

## Target

- Repository: `Awmair/HerdBook`
- Visibility: public
- Host: GitHub Pages
- Domain: default `github.io` URL
- Expected URL: `https://awmair.github.io/HerdBook/`

## GitHub Pages Settings

The static app has been pushed to a `gh-pages` branch. GitHub still requires Pages to be enabled once in repository settings.

Use:

- Source: deploy from a branch
- Branch: `gh-pages`
- Folder: `/root`

After saving, the expected URL is:

```text
https://awmair.github.io/HerdBook/
```

The app is static and does not need a build step.

## Friend Install Flow

1. Send the friend the GitHub Pages HTTPS link.
2. They open the link in iPhone Safari.
3. They tap Share.
4. They choose Add to Home Screen.
5. They open HerdBook from the new icon.
6. They complete the setup wizard.
7. They sign in with their own Google account once Drive sync is configured.

## Local Test

Run a simple local server from the repository root:

```bash
python3 -m http.server 5173
```

Open:

```text
http://127.0.0.1:5173/
```

Localhost is treated as secure by browsers for service worker testing.
