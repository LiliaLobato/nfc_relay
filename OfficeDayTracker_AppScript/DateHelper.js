function getMondayOfISOWeek(ww, yr) {
  const jan4   = new Date(yr, 0, 4);
  const ww1Mon = new Date(jan4);
  ww1Mon.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7);
  const result = new Date(ww1Mon);
  result.setDate(ww1Mon.getDate() + (ww - 1) * 7);
  return result;
}

function GetCurrentDayOfWeek(){
  const dayOfWeek = rawDate.getDay();
  if (dayOfWeek === 0 || dayOfWeek > 5) {
    throw new Error(`It's ${Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, MMM d")} — what are you doing in the office?`);
  }
  return dayOfWeek;
}

function GetISOWeekForDate(date) {
  const target = new Date(date.valueOf());
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
  const week1 = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function GetCurrentISOWeek(){
  const workWeek = GetISOWeekForDate(rawDate);
  if (workWeek < 1 || workWeek > 53 || !workWeek) {
    throw new Error('Calculated work week '+ workWeek + ' for date' +
    Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "dd/MMM/yyyy") +
    ' is out of range 1-52');
  }
  return workWeek;
}