/**
 * NfcRelay.js
 * Handles auth, theme selection, and template rendering.
 * No sheet access here; all data assembly is in Main.js.
 */

// Template variables stored globally so Include() can pass them to subtemplates.
// Apps Script executions are isolated per request.
var _tplData, _tplTheme, _tplIsDark;

/**
 * Loads an HTML partial by filename, evaluates it as a template, and returns its content.
 * Passes data/theme/isDark globals so scriptlets in component files are resolved.
 * Called from templates via <?!= Include('FileName') ?>.
 *
 * @param {string} filename file name without .html extension
 * @returns {string}
 */
function Include(filename) {
  const tmpl    = HtmlService.createTemplateFromFile(filename);
  tmpl.data     = _tplData;
  tmpl.theme    = _tplTheme;
  tmpl.isDark   = _tplIsDark;
  return tmpl.evaluate().getContent();
}

/**
 * Returns a random theme name.
 *
 * @returns {string}
 */
function PickTheme() {
  const themes = ['Default', 'SoftPurple', 'Matcha', 'Gummy'];
  return themes[Math.floor(Math.random() * themes.length)];
}

/**
 * Returns true if the current hour is outside working hours (4pm to 9am).
 * Used to auto-select dark mode when no preference is passed.
 *
 * @returns {boolean}
 */
function IsNightTime() {
  const hour = new Date().getHours();
  return hour >= 16 || hour < 9;
}

/**
 * Reads Office and Home auth tokens from Script Properties.
 *
 * @returns {{ Office: string|null, Home: string|null }}
 */
function GetTokens() {
  const props = PropertiesService.getScriptProperties();
  return {
    Office: props.getProperty('TOKEN_OFFICE'),
    Home:   props.getProperty('TOKEN_HOME'),
  };
}

/**
 * Evaluates a template and wraps it with standard title and frame options.
 *
 * @param {GoogleAppsScript.HTML.HtmlTemplate} template
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function _renderPage(template) {
  return template.evaluate()
    .setTitle('Office Day Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Apps Script HTTP GET handler.
 * Validates the token, picks theme and dark mode, and returns the rendered page.
 * Renders the unauth card on token mismatch and the fatal card on any uncaught error.
 *
 * @param {GoogleAppsScript.Events.DoGet} e
 * @param {string} e.parameter.key 'Office' or 'Home'
 * @param {string} e.parameter.token auth token
 * @param {string} [e.parameter.theme] overrides random theme selection
 * @param {string} [e.parameter.dark] '1' for dark, '0' for light, omit for auto
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet(e) {
  const key    = e.parameter.key;
  const token  = e.parameter.token;
  const tokens = GetTokens();

  const theme  = e.parameter.theme  || PickTheme();
  const isDark = e.parameter.dark !== undefined ? e.parameter.dark === '1' : IsNightTime();

  _tplTheme  = theme;
  _tplIsDark = isDark;

  const template  = HtmlService.createTemplateFromFile('Index');
  template.theme  = theme;
  template.isDark = isDark;

  if (!tokens[key] || tokens[key] !== token) {
    _tplData = { status: 'unauth' };
    template.data = _tplData;
    console.log('doGet: unauth — key:', key);
    return _renderPage(template);
  }

  try {
    template.data = BuildPageData(key);
  } catch (e) {
    console.log('Unhandled error:', e.message);
    template.data = { status: 'fatal', errorMessage: e.message };
  }
  _tplData = template.data;
  console.log('doGet: status =', _tplData.status, JSON.stringify(_tplData));

  return _renderPage(template);
}
