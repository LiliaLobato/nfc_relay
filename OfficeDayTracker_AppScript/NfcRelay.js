
function getTryToken(key) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN_' + key.toUpperCase());
  return { parameter: { key, token } };
}

function doGet(e) {
  const key = e.parameter.key;
  const token = e.parameter.token;

  const tokens = getTokens();
  if (!tokens[key] || tokens[key] !== token) {
    return HtmlService.createHtmlOutput(unauthorizedHtml());
  }

  const data = Main(key);
  console.log(JSON.stringify(data));
  return HtmlService.createHtmlOutput(buildHtml(data));
}

function test() {
  doGet(getTryToken('Office'));
}

//////// HTML builders ////////

function buildHtml(data) {
  if (data.error)     return errorHtml(data.error);
  if (data.isWeekend) return weekendHtml(data);
  return weekdayHtml(data);
}

function baseCard(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Office Day Tracker</title>
</head>
<body style="margin:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px;box-sizing:border-box;">
  <div style="background:white;padding:32px;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:420px;width:100%;text-align:center;">
    ${content}
  </div>
</body>
</html>`;
}

function statsSection(stats, days, dayOfWeek, workWeek, isWeekend) {
  const fmt    = v  => (typeof v === 'number' && !isNaN(v)) ? v.toFixed(1) : '—';
  const dayStr = d  => `<strong>${d} day${d !== 1 ? 's' : ''}</strong>`;
  const dayRow = (label, d) => `<p style="margin:6px 0;font-size:16px;color:#555;">${label}: ${dayStr(d)}</p>`;

  var daysRows = '';
  if (isWeekend) {
    daysRows = dayRow(`Next week (WW${workWeek + 1})`, days.nextWeek)
             + dayRow(`Week after (WW${workWeek + 2})`, days.nextNextWeek);
  } else if (dayOfWeek === 5) {
    daysRows = dayRow(`Next week (WW${workWeek + 1})`, days.nextWeek)
             + (days.nextWeek <= 1 ? dayRow(`Week after (WW${workWeek + 2})`, days.nextNextWeek) : '');
  } else {
    daysRows = dayRow(`This week (WW${workWeek})`, days.thisWeek)
             + (days.thisWeek <= 1 ? dayRow(`Next week (WW${workWeek + 1})`, days.nextWeek) : '');
  }

  return `
    <div style="margin-top:24px;border-top:1px solid #eee;padding-top:20px;">
      <p style="font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px;">Days still needed</p>
      ${daysRows}
    </div>
    <div style="margin-top:20px;border-top:1px solid #eee;padding-top:20px;">
      <p style="font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin:0 0 14px;">Best of averages</p>
      <div style="display:flex;justify-content:space-around;">
        <div>
          <div style="font-size:24px;font-weight:bold;color:#333;">${fmt(stats.best1012)}</div>
          <div style="font-size:11px;color:#aaa;margin-top:4px;">Best 10/12</div>
        </div>
        <div>
          <div style="font-size:24px;font-weight:bold;color:#333;">${fmt(stats.best812)}</div>
          <div style="font-size:11px;color:#aaa;margin-top:4px;">Best 8/12</div>
        </div>
        <div>
          <div style="font-size:24px;font-weight:bold;color:#333;">${fmt(stats.best810)}</div>
          <div style="font-size:11px;color:#aaa;margin-top:4px;">Best 8/10</div>
        </div>
      </div>
    </div>`;
}

function weekdayHtml(data) {
  const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const isOffice  = data.key === 'Office';
  const badgeColor = isOffice ? '#16a34a' : '#0077cc';
  const badgeBg    = isOffice ? '#dcfce7'  : '#dbeafe';
  const label      = isOffice ? 'Office Day' : 'Home Day';

  const writeErr = data.writeError
    ? `<p style="font-size:14px;color:#f59e0b;margin-top:12px;">${data.writeError}</p>`
    : '';

  return baseCard(`
    <p style="font-size:14px;color:#aaa;margin:0 0 2px;">${data.formattedDate}</p>
    <p style="font-size:15px;color:#666;margin:0 0 22px;">WW ${data.workWeek} &nbsp;·&nbsp; ${dayNames[data.dayOfWeek]}</p>
    <div style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:26px;font-weight:bold;padding:14px 36px;border-radius:14px;">
      ${label}
    </div>
    ${writeErr}
    ${statsSection(data.stats, data.days, data.dayOfWeek, data.workWeek, false)}`);
}

function weekendHtml(data) {
  const msg = data.weekendMessage.replace(/\n\s*/g, ' ');

  return baseCard(`
    <p style="font-size:14px;color:#aaa;margin:0 0 2px;">${data.formattedDate}</p>
    <p style="font-size:15px;color:#666;margin:0 0 22px;">WW ${data.workWeek}</p>
    <div style="background:#fef3c7;color:#92400e;font-size:17px;font-weight:bold;padding:16px 24px;border-radius:14px;line-height:1.5;">
      ${msg}
    </div>
    ${statsSection(data.stats, data.days, null, data.workWeek, true)}`);
}

function errorHtml(msg) {
  return baseCard(`<p style="color:#dc2626;font-size:18px;margin:0;">${msg}</p>`);
}

function unauthorizedHtml() {
  return baseCard(`<p style="color:#dc2626;font-size:18px;margin:0;">Unauthorized</p>`);
}