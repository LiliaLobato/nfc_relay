/**
 * CalendarHelper.js
 * Builds the calendar month data object for the HTML template.
 *
 * The page-load month reads from allWeekData already fetched by BuildStatsData.
 * Other months (calendar < > navigation) are loaded on demand by GetCalendarMonth,
 * which reads only the year sheet(s) the requested month touches.
 */

/**
 * Builds a value lookup over current-year week data.
 * Dates belonging to another ISO year resolve to null (no data).
 * allWeekData[0] = WW1, so index = isoWeek - 1.
 *
 * @param {Array[][]} allWeekData allWeekData[i] is [Mon..Fri] cell values for WW(i+1)
 * @param {number} year ISO year the week data belongs to
 * @returns {function(Date): *} raw cell value, or null for weekends and missing rows
 */
function CalLookupFromWeekData(allWeekData, year) {
  return CalLookupFromYears({ [year]: allWeekData });
}

/**
 * Builds a value lookup over week data for several ISO years.
 *
 * @param {Object.<number, Array[][]>} weekDataByYear ISO year → [Mon..Fri] rows indexed by WW-1
 * @returns {function(Date): *} raw cell value, or null for weekends and missing rows
 */
function CalLookupFromYears(weekDataByYear) {
  return date => {
    const colIdx = (date.getDay() + 6) % 7;
    if (colIdx > WEEK.Fri) return null;
    const rows = weekDataByYear[GetISOYearForDate(date)];
    const row  = rows ? rows[GetISOWeekForDate(date) - 1] : null;
    return row !== undefined && row !== null ? row[colIdx] : null;
  };
}

/**
 * Returns the calendar type string for a day.
 * Future days show their planned type (vacation, holiday, …) when the cell has one,
 * otherwise 'future'.
 *
 * @param {*} value raw cell value (null when no data)
 * @param {Date} date
 * @param {Date} todayDate today at midnight
 * @returns {string}
 */
function _calDayType(value, date, todayDate) {
  if ((date.getDay() + 6) % 7 > WEEK.Fri) return 'weekend-day';
  const type = CellTypeFromValue(value);
  if (date > todayDate && type === 'home') return 'future';
  return type;
}

/**
 * Builds the calendar data for one month.
 * Annotates each day with a type string and includes days
 * from adjacent months to fill the calendar grid rows.
 *
 * @param {function(Date): *} valueAt raw cell value lookup (see CalLookupFromYears)
 * @param {number} year
 * @param {number} monthIdx zero-based (0=Jan, 11=Dec)
 * @returns {{
 *   month: string, monthLabel: string, year: number,
 *   daysInMonth: number, today: number|null, lastEditableDay: number,
 *   types: Object, prevDays: Array, nextDays: Array
 * }}
 */
function BuildCalendarData(valueAt, year, monthIdx) {
  const monthName   = MONTH_NAMES[monthIdx];
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayDate   = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
  const isThisMonth = year === rawDate.getFullYear() && monthIdx === rawDate.getMonth();
  // null on weekends (and other months) so the calendar does not highlight a weekend date as current
  const today = isThisMonth && (rawDate.getDay() + 6) % 7 <= WEEK.Fri ? rawDate.getDate() : null;
  // Days 1..lastEditableDay can be backfilled; future days cannot.
  const lastEditableDay = new Date(year, monthIdx, 1) > todayDate ? 0
    : isThisMonth ? rawDate.getDate() : daysInMonth;

  const typeAt = date => _calDayType(valueAt(date), date, todayDate);

  // Current month
  const types = {};
  for (let d = 1; d <= daysInMonth; d++) types[d] = typeAt(new Date(year, monthIdx, d));

  // Leading days from the previous month (fills the first calendar row)
  const firstDayMon = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
  const prevDays    = [];
  for (let i = firstDayMon; i > 0; i--) {
    const date = new Date(year, monthIdx, 1 - i);
    prevDays.push({ day: date.getDate(), type: typeAt(date) });
  }

  // Trailing days from the next month (fills the last calendar row)
  const lastDayMon = (new Date(year, monthIdx, daysInMonth).getDay() + 6) % 7;
  const trailCount = WEEK.Sun - lastDayMon;
  const nextDays   = [];
  for (let nextD = 1; nextD <= trailCount; nextD++) {
    const date = new Date(year, monthIdx + 1, nextD);
    nextDays.push({ day: nextD, type: typeAt(date) });
  }

  return {
    month:       monthName,
    monthLabel:  `${monthName} ${year}`,
    year,
    daysInMonth,
    today,
    lastEditableDay,
    types,
    prevDays,
    nextDays,
  };
}

/**
 * Reads the sheets a calendar month touches and builds its calendar data.
 * Current year comes from the mega range (also provides the cheatSheet);
 * other ISO years (previous / next year tabs) are read only when the grid reaches them.
 * A missing year tab just leaves those days without data.
 *
 * @param {number} year
 * @param {number} monthIdx zero-based (0=Jan, 11=Dec)
 * @returns {Object} calendar data (see BuildCalendarData)
 */
function BuildCalendarMonth(year, monthIdx) {
  sheet = GetCurrentSheet();
  const curYear = rawDate.getFullYear();
  const bundle  = { main: sheet.getRange(DATALOCATION.megaRange).getValues() };
  cheatSheet    = ParseCheatSheet(bundle);

  const weekDataByYear = {
    [curYear]: GetDailyDataRange(bundle, 1, bundle.main.length - weekRowIndex(1)),
  };

  // First and last dates shown in the grid (Mon of first row .. Sun of last row)
  const first = new Date(year, monthIdx, 1);
  first.setDate(1 - (first.getDay() + 6) % 7);
  const last = new Date(year, monthIdx + 1, 0);
  last.setDate(last.getDate() + WEEK.Sun - (last.getDay() + 6) % 7);

  [GetISOYearForDate(first), GetISOYearForDate(last)].forEach(isoYear => {
    if (weekDataByYear[isoYear]) return;
    const yearSheet = ss.getSheetByName(String(isoYear));
    if (!yearSheet) return;
    weekDataByYear[isoYear] = yearSheet.getRange(DATALOCATION.priorMegaRange).getValues()
      .map(row => row.slice(MEGARANGE.colDailyStart, MEGARANGE.colDailyEnd));
  });

  return BuildCalendarData(CalLookupFromYears(weekDataByYear), year, monthIdx);
}
