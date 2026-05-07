/**
 * CalendarHelper.js
 * Builds the calendar month data object for the HTML template.
 * Reads from allWeekData already fetched by BuildStatsData.
 */

/**
 * Gets the raw cell value for a weekday date from allWeekData.
 * Returns null for weekends or missing rows.
 * allWeekData[0] = WW1, so index = isoWeek - 1.
 *
 * @param {Date} date
 * @param {Array[][]} allWeekData
 * @returns {*|null}
 */
function _calCellValue(date, allWeekData) {
  var colIdx = (date.getDay() + 6) % 7;
  if (colIdx > WEEK.Fri) return null;
  var wkIdx = GetISOWeekForDate(date) - 1;
  return allWeekData[wkIdx] !== undefined ? allWeekData[wkIdx][colIdx] : null;
}

/**
 * Returns the calendar type string for a day.
 * Returns 'future' for dates after today, otherwise delegates to CellTypeFromValue.
 *
 * @param {*} value raw cell value
 * @param {Date} date
 * @param {Date} todayDate
 * @returns {string}
 */
function _calDayType(value, date, todayDate) {
  if (date > todayDate) return 'future';
  return CellTypeFromValue(value);
}

/**
 * Builds the calendar data for the current month.
 * Annotates each day with a type string and includes days
 * from adjacent months to fill the calendar grid rows.
 *
 * @param {Array[][]} allWeekData allWeekData[i] is [Mon..Fri] cell values for WW(i+1)
 * @param {number} year
 * @param {number} monthIdx zero-based (0=Jan, 11=Dec)
 * @param {number} calFirst ISO week of the first day of the month
 * @param {number} calLast ISO week of the last day of the month
 * @returns {{
 *   month: string, monthLabel: string, year: number,
 *   daysInMonth: number, today: number|null,
 *   types: Object, prevDays: Array, nextDays: Array
 * }}
 */
function BuildCalendarData(allWeekData, year, monthIdx, calFirst, calLast) {
  var monthName   = MONTH_NAMES[monthIdx];
  var daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  var todayDate   = new Date(year, monthIdx, rawDate.getDate());
  // null on weekends so the calendar does not highlight a weekend date as current
  var today = (rawDate.getDay() + 6) % 7 <= WEEK.Fri ? rawDate.getDate() : null;

  // Current month
  var types = {};
  for (var d = 1; d <= daysInMonth; d++) {
    var date   = new Date(year, monthIdx, d);
    var isoDay = (date.getDay() + 6) % 7;
    types[d] = isoDay > WEEK.Fri
      ? 'weekend-day'
      : _calDayType(_calCellValue(date, allWeekData), date, todayDate);
  }

  // Leading days from the previous month (fills the first calendar row)
  var firstDayMon = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
  var prevMonth   = (monthIdx + 11) % 12;
  var prevYear    = monthIdx > 0 ? year : year - 1;
  var daysInPrev  = new Date(prevYear, prevMonth + 1, 0).getDate();
  var prevDays    = [];
  for (var d = daysInPrev - firstDayMon + 1; d <= daysInPrev; d++) {
    var date   = new Date(prevYear, prevMonth, d);
    var isoDay = (date.getDay() + 6) % 7;
    if (isoDay > WEEK.Fri) {
      prevDays.push({ day: d, type: 'weekend-day' });
    } else {
      var value = _calCellValue(date, allWeekData);
      prevDays.push({ day: d, type: value !== null ? _calDayType(value, date, todayDate) : 'home' });
    }
  }

  // Trailing days from the next month (fills the last calendar row)
  var lastDayMon = (new Date(year, monthIdx, daysInMonth).getDay() + 6) % 7;
  var trailCount = lastDayMon < WEEK.Sun ? WEEK.Sun - lastDayMon : 0;
  var nextMonth  = (monthIdx + 1) % 12;
  var nextYear   = monthIdx < 11 ? year : year + 1;
  var nextDays   = [];
  for (var d = 1; d <= trailCount; d++) {
    var date   = new Date(nextYear, nextMonth, d);
    var isoDay = (date.getDay() + 6) % 7;
    nextDays.push({ day: d, type: isoDay > WEEK.Fri ? 'weekend-day' : 'future' });
  }

  return {
    month:       monthName,
    monthLabel:  `${monthName} ${year}`,
    year,
    daysInMonth,
    today,
    types,
    prevDays,
    nextDays,
  };
}
