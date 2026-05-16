/**
 * WeekHelper.js
 * Days card data and chart data for the week tab — last 20 days.
 */


/**
 * Returns the weekly office day goal.
 *
 * @param {SheetBundle} bundle
 * @returns {number}
 */
function GetWeekGoal(bundle) {
  return bundle.main[MEGARANGE.rowWeekGoal][MEGARANGE.colWeekGoal];
}


/**
 * Returns raw daily cell values for a range of ISO weeks.
 * Each row is [Mon, Tue, Wed, Thu, Fri] for that week.
 *
 * @param {SheetBundle} bundle
 * @param {number} startWeek first ISO week (1-based)
 * @param {number} endWeek last ISO week (1-based)
 * @returns {Array[][]}
 */
function GetDailyDataRange(bundle, startWeek, endWeek) {
  const start = weekRowIndex(startWeek);
  const end   = weekRowIndex(endWeek) + 1;
  return bundle.main
    .slice(start, end)
    .map(row => row.slice(MEGARANGE.colDailyStart, MEGARANGE.colDailyEnd));
}


/**
 * Builds the days card data object.
 *
 * @param {{ thisWeek: number, nextWeek: number }} needed from GetDaysNeeded
 * @param {number} weekNumber
 * @param {Object} ytd from CountYTDStats
 * @param {number} annualTarget total office-day goal for the full year
 * @param {number} weeksRemaining
 * @param {number} monthIdx zero-based current month index
 * @param {number} year current calendar year
 * @param {boolean} shiftPillsForward true when current week is done (Friday or weekend)
 * @param {{ vacation: number, oncalloff: number, holiday: number }} pillAbsence absence counts for the two pill weeks
 * @returns {Object}
 */
function BuildDaysData(needed, weekNumber, ytd, annualTarget, weeksRemaining, monthIdx, year, shiftPillsForward, pillAbsence) {
  const baseWW       = shiftPillsForward ? weekNumber + 1 : weekNumber;
  const weeksInYear  = GetISOWeeksInYear(year);
  return {
    thisWeek:          needed.thisWeek,
    nextWeek:          needed.nextWeek,
    thisWeekNumber:    baseWW,
    thisWeekLabel:     shiftPillsForward ? 'Next week'  : 'This week',
    nextWeekNumber:    baseWW < weeksInYear ? baseWW + 1 : 1,
    nextWeekLabel:     shiftPillsForward ? 'Week after' : 'Next week',
    daysPerWeekNeeded: round1dp((annualTarget - (ytd.office || 0)) / weeksRemaining),
    monthsRemaining:   12 - (monthIdx + 1),
    vacationPlanned:   pillAbsence.vacation  || 0,
    oncallPlanned:     pillAbsence.oncalloff || 0,
    holidayPlanned:    pillAbsence.holiday   || 0,
  };
}

/**
 * Returns the raw cell value for a given week and column from allWeekData.
 *
 * @param {Array[][]} allWeekData
 * @param {number} ww ISO week number (1-based)
 * @param {number} col column index (WEEK.Mon=0 .. WEEK.Fri=4)
 * @returns {*}
 */
function _cellAt(allWeekData, ww, col) {
  return (allWeekData[ww - 1] || [])[col];
}


/**
 * Builds chart data for the Daily tab.
 *
 * @param {Object} context shared context from BuildChartsData
 * @returns {{
 *   labels: string[], barData: number[],
 *   line1: Array, line2: Array, line3: Array,
 *   paceActual: number[], paceGoal: number[],
 *   ytd: Object,
 *   bestWorst: { best: { label: string, value: number }, worst: { label: string, value: number } }
 * }}
 */
function _buildChartWeekTab(context) {
  const { allWeekData, weekNumber, dayOfWeek, weekGoal, beltData,
          year, startColWW1 } = context;

  const DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // Every cell up to today in order; take last 20
  const allCells = [];
  for (let ww = 1; ww <= weekNumber; ww++) {
    const endCol = (ww === weekNumber) ? dayOfWeek : WEEK.Fri;
    for (let col = 0; col <= endCol; col++) {
      const mon = GetMondayOfISOWeek(ww, year);
      const d   = new Date(mon);
      d.setDate(mon.getDate() + col);
      allCells.push({ ww, col, date: d });
    }
  }
  const cells20 = allCells.slice(-CHART_LOOKBACK.dayCount);

  const types20 = cells20.map(c => CellTypeFromValue(_cellAt(allWeekData, c.ww, c.col)));

  const labels = cells20.map(c => _chartDayLabel(c.date, year));

  // 5 values for Mon–Fri of the current week only; future days of the week stay 0
  const currentWeekRow = allWeekData[weekNumber - 1] || [];
  const barData = [WEEK.Mon, WEEK.Tue, WEEK.Wed, WEEK.Thu, WEEK.Fri].map(col =>
    col <= dayOfWeek && CellTypeFromValue(currentWeekRow[col]) === 'office' ? 1 : 0
  );

  const line1 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][0] : null);
  const line2 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][1] : null);
  const line3 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][2] : null);

  let cumOff = 0;
  const paceActual = types20.map(t => {
    if (t === 'office') cumOff++;
    return cumOff;
  });
  const paceGoal = cells20.map((_, i) => round1dp((i + 1) * weekGoal / 5));

  const ytd = {};
  types20.forEach(t => { ytd[t] = (ytd[t] || 0) + 1; });

  // Best/worst weekday — exclude current week unless ≥ 3 days have elapsed (Wed or later)
  const dowEndWW  = dayOfWeek < WEEK.Wed ? weekNumber - 1 : weekNumber;
  const dowCounts = [0, 0, 0, 0, 0];
  for (let ww = 1; ww <= dowEndWW; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? dayOfWeek : WEEK.Fri;
    for (let col = startCol; col <= endCol; col++) {
      if (CellTypeFromValue(row[col]) === 'office') dowCounts[col]++;
    }
  }
  const bestIdx  = dowCounts.indexOf(Math.max(...dowCounts));
  const worstIdx = dowCounts.indexOf(Math.min(...dowCounts));

  return {
    labels, barData, line1, line2, line3, paceActual, paceGoal,
    ytd,
    bestWorst: {
      best:  { label: DOW_NAMES[bestIdx],  value: dowCounts[bestIdx]  },
      worst: { label: DOW_NAMES[worstIdx], value: dowCounts[worstIdx] },
    },
  };
}
