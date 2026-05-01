# Office Day Tracker Automation

We are being asked to go to the office 3 days per week measured with a BELT average. 
<div style="text-align: center;">
<img src="assets\smallestViolin.jpg" alt="The smallest violin the world" width="300"/>
</div>
The problem is that my routine is not cut and dry, so I cannot set the same 3 days every week and I forget if I already went that week or not... That's why I created this tracker. 
<br><br>
From there I just went crazy automating it with an NFC tag so I don't need to open Google Sheet, and creating a beautiful dashboard with data and graphs.<br><br>

Is it overkill? **Yes.** <br>Was it fun? **duh** <br>Is it reusable? **Yup**, use it for the gym, school attendance, tracking your habits, etc.

---
<br>

## Architecture

```
   NFC Tag
      │
      ▼
index.html  (GitHub Pages)
  Reads URL query params (?key=Office&token=...)
  Immediately redirects to Apps Script URL
      │
      ▼
Apps Script Web App  (doGet)
  Validates key + token against PropertiesService secrets
  Reads sheet data, builds DATA object, renders HTML template
      │
      ▼
Google Sheet (tab named after current year, e.g. "2026")
  Writes day value into correct WW row x weekday column
  Source of all stats returned to the dashboard
```

`index.html` is a pure redirect with no logic. It just forwards all query params to the hardcoded Apps Script URL. Apps Script does all the work and returns a fully assembled HTML page to the browser.

---
<br>

## How It Works

### NFC Tags

| Tag | URL | Effect |
|-----|-----|--------|
| Office | `https://lilialobato.github.io/nfc_relay/?key=Office&token=<token>` | Writes 1 into today's cell, returns dashboard |
| Home | `https://lilialobato.github.io/nfc_relay/?key=Home&token=<token>` | No write, returns dashboard with days-needed info |

Tokens are stored in Apps Script **PropertiesService**, not in code or URLs. See [Security Setup](#security-setup) below.

### Apps Script Logic

1. `doGet` validates the token, [picks a random theme](#theme-system), detects night mode, calls `Main(key)`
2. `Main` opens the current year's sheet, reads today's date/week, optionally writes the office day, then calls `buildPageData()` to assemble the full DATA object
3. The HTML template is evaluated: `Index.html` includes all component files and injects `DATA` as JSON
4. The browser receives one fully assembled HTML page with no extra requests

### Theme System

Four color themes (**Default**, **Matcha**, **Gummy**, **SoftPurple**) are selected randomly on each tap.

<div style="text-align: center;">
<img src="assets\themes.jpg" alt="Four themes and dark mode variants" width="1200"/>
</div>

 <br>
Dark mode activates automatically but can be forced via URL:

```
?theme=Matcha        force Matcha theme
?dark=1              force dark mode
```

### Google Sheet Layout
<div style="text-align: center;">
<img src="assets\googleSheet.png" alt="Four themes and dark mode variants" width="800"/>
</div>

| Range | Purpose |
|-------|---------|
| M7:N10 | Cheat sheet: label to cell value (Office=1, Vacation=X, Holiday=H, OnCallOff=OC) |
| D to H, rows 13+ | Weekday cells Mon to Fri, one row per work week |
| K, rows 13+ | Average Best 10/12 |
| L, rows 13+ | Average Best 8/12 |
| M, rows 13+ | Average Best 8/10 |
| N, rows 13+ | Days still needed this week |
| E10 | Week goal (currently 3) |

Cell address formula: Row = ISO week number + 12. Columns: Mon=D, Tue=E, Wed=F, Thu=G, Fri=H.

---
<br><br>

## Local Development

### Prerequisites

- Python 3.8+
- Node.js + npm
- [clasp](https://github.com/google/clasp) v3+ (`npm install -g @google/clasp`)
- A Google account with access to the Apps Script project

### Setup

```bash
git clone https://github.com/LiliaLobato/nfc_relay.git
cd nfc_relay

clasp login

clasp clone <scriptId> --rootDir OfficeDayTracker_AppScript   # scriptId in Useful Links
```

### Dev Workflow

```
STAGE 1  Edit components
    Edit files in OfficeDayTracker_AppScript/ and HTML/TestData/

STAGE 2  Preview locally (no internet needed)
    cd HTML/Helpers
    python stitch.py --theme Default --data Office
    open HTML/HTML_StitchOutput/_preview_default_office.html in browser

STAGE 3  Validate
    python validate.py
    all checks must pass before pushing

STAGE 4  Push to Apps Script
    clasp push --rootDir OfficeDayTracker_AppScript

STAGE 5  Verify with real data
    Open the Apps Script test deployment URL in browser
```

### stitch.py

Assembles `Index.html` by resolving `include()` tags, theme, and data. Produces a single HTML file identical in structure to what Apps Script serves.

```bash
python stitch.py --theme Default                    # color variant, no data
python stitch.py --theme Default --data Office      # full Office preview
python stitch.py --theme Matcha  --data Fatal       # Fatal error preview
python stitch.py --all                              # all 4 color variants
python stitch.py --all --data Home                  # all 4 variants with Home data
python stitch.py --dry-run --theme Default --data Office
```

| Flag | Description |
|------|-------------|
| `--theme NAME` | Resolve theme CSS (Default, SoftPurple, Matcha, Gummy) |
| `--data VIEW` | Inject mock data (Office, Home, Weekend, Logged, Fatal, Unauth) |
| `--all` | Generate all 4 theme variants in one pass |
| `--dry-run` | Print line counts without writing files |

Output files land in `HTML/HTML_StitchOutput/` named `_preview_{theme}_{view}.html`

### validate.py

Two-layer validation. Run after every significant change before pushing.

```bash
python validate.py                          # all views, both layers
python validate.py --view Office            # one view only
python validate.py --layer 1                # health check only (no unresolved tags)
python validate.py --verbose                # show detail on failures
```

Exit codes: `0` = pass, `1` = fail (CI-safe).

---

## Security Setup

Tokens are never hardcoded in source. After deploying the Apps Script project, set them once via the Apps Script editor:

1. Open the project in [script.google.com](https://script.google.com)
2. Go to **Project Settings > Script Properties**
3. Add two properties:

| Key | Value |
|-----|-------|
| `TOKEN_OFFICE` | your office token (any random string) |
| `TOKEN_HOME` | your home token (a different random string) |

4. Update your NFC tag URLs to use those same token values as query params.

`.clasprc.json` (OAuth tokens) is gitignored. `.clasp.json` (scriptId) is committed since the scriptId is not a secret.

---

## Adding a New Theme

1. Create `OfficeDayTracker_AppScript/ThemeMyTheme.html` with ~30 CSS variable definitions (copy an existing theme file and adjust the values)
2. Add `'MyTheme'` to the `themes` array in `pickTheme()` in `NfcRelay.js`
3. Add it to `THEMES` in `HTML/Helpers/stitch.py`
4. Run `python stitch.py --theme MyTheme --data Office` to preview it locally

---

## Useful Links

- [Google Sheet tracker](https://docs.google.com/spreadsheets/d/11fQLZQ4cqqnbgUBWGKMeXCRhwnzLBWuqQoPDIhiqgy4/edit)
- [Apps Script project](https://script.google.com/u/0/home/projects/1Xwb9vyBb1GsjhHlPBB1QZxdOlogHUgJGG_LDg3auhDUbM9UM7WCRLqyV/edit)
- [Original NFC relay concept](https://github.com/mrsannaclarke/nfc-relay)
