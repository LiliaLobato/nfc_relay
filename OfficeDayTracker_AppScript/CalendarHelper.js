const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function BuildCalendarData(allWeekData, year, monthIdx, calFirst, calLast) {
  const monthName   = MONTH_NAMES[monthIdx];
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const todayJsDay  = rawDate.getDay();
  const today       = (todayJsDay >= 1 && todayJsDay <= 5) ? rawDate.getDate() : null;
  const todayDate   = new Date(year, monthIdx, rawDate.getDate());

  // Maps a cell value + date to a calendar type string.
  // allWeekData[0] = WW1 data, so index = isoWeek - 1.
  function typeFor(value, date) {
    if (date > todayDate) return 'future';
    if (!value && value !== 0) return 'home';
    const label = cheatSheet[value];
    if (label === 'Office')    return 'office';
    if (label === 'Vacation')  return 'vacation';
    if (label === 'Holiday')   return 'holiday';
    if (label === 'OnCallOff') return 'oncalloff';
    return 'home';
  }

  function cellFor(date) {
    const jsDay = date.getDay();
    if (jsDay === 0 || jsDay === 6) return null;
    const wkIdx  = GetISOWeekForDate(date) - 1;
    const colIdx = jsDay - 1;  // Mon(1)→0 .. Fri(5)→4, matching D-H columns
    return allWeekData[wkIdx] !== undefined ? allWeekData[wkIdx][colIdx] : null;
  }

  // Current month day types
  const types = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const date  = new Date(year, monthIdx, d);
    const jsDay = date.getDay();
    types[d] = (jsDay === 0 || jsDay === 6) ? 'weekend-day' : typeFor(cellFor(date), date);
  }

  // Leading days from previous month (same ISO week as month's first day)
  const firstDayMon = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Mon=0..Sun=6
  const prevMonth   = (monthIdx + 11) % 12;
  const prevYear    = monthIdx > 0 ? year : year - 1;
  const daysInPrev  = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prevDays    = [];
  for (let d = daysInPrev - firstDayMon + 1; d <= daysInPrev; d++) {
    const date  = new Date(prevYear, prevMonth, d);
    const jsDay = date.getDay();
    let type;
    if (jsDay === 0 || jsDay === 6) {
      type = 'weekend-day';
    } else {
      const value = cellFor(date);
      type = value !== null ? typeFor(value, date) : 'home';
    }
    prevDays.push({ day: d, type });
  }

  // Trailing days from next month to complete last calendar row
  const lastDayMon = (new Date(year, monthIdx, daysInMonth).getDay() + 6) % 7;
  const trailCount = lastDayMon < 6 ? 6 - lastDayMon : 0;
  const nextMonth  = (monthIdx + 1) % 12;
  const nextYear   = monthIdx < 11 ? year : year + 1;
  const nextDays   = [];
  for (let d = 1; d <= trailCount; d++) {
    const date  = new Date(nextYear, nextMonth, d);
    const jsDay = date.getDay();
    nextDays.push({ day: d, type: (jsDay === 0 || jsDay === 6) ? 'weekend-day' : 'future' });
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
