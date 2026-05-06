function _buildChartMonthTab(ctx) {
  const { allWeekData, weekNumber, weekGoal, klmData,
          officeCode, year, priorYearData } = ctx;

  const monthWWs = [];
  for (let i = 25; i >= 0; i--) monthWWs.push(weekNumber - i);

  const barLabels = [];
  const barData   = [];
  for (let i = 4; i >= 0; i--) {
    const ww  = weekNumber - i;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    barLabels.push(_chartWwLabel(ww, year));
    barData.push(row ? row.slice(0, 5).filter(c => c == officeCode).length : 0);
  }

  const labels = monthWWs.map(ww => _chartWwLabel(ww, year));
  const line1  = monthWWs.map(ww => { const r = _getChartKlmRow(ww, klmData, priorYearData); return r ? r[0] : null; });
  const line2  = monthWWs.map(ww => { const r = _getChartKlmRow(ww, klmData, priorYearData); return r ? r[1] : null; });
  const line3  = monthWWs.map(ww => { const r = _getChartKlmRow(ww, klmData, priorYearData); return r ? r[2] : null; });

  let cumOff = 0, validWeeks = 0;
  const paceActual = monthWWs.map(ww => {
    if (ww < 1 && !priorYearData) return null;
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    if (row) row.slice(0, 5).forEach(c => { if (c == officeCode) cumOff++; });
    return cumOff;
  });
  const paceGoal = monthWWs.map(ww => {
    if (ww < 1 && !priorYearData) return null;
    validWeeks++;
    return Math.round(validWeeks * weekGoal * 10) / 10;
  });

  const ytd = _countChartTypesInRange(Math.max(1, weekNumber - 25), weekNumber, ctx);

  let bestWW = null, bestOff = -1, worstWW = null, worstOff = Infinity;
  monthWWs.forEach(ww => {
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    if (!row) return;
    const cnt = row.slice(0, 5).filter(c => c == officeCode).length;
    if (cnt > bestOff)  { bestOff  = cnt; bestWW  = ww; }
    if (cnt < worstOff) { worstOff = cnt; worstWW = ww; }
  });

  return {
    labels, barLabels, barData, line1, line2, line3, paceActual, paceGoal, ytd,
    bestWorst: bestWW !== null ? {
      best:  { label: _chartWwLabel(bestWW,  year), value: bestOff  },
      worst: { label: _chartWwLabel(worstWW, year), value: worstOff },
    } : null,
  };
}
