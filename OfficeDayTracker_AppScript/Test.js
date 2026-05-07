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
 * Renders the Index template with static Office test data and logs the first
 * 500 characters of the HTML output. Quick check that the template evaluates without errors.
 */
function Test() {
  const template  = HtmlService.createTemplateFromFile('Index');
  template.data   = GetTestData('Office');
  template.theme  = 'Default';
  template.isDark = false;
  const html = template.evaluate().getContent();
  console.log(html.substring(0, 500));
}
