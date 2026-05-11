/**
 * Test.js
 * Manual test utilities for the Apps Script editor.
 * Not deployed. Run directly to verify rendering before publishing.
 */

/**
 * Loads test fixture data from a TestData{view}.html file and parses it as JSON.
 *
 * @param {string} view view name suffix e.g. 'Office', 'Home', 'Weekend'
 * @returns {Object} parsed DATA contract
 */
function GetTestData(view) {
  return JSON.parse(HtmlService.createHtmlOutputFromFile('TestData' + view).getContent());
}

/**
 * Builds a mock Apps Script event object for a given key.
 * Reads the corresponding token from Script Properties.
 *
 * @param {string} key 'Office' or 'Home'
 * @returns {{ parameter: { key: string, token: string } }}
 */
function GetTryToken(key) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN_' + key.toUpperCase());
  return { parameter: { key, token } };
}

/**
 * Test 1 — Full data build (Office tap).
 * Writes today's cell; run on a weekday. Verify the full DATA object shape in the log.
 */
function TestBuildOffice() {
  console.log(JSON.stringify(BuildPageData('Office')));
}

/**
 * Test 2 — Full data build (Home tap).
 * No write to sheet. Confirm calendar.types[today] and heatmap current week show 'home'.
 */
function TestBuildHome() {
  console.log(JSON.stringify(BuildPageData('Home')));
}

/**
 * Test 3 — Template render with static Office test data.
 * Logs HTML length and reports any unresolved [missing: data.X] placeholders.
 */
function TestTemplateRender() {
  const template  = HtmlService.createTemplateFromFile('Index');
  template.data   = GetTestData('Office');
  template.theme  = 'Default';
  template.isDark = false;
  _tplData   = template.data;
  _tplTheme  = template.theme;
  _tplIsDark = template.isDark;
  const html = template.evaluate().getContent();
  console.log('Length:', html.length);
  const missing = (html.match(/\[missing:[^\]]+\]/g) || []);
  if (missing.length > 0) {
    console.log('MISSING PLACEHOLDERS:', missing.join(', '));
  } else {
    console.log('OK — no missing placeholders');
  }
}

/**
 * Test 4 — Fatal state.
 * Requires temporarily renaming the current year's sheet tab (e.g. '2026' → '20264').
 * Rename it back immediately after the test.
 */
function TestFatal() {
  console.log(JSON.stringify(BuildPageData('Office')));
}

/**
 * Test 5 — Weekend state.
 * Patch rawDate in Main.js to a Saturday using the local-time constructor:
 *   const rawDate = new Date(2026, 4, 9);  // May 9 2026 — month is 0-indexed
 * ISO date strings parse as UTC and land on the wrong day in local timezone.
 * Restore rawDate = new Date() and push again before any real use.
 */
function TestWeekend() {
  console.log(JSON.stringify(BuildPageData('Home')));
}


/**
 * Test 6 — Full cache lifecycle.
 * Full cache lifecycle: empty → write → validate → read → refresh → validate.
 */
function TestCache() {
  PropertiesService.getScriptProperties().deleteProperty(CACHE_PROPERTY_KEY);

  // Empty — should be null
  console.log('Empty read:', readCache() === null ? '✅ null' : '❌ expected null');

  // Write
  const data = {
    alreadyLogged: true, status: 'office',
    statusLabel: 'Office Day', alreadyLoggedMessage: 'Already logged',
    rings: {}, days: {}, calendar: {}, charts: {},
  };
  writeCache(buildCacheEntry(data));

  // Validate
  const cached = readCache();
  console.log('After write — valid for Office:', isCacheValid(cached, 'Office') ? '✅' : '❌');
  console.log('After write — status:', cached.status === 'office' ? '✅ office' : '❌ ' + cached.status);

  // Refresh (overwrite with new data)
  const refreshed = Object.assign({}, data, { alreadyLoggedMessage: 'Refreshed' });
  writeCache(buildCacheEntry(refreshed));

  // Validate after refresh
  const after = readCache();
  console.log('After refresh — still valid:', isCacheValid(after, 'Office') ? '✅' : '❌');
  console.log('After refresh — message updated:', after.alreadyLoggedMessage === 'Refreshed' ? '✅' : '❌');

  PropertiesService.getScriptProperties().deleteProperty(CACHE_PROPERTY_KEY);
}
