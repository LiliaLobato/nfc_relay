/**
 * WeekHelper.js
 * Days card data and chart data for the week tab — last 20 days.
 */


/**
 * Builds the days card data object.
 *
 * @param {{ thisWeek: number, nextWeek: number }} needed from GetDaysNeeded
 * @param {number} weekNumber
 * @param {Object} ytd from CountYTDStats
 * @param {number} annualTarget total office-day goal for the full year
 * @param {number} weeksRemaining
 * @param {number} monthIdx zero-based current month index
 * @param {boolean} isFridayOrWeekend true when current week is done (Friday or weekend)
 * @param {{ vacation: number, oncalloff: number, holiday: number }} pillAbsence absence counts for the two pill weeks
 * @returns {Object}
 */
function BuildDaysData(needed, weekNumber, ytd, annualTarget, weeksRemaining, monthIdx, isFridayOrWeekend, pillAbsence) {
  const baseWW = isFridayOrWeekend ? weekNumber + 1 : weekNumber;
  return {
    thisWeek:          needed.thisWeek,
    nextWeek:          needed.nextWeek,
    thisWeekNumber:    baseWW,
    thisWeekLabel:     isFridayOrWeekend ? 'Next week'  : 'This week',
    nextWeekNumber:    baseWW < 52 ? baseWW + 1 : 1,
    nextWeekLabel:     isFridayOrWeekend ? 'Week after' : 'Next week',
    daysPerWeekNeeded: Math.round((annualTarget - (ytd.office || 0)) / weeksRemaining * 10) / 10,
    monthsRemaining:   12 - (monthIdx + 1),
    vacationPlanned:   pillAbsence.vacation  || 0,
    oncallPlanned:     pillAbsence.oncalloff || 0,
    holidayPlanned:    pillAbsence.holiday   || 0,
  };
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
  const { allWeekData, weekNumber, weekGoal, beltData,
          year, startColWW1, todayColIdx } = context;

  const DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // Every cell up to today in order; take last 20
  const allCells = [];
  for (let ww = 1; ww <= weekNumber; ww++) {
    const endCol = (ww === weekNumber) ? todayColIdx : WEEK.Fri;
    for (let col = 0; col <= endCol; col++) {
      const mon = GetMondayOfISOWeek(ww, year);
      const d   = new Date(mon);
      d.setDate(mon.getDate() + col);
      allCells.push({ ww, col, date: d });
    }
  }
  const cells20 = allCells.slice(-20);

  const labels  = cells20.map(c => _chartDayLabel(c.date, year));
  const barData = cells20.map(c => CellTypeFromValue((allWeekData[c.ww - 1] || [])[c.col]) === 'office' ? 1 : 0);

  const line1 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][0] : null);
  const line2 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][1] : null);
  const line3 = cells20.map(c => beltData[c.ww - 1] ? beltData[c.ww - 1][2] : null);

  let cumOff = 0;
  const paceActual = cells20.map(c => {
    if (CellTypeFromValue((allWeekData[c.ww - 1] || [])[c.col]) === 'office') cumOff++;
    return cumOff;
  });
  const paceGoal = cells20.map((_, i) => Math.round((i + 1) * weekGoal / 5 * 10) / 10);

  const ytd = {};
  cells20.forEach(c => {
    const type = CellTypeFromValue((allWeekData[c.ww - 1] || [])[c.col]);
    ytd[type] = (ytd[type] || 0) + 1;
  });

  // Best/worst weekday — exclude current week unless ≥ 3 days have elapsed (Wed or later)
  const dowEndWW  = todayColIdx < 2 ? weekNumber - 1 : weekNumber;
  const dowCounts = [0, 0, 0, 0, 0];
  for (let ww = 1; ww <= dowEndWW; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? todayColIdx : WEEK.Fri;
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
