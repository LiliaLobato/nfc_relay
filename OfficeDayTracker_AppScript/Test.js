function getTestData(view) {
  return JSON.parse(HtmlService.createHtmlOutputFromFile('TestData' + view).getContent());
}

function getTryToken(key) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN_' + key.toUpperCase());
  return { parameter: { key, token } };
}

function test() {
  const template  = HtmlService.createTemplateFromFile('Index');
  template.data   = getTestData('Office');
  template.theme  = 'Default';
  template.isDark = false;
  const html = template.evaluate().getContent();
  console.log(html.substring(0, 500));
}
