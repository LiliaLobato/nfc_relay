/**
 * MonthHelper.js
 * Builds chart data for the month tab — last 26 ISO weeks.
 */

/**
 * Builds chart data for the month tab — last 26 ISO weeks.
 *
 * @param {Object} context shared context from BuildChartsData
 * @returns {{
 *   labels: string[], barLabels: string[], barData: number[],
 *   line1: Array, line2: Array, line3: Array,
 *   paceActual: number[], paceGoal: number[],
 *   ytd: Object,
 *   bestWorst: { best: { label: string, value: number }, worst: { label: string, value: number } }|null
 * }}
 */
function _buildChartMonthTab(context) {
  const { allWeekData, weekNumber, dayOfWeek, weekGoal, beltData,
          year, priorYearData } = context;

  const monthWWs = [];
  for (let i = CHART_LOOKBACK.monthWeeks - 1; i >= 0; i--) monthWWs.push(weekNumber - i);

  const barLabels = [];
  const barData   = [];
  for (let i = CHART_LOOKBACK.barCount - 1; i >= 0; i--) {
    const ww  = weekNumber - i;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    barLabels.push(_chartWwLabel(ww, year));
    barData.push(_officeCount(row));
  }

  const labels    = monthWWs.map(ww => _chartWwLabel(ww, year));
  const beltRows  = monthWWs.map(ww => _getChartBeltRow(ww, beltData, priorYearData));
  const line1     = beltRows.map(r => r ? r[0] : null);
  const line2     = beltRows.map(r => r ? r[1] : null);
  const line3     = beltRows.map(r => r ? r[2] : null);

  let cumOff = 0, validWeeks = 0;
  const paceActual = monthWWs.map(ww => {
    if (ww < 1 && !priorYearData) return null;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    cumOff += _officeCount(row);
    return cumOff;
  });
  const paceGoal = monthWWs.map(ww => {
    if (ww < 1 && !priorYearData) return null;
    validWeeks++;
    return round1dp(validWeeks * weekGoal);
  });

  const ytd = _countChartTypesInRange(weekNumber - (CHART_LOOKBACK.monthWeeks - 1), weekNumber, context);

  // Exclude current week from best/worst unless ≥ 3 days have elapsed (Wed or later)
  const bestWorst = _bestWorstReduce(monthWWs, ww => {
    if (ww === weekNumber && dayOfWeek < WEEK.Wed) return null;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    return row ? _officeCount(row) : null;
  });

  return {
    labels, barLabels, barData, line1, line2, line3, paceActual, paceGoal, ytd,
    bestWorst: bestWorst ? {
      best:  { label: _chartWwLabel(bestWorst.best.item,  year), value: bestWorst.best.value  },
      worst: { label: _chartWwLabel(bestWorst.worst.item, year), value: bestWorst.worst.value },
    } : null,
  };
}

/**
 * Returns the monthly breakdown as a 12-element array (Jan=index 0).
 *
 * @param {SheetBundle} bundle
 * @returns {Array[][]}
 */
function GetMonthlyBreakdown(bundle) {
  return bundle.monthly.slice(3);
}