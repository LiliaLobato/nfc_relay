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

1. `doGet` validates the token, [picks a random theme](#theme-system), detects night mode (auto after 4 pm / before 9 am, overridable via `?dark=1`), calls `BuildPageData(key)`
2. `BuildPageData` checks the [PropertiesService cache](#cache) first and skips all sheet reads if cache data available. On a cache miss it opens the current year's [sheet](#google-sheet-layout), reads today's date/week; optionally writes the office day, builds the full DATA object, and writes the cache
3. The HTML template is evaluated: `Index.html` includes all component files and injects `DATA` as JSON
4. The browser receives one fully assembled HTML page with no extra requests

### Cache

A [PropertiesService](https://developers.google.com/apps-script/reference/properties/properties-service?hl=es-419) cache is written on the first tap and reused for the rest of that calendar day, avoiding repeated sheet reads:

| Scenario | Cache behaviour | Flow |
|---|---|---|
| Any key, different day | Cache miss | Full sheet read, cache refreshed |
| Office, not yet logged today | Cache miss | Writes the cell, then caches |
| Office, already logged today | Cache hit | 0 sheet reads |
| Home / Weekend, same day | Cache hit | 0 sheet reads |
| Refresh button | Cache ignored | Always bypasses the cache (`GetFreshData`) and overwrites it with live data |

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

I have included a test data copy under HTML/testData, it needs to be uploaded to google drive. The formulas might show as incorrect when opening it from Excell.

---
<br><br>

## Local Development

### Prerequisites

- Python 3.8+
- Node.js + npm
- [clasp](https://github.com/google/clasp) v3+ (`npm install -g @google/clasp`)
- A Google account with access to an Apps Script project

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
2. Add `'MyTheme'` to the `themes` array in `PickTheme()` in `NfcRelay.js`
3. Add it to `THEMES` in `HTML/Helpers/stitch.py`
4. Run `python stitch.py --theme MyTheme --data Office` to preview it locally

---
## Apps Script File Map

| File | Responsibility |
|------|---------------|
| `NfcRelay.js` | `doGet` entry point, auth, theme selection, template rendering |
| `Main.js` | `BuildPageData` and `GetFreshData`, perform a cache check and page data assembly |
| `CacheHelper.js` | PropertiesService-backed daily cache (read, write, validate, rebuild) |
| `DataAssembler.js` | `BuildStatsData` turns a SheetBundle into rings/days/calendar/charts |
| `SheetHelper.js` | Sheet connection, bulk data load (`LoadSheetBundle`), cheat-sheet parsing |
| `CellHelper.js` | Cell address calculation, day-cell read/write, status resolution |
| `DateHelper.js` | ISO week utilities |
| `CalendarHelper.js` | Calendar month builder |
| `WeekHelper.js` | Week tab chart data and days card |
| `MonthHelper.js` | Month tab chart data |
| `YearHelper.js` | Year tab chart data and YTD stats |
| `ChartsHelper.js` | Shared chart utilities, rings card data, heatmap type counting |
| `HeatmapHelper.js` | Heatmap builder |
| `GlobalConstants.js` | All shared constants and `round1dp()` |
| `Test.js` | Manual test functions (run from the Apps Script editor) |

---
<br>

## Useful Links
- [Original NFC relay concept](https://github.com/mrsannaclarke/nfc-relay)
