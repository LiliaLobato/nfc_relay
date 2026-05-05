function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function pickTheme() {
  const themes = ['Default', 'SoftPurple', 'Matcha', 'Gummy'];
  return themes[Math.floor(Math.random() * themes.length)];
}

function isNightTime() {
  const hour = new Date().getHours();
  return hour >= 21 || hour < 7;
}

function doGet(e) {
  const key    = e.parameter.key;
  const token  = e.parameter.token;
  const tokens = getTokens();

  const theme  = e.parameter.theme  || pickTheme();
  const isDark = e.parameter.dark !== undefined ? e.parameter.dark === '1' : isNightTime();

  const template  = HtmlService.createTemplateFromFile('Index');
  template.theme  = theme;
  template.isDark = isDark;

  if (!tokens[key] || tokens[key] !== token) {
    template.data = { status: 'unauth' };
    return template.evaluate()
      .setTitle('Office Day Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  template.data = buildPageData(key);

  return template.evaluate()
    .setTitle('Office Day Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
