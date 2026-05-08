/**
 * YearHelper.js
 * YTD stats counting and chart data for the year tab — last 12 calendar months.
 */

/**
 * Counts YTD occurrences of each day type from raw weekly cell data.
 * Skips Dec days in WW1 before Jan 1 using startColWW1.
 * Stops at dayOfWeek on the current week so future days are not counted.
 * Unrecognised cells count as 'home'.
 *
 * @param {Array[][]} allWeekData allWeekData[i] is [Mon..Fri] for WW(i+1)
 * @param {number} weekNumber counting stops here (inclusive)
 * @param {number} startColWW1 column index of Jan 1 within WW1 (0=Mon, 4=Fri)
 * @param {number} dayOfWeek ISO day index of today (WEEK.Mon=0 .. WEEK.Fri=4)
 * @returns {Object} e.g. { home: 40, office: 32, vacation: 3, holiday: 1, oncalloff: 2 }
 */
function CountYTDStats(allWeekData, weekNumber, startColWW1, dayOfWeek) {
  const totals = { home: 0 };
  for (let ww = 1; ww <= weekNumber; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? dayOfWeek : WEEK.Fri;
    for (let col = startCol; col <= endCol; col++) {
      const label = cheatSheet[NormalizeCellKey(row[col])];
      if (label) totals[label.toLowerCase()] = (totals[label.toLowerCase()] || 0) + 1;
      else        totals.home++;
    }
  }
  return totals;
}


/**
 * Builds chart data for the year tab — last 12 calendar months.
 *
 * @param {Object} context shared context from BuildChartsData
 * @returns {{
 *   labels: string[], barLabels: string[], barData: Array,
 *   line1: Array, line2: Array, line3: Array,
 *   paceActual: Array, paceGoal: Array,
 *   ytd: Object,
 *   bestWorst: { best: { label: string, value: number }, worst: { label: string, value: number } }|null
 * }}
 */
function _buildChartYearTab(context) {
  const { weekNumber, weekGoal, monthly, year, monthIdx, priorYearData, beltData, todayColIdx } = context;

  const yearMonths = [];
  for (let i = 11; i >= 0; i--) {
    const mIdx = monthIdx - i;
    yearMonths.push(mIdx < 0
      ? { mIdx: mIdx + 12, yr: year - 1 }
      : { mIdx, yr: year }
    );
  }

  const labels    = yearMonths.map(m => _chartMonthLabel(m.mIdx, m.yr, year));
  const barLabels = yearMonths.slice(-5).map(m => _chartMonthLabel(m.mIdx, m.yr, year));
  const barData   = yearMonths.slice(-5).map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    return row ? (row[MONTHLY.officeDays] || 0) : null;
  });

  // BELT averages per month: snapshot at the last ISO week of each month.
  // Current (incomplete) month uses today's week. Dec uses the 28th as anchor to
  // avoid Dec 29-31 falling into WW1 of the next year.
  // Prior-year weeks are passed as ww - 52 so _getChartBeltRow routes them correctly.
  const beltRows = yearMonths.map(m => {
    let ww;
    if (m.yr === year && m.mIdx === monthIdx) {
      ww = weekNumber;
    } else {
      const anchor = m.mIdx === 11 ? new Date(m.yr, 11, 28) : new Date(m.yr, m.mIdx + 1, 0);
      ww = GetISOWeekForDate(anchor);
      if (m.yr < year) ww -= 52;
    }
    return _getChartBeltRow(ww, beltData, priorYearData);
  });

  const line1 = beltRows.map(r => r ? r[0] : null);
  const line2 = beltRows.map(r => r ? r[1] : null);
  const line3 = beltRows.map(r => r ? r[2] : null);

  let cumOff = 0, cumGoal = 0;
  const paceActual = yearMonths.map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    if (!row) return null;
    cumOff += row[MONTHLY.officeDays] || 0;
    return cumOff;
  });
  const paceGoal = yearMonths.map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    if (!row) return null;
    cumGoal += row[MONTHLY.goal] || 0;
    return cumGoal;
  });

  const ytd = _countChartTypesInRange(weekNumber - 51, weekNumber, context);

  // Count working days elapsed in the current month to apply the 12-day threshold
  const _todayDate = new Date(GetMondayOfISOWeek(weekNumber, year));
  _todayDate.setDate(_todayDate.getDate() + todayColIdx);
  let _workingDaysInMonth = 0;
  for (let d = new Date(year, monthIdx, 1); d <= _todayDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) _workingDaysInMonth++;
  }

  // Exclude current month from best/worst unless ≥ 12 working days have elapsed
  const bw = _bestWorstReduce(yearMonths, m => {
    if (m.yr === year && m.mIdx === monthIdx && _workingDaysInMonth < 12) return null;
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    return row ? (row[MONTHLY.officeDays] || 0) : null;
  });

  return {
    labels, barLabels, barData,
    line1, line2, line3,
    paceActual, paceGoal, ytd,
    bestWorst: bw ? {
      best:  { label: MONTH_NAMES[bw.best.item.mIdx],  value: bw.best.value  },
      worst: { label: MONTH_NAMES[bw.worst.item.mIdx], value: bw.worst.value },
    } : null,
  };
}
