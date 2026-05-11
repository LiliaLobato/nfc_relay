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
  const colIdx = (date.getDay() + 6) % 7;
  if (colIdx > WEEK.Fri) return null;
  const wkIdx = GetISOWeekForDate(date) - 1;
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
  const monthName   = MONTH_NAMES[monthIdx];
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayDate   = new Date(year, monthIdx, rawDate.getDate());
  // null on weekends so the calendar does not highlight a weekend date as current
  const today = (rawDate.getDay() + 6) % 7 <= WEEK.Fri ? rawDate.getDate() : null;

  // Current month
  const types = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const date   = new Date(year, monthIdx, d);
    const isoDay = (date.getDay() + 6) % 7;
    types[d] = isoDay > WEEK.Fri
      ? 'weekend-day'
      : _calDayType(_calCellValue(date, allWeekData), date, todayDate);
  }

  // Leading days from the previous month (fills the first calendar row)
  const firstDayMon = (new Date(year, monthIdx, 1).getDay() + 6) % 7;
  const prevMonth   = (monthIdx + 11) % 12;
  const prevYear    = monthIdx > 0 ? year : year - 1;
  const daysInPrev  = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prevDays    = [];
  for (let prevD = daysInPrev - firstDayMon + 1; prevD <= daysInPrev; prevD++) {
    const date   = new Date(prevYear, prevMonth, prevD);
    const isoDay = (date.getDay() + 6) % 7;
    if (isoDay > WEEK.Fri) {
      prevDays.push({ day: prevD, type: 'weekend-day' });
    } else {
      const value = _calCellValue(date, allWeekData);
      prevDays.push({ day: prevD, type: value !== null ? _calDayType(value, date, todayDate) : 'home' });
    }
  }

  // Trailing days from the next month (fills the last calendar row)
  const lastDayMon = (new Date(year, monthIdx, daysInMonth).getDay() + 6) % 7;
  const trailCount = lastDayMon < WEEK.Sun ? WEEK.Sun - lastDayMon : 0;
  const nextMonth  = (monthIdx + 1) % 12;
  const nextYear   = monthIdx < 11 ? year : year + 1;
  const nextDays   = [];
  for (let nextD = 1; nextD <= trailCount; nextD++) {
    const date   = new Date(nextYear, nextMonth, nextD);
    const isoDay = (date.getDay() + 6) % 7;
    nextDays.push({ day: nextD, type: isoDay > WEEK.Fri ? 'weekend-day' : 'future' });
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
