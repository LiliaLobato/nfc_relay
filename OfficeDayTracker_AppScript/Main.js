//////// Global variables ////////
const rawDate     = new Date();
const wwRowOffset = 12;
var sheet;
var cheatSheet;

function getTokens() {
  const props = PropertiesService.getScriptProperties();
  return {
    Office: props.getProperty('TOKEN_OFFICE'),
    Home:   props.getProperty('TOKEN_HOME'),
  };
}

function buildPageData(key) {
  const data = {};

  // ---- Setup ----
  try {
    sheet = GetCurrentSheet();
    data.weekNumber = GetCurrentISOWeek();
  } catch (e) {
    console.log('Setup error:', e.message);
    return { status: 'fatal', errorMessage: e.message };
  }

  data.date           = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, dd/MMM/yyyy");
  data.time           = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "h:mm a");
  data.recommendation = null;

  // ---- Weekend check ----
  var dayOfWeek;
  try {
    dayOfWeek = GetCurrentDayOfWeek();
  } catch (e) {
    console.log('Weekend:', e.message);
    data.status        = 'weekend';
    data.statusLabel   = e.message;
    data.alreadyLogged = false;
    Object.assign(data, buildStatsData(data.weekNumber, 5));
    console.log(JSON.stringify(data));
    return data;
  }

  // ---- Status resolution ----
  data.alreadyLogged = false;

  if (key === 'Office') {
    const currentDayCell = CalculateCurrentDayCell(dayOfWeek, data.weekNumber);
    try {
      ValidateCurrentDayCellValue(currentDayCell);
      SetCurrentDayCellValue(currentDayCell, Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Office'));
      console.log('Marked as Office:', currentDayCell);
    } catch (e) {
      console.log('Already logged:', e.message);
      data.alreadyLogged = true;
    }
    data.status      = 'office';
    data.statusLabel = 'Office Day';
  } else {
    data.status      = 'home';
    data.statusLabel = 'Home Day';
    console.log('Home day — no write');
  }

  Object.assign(data, buildStatsData(data.weekNumber, dayOfWeek));
  console.log(JSON.stringify(data));
  return data;
}

function buildStatsData(weekNumber, dayOfWeek) {
  // ---- Week stats ----
  const stats  = GetBestOfStats(weekNumber);
  const needed = GetOfficeDaysCellNeeded(weekNumber);

  // ---- Calendar date range for batch read ----
  const year        = rawDate.getFullYear();
  const monthIdx    = rawDate.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const calFirst    = GetISOWeekForDate(new Date(year, monthIdx, 1));
  const calLast     = GetISOWeekForDate(new Date(year, monthIdx, daysInMonth));

  // One D-H batch read: WW1 through end of calendar month.
  // allWeekData[i] = [Mon,Tue,Wed,Thu,Fri] for WW(i+1).
  // Feeds both CountYTDStats and BuildCalendarData — read once, reuse.
  const allWeekData = GetWeekRowRange(1, Math.max(calLast, weekNumber));

  // Calendar-year counting: WW1 may start in Dec of prior year (e.g. Dec 29-31).
  // startColWW1 = column index of Jan 1 within WW1 row (0=Mon..4=Fri).
  // For years where Jan 1 is Sat/Sun, WW1 starts in Jan so startColWW1 = 0.
  const jan1Weekday = (new Date(year, 0, 1).getDay() + 6) % 7;
  const startColWW1 = jan1Weekday <= 4 ? jan1Weekday : 0;

  const ytd = CountYTDStats(allWeekData, weekNumber, startColWW1);

  // ---- Monthly breakdown (R6:AV20) — goal targets, work day counts ----
  const weekGoal      = GetWeekGoal();
  const monthly       = GetMonthlyBreakdown();
  const klmData       = GetKLMRange(1, weekNumber);
  const priorYearData = GetPriorYearData(year);

  // Subtract Dec days in WW1 from elapsed count to get calendar-year work days.
  const workDaysElapsedYTD     = (weekNumber - 1) * 5 + dayOfWeek - startColWW1;
  // Use full calendar work days (Office+Home+Vacation+Holiday+OnCallOff), not just Office+Home.
  const workDaysInCurrentMonth = (monthly[monthIdx][3]  || 0) + (monthly[monthIdx][9]  || 0)
                                + (monthly[monthIdx][11] || 0) + (monthly[monthIdx][13] || 0);

  let goalTarget = 0, annualTarget = 0;
  for (let m = 0; m < 12; m++) {
    const g = monthly[m][15] || 0;
    annualTarget += g;
    if (m <= monthIdx) goalTarget += g;
  }

  const effectiveDaysElapsed = workDaysElapsedYTD - (ytd.holiday || 0);
  const weeksRemaining       = Math.max(1, 52 - weekNumber);

  // ---- Rings ----
  const rings = {
    weekAvg:       stats.best1012,
    monthAvg:      stats.best812,
    yearAvg:       stats.best810,
    rawAverage:    effectiveDaysElapsed > 0
                     ? Math.round((ytd.office || 0) / effectiveDaysElapsed * 5 * 10) / 10
                     : null,
    goalActual:    ytd.office || 0,
    goalTarget,
    weekGoal,
    projectedDays: workDaysElapsedYTD > 0
                     ? Math.round((ytd.office || 0) / workDaysElapsedYTD * workDaysInCurrentMonth)
                     : 0,
    totalDays:     workDaysInCurrentMonth,
  };

  // ---- Days ----
  const days = {
    thisWeek:          needed.thisWeek,
    nextWeek:          needed.nextWeek,
    nextWeekNumber:    weekNumber < 52 ? weekNumber + 1 : 1,
    daysPerWeekNeeded: Math.round((annualTarget - (ytd.office || 0)) / weeksRemaining * 10) / 10,
    monthsRemaining:   12 - (monthIdx + 1),
    vacationPlanned:   ytd.vacation  || 0,
    oncallPlanned:     ytd.oncalloff || 0,
    holidayPlanned:    ytd.holiday   || 0,
  };

  // ---- Calendar ----
  const calendar = BuildCalendarData(allWeekData, year, monthIdx, calFirst, calLast);

  // ---- Charts ----
  const charts = BuildChartsData(allWeekData, weekNumber, dayOfWeek, weekGoal, klmData, monthly, year, monthIdx, startColWW1, priorYearData);

  return { rings, days, calendar, charts };
}
