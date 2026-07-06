# HerdBook Product Spec

## Locked Decisions

- App name: HerdBook
- App type: Drive-first iPhone Home Screen web app / PWA
- Primary icon direction: Open Book Goat
- Icon concept file: `assets/herdbook-open-book-goat-icon-concept.png`
- UI direction file: `docs/design/herdbook-mobile-ui-direction.png`
- Primary storage: Google Drive app data file
- Local storage: on-device offline cache, used for speed and protection while offline
- Save model: edits auto-save locally, then user taps Save & Sync to upload to Drive
- Repository visibility: public
- Hosting target: GitHub Pages
- Domain target: default `github.io` URL, no custom domain for initial friend deployment
- Security rule: never commit Google credentials, OAuth client secrets, private keys, tokens, or real farm test data

## Product Goal

HerdBook is a simple, robust goat farm management app for one primary iPhone. It should feel like a real app, work from the iPhone Home Screen, keep useful farm records organized, and store the main farm file in the user's own Google Drive.

## First-Run Wizard

The app should include a first-run setup wizard:

1. Welcome to HerdBook.
2. Explain that farm data will be stored in the user's Google Drive.
3. Ask the user to sign in with Google.
4. Request only the narrow Drive permission needed for HerdBook app data.
5. Look for an existing HerdBook farm file in Drive.
6. If one exists, load it.
7. If none exists, create a new farm file.
8. Ask for basic farm setup:
   - Farm name
   - Preferred weight unit
   - Preferred currency
   - Default health reminder intervals
9. Show the dashboard.

Each user signs in to their own Google account. Their HerdBook data should live in their own Google Drive, not in a shared central database.

## Sharing And Hosting

The preferred sharing flow is:

1. Build HerdBook as a static PWA.
2. Publish it to GitHub Pages.
3. Send the GitHub Pages HTTPS link to the farm owner.
4. The farm owner opens the link on iPhone Safari.
5. The farm owner adds it to the Home Screen.
6. The farm owner signs in with their own Google account in the setup wizard.

Target URL shape:

`https://<github-user>.github.io/<repo-name>/`

Initial deployment target: one friend only, using a public repository and the default GitHub Pages HTTPS URL. No custom domain is needed.

Important caveat: the app code may be public, but no private farm data or credentials should live in the repository. The app data is private in the user's Google Drive.

## Security Rules

- Do not commit Google OAuth client secrets.
- Do not commit service account JSON files.
- Do not commit refresh tokens, access tokens, API keys, private keys, `.env` files, or generated credential files.
- Do not commit real farm data used during testing.
- A browser OAuth client ID may be present in frontend config because it is not a secret, but it must be documented as public configuration.
- Use sample/demo data only.
- Keep `.gitignore` configured for credential and environment files before adding Google integration.

## Google Drive Storage Model

Use Google Drive's app-specific data area where practical, using the narrow `drive.appdata` scope. This avoids broad access to the user's Drive files and keeps the HerdBook data file hidden from normal Drive clutter.

Data model:

- One primary JSON farm file in Drive.
- Local IndexedDB mirror on the phone.
- Revision metadata stored with the local copy.
- Sync status shown clearly in the app.

Save behavior:

- Every edit saves immediately to local storage.
- Save & Sync uploads the latest local farm file to Drive.
- If offline, the app keeps unsynced local changes and retries later when the app is open.
- The user should wait for a visible Synced status before closing the app if they need Drive to be current.

## Main Features

### Dashboard

- Total herd count
- Does, bucks, kids, sold/archived count
- Pregnant does
- Upcoming kidding dates
- Overdue health tasks
- Recent notes
- Recent expenses
- Unsynced changes status
- Last synced time

### Goat Records

- Name
- Tag ID
- QR ID
- Sex
- Breed
- Date of birth
- Age
- Status: active, sold, deceased, archived
- Dam
- Sire
- Photo
- Purchase details
- Sale details
- Notes
- Timeline of all related events

### Health Logs

- Vaccination records
- Deworming records
- Illness records
- Treatment records
- Vet notes
- Medication name
- Dosage
- Date given
- Next due date
- Attach photo/document later

### Breeding Records

- Doe
- Buck
- Service date
- Repeat service date
- Pregnancy status
- Expected kidding window
- Actual kidding link
- Notes

### Kidding Records

- Doe
- Birth date
- Number of kids
- Kid records created from kidding event
- Kid sex
- Birth weight
- Survival/status
- Bottle feeding notes
- Complications

### Weight Tracking

- Goat
- Date
- Weight
- Notes
- Trend chart
- Recent gain/loss indicator

### Milk Log

- Goat
- Date
- Morning amount
- Evening amount
- Total amount
- Notes
- Weekly/monthly summary

### Expenses

- Date
- Category: feed, vet, medicine, equipment, labor, purchase, transport, other
- Amount
- Notes
- Linked goat where relevant
- Monthly totals
- Simple profit/loss view

### Sales And Purchases

- Animal purchased
- Animal sold
- Date
- Price
- Buyer/seller
- Notes
- Linked documents later

### Tasks

- Manual tasks
- Health due tasks
- Breeding follow-ups
- Kidding preparation
- Feed/barn work
- Completion history
- Overdue and upcoming views

### Reports And Export

- Full JSON backup
- CSV export for goats
- CSV export for health logs
- CSV export for breeding/kidding
- CSV export for expenses
- Printable goat profile
- Printable herd health summary

## Nice-To-Haves Included In Scope

### Photos And Documents

Attach photos or files to goat records, health events, and sale/purchase records.

Implementation note: start with one photo per goat in v1 if full document handling slows the build. Store attachments in Drive with clear links from the farm JSON file.

### Printable Reports

Generate simple printable pages:

- Goat profile
- Health history
- Breeding/kidding history
- Expense summary

### Profit/Loss Summary

Show totals for:

- Expenses
- Sales
- Purchases
- Net result

This should stay simple and not become full accounting software.

### QR / Tag Lookup

Each goat can have a Tag ID and a QR ID. The app can generate a QR code for each goat. The farmer can print or save the QR code and attach it to a card, stall, binder page, or tag.

When scanned with the iPhone camera, the QR code opens HerdBook directly to that goat's profile.

For v1, QR lookup can use app links like:

`https://<herdbook-url>/goat/<goat-id>`

The app then loads the local/Drive farm data and opens that goat. This does not require a special QR hardware scanner.

Important caveat: physical livestock ear tags with printed QR codes are exposed to dirt, chewing, weather, and wear. QR is best for stall cards, printed records, or protected tags unless durable tag printing is used.

### Multi-Device Conflict Guard

The app is designed for one primary iPhone, but we should still detect if the Drive copy changed elsewhere.

If local changes and Drive changes both exist, show a conflict screen instead of silently overwriting data.

## Constraints

- iPhone web apps cannot be trusted to keep syncing after the user closes or backgrounds the app.
- Save & Sync should complete while the app is open.
- Push notifications are limited compared with native iOS apps.
- Google sign-in requires OAuth setup.
- Public use by many users may require Google OAuth publishing/verification steps.
- If we keep the app for only approved/test users, setup is simpler.
- Drive app data keeps the file clean and private to the app, but it is not casually visible in the user's normal Drive folder.
- We should still provide visible export backups.
- This is not an App Store app.

## Build Phases

### Phase 1: Local App

- App shell
- Dashboard
- Goat list/profile
- Add/edit goats
- Health logs
- Breeding/kidding logs
- Tasks
- Expenses
- Local IndexedDB storage

### Phase 2: Drive Sync

- Google sign-in wizard
- Create/load Drive farm file
- Save & Sync button
- Sync status
- Offline handling
- Conflict guard

### Phase 3: Practical Farm Features

- QR code generation
- QR route lookup
- CSV exports
- JSON backup/restore
- Print-friendly reports
- Goat photo support

### Phase 4: Polish

- Home Screen install metadata
- Final app icon sizes
- Offline app cache
- iPhone layout testing
- Empty states and validation
- Data recovery messaging
