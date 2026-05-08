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
  const { allWeekData, weekNumber, weekGoal, beltData,
          year, priorYearData, todayColIdx } = context;

  const monthWWs = [];
  for (let i = 25; i >= 0; i--) monthWWs.push(weekNumber - i);

  const barLabels = [];
  const barData   = [];
  for (let i = 4; i >= 0; i--) {
    const ww  = weekNumber - i;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    barLabels.push(_chartWwLabel(ww, year));
    barData.push(_officeCount(row));
  }

  const labels = monthWWs.map(ww => _chartWwLabel(ww, year));
  const line1  = monthWWs.map(ww => { const r = _getChartBeltRow(ww, beltData, priorYearData); return r ? r[0] : null; });
  const line2  = monthWWs.map(ww => { const r = _getChartBeltRow(ww, beltData, priorYearData); return r ? r[1] : null; });
  const line3  = monthWWs.map(ww => { const r = _getChartBeltRow(ww, beltData, priorYearData); return r ? r[2] : null; });

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
    return Math.round(validWeeks * weekGoal * 10) / 10;
  });

  const ytd = _countChartTypesInRange(weekNumber - 25, weekNumber, context);

  // Exclude current week from best/worst unless ≥ 3 days have elapsed (Wed or later)
  const bw = _bestWorstReduce(monthWWs, ww => {
    if (ww === weekNumber && todayColIdx < 2) return null;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    return row ? _officeCount(row) : null;
  });

  return {
    labels, barLabels, barData, line1, line2, line3, paceActual, paceGoal, ytd,
    bestWorst: bw ? {
      best:  { label: _chartWwLabel(bw.best.item,  year), value: bw.best.value  },
      worst: { label: _chartWwLabel(bw.worst.item, year), value: bw.worst.value },
    } : null,
  };
}
