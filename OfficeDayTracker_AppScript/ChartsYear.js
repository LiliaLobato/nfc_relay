function _buildChartYearTab(ctx) {
  const { weekNumber, weekGoal, monthly, year, monthIdx, priorYearData, officeCode } = ctx;

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
    return row ? (row[5] || 0) : null;
  });

  const line1 = yearMonths.map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    return row ? (row[17] || null) : null;
  });

  let cumOff = 0, cumGoal = 0;
  const paceActual = yearMonths.map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    if (!row) return null;
    cumOff += row[5] || 0;
    return cumOff;
  });
  const paceGoal = yearMonths.map(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    if (!row) return null;
    cumGoal += row[15] || 0;
    return cumGoal;
  });

  const ytd = _countChartTypesInRange(Math.max(1, weekNumber - 51), weekNumber, ctx);

  let bestM = null, bestOff = -1, worstM = null, worstOff = Infinity;
  yearMonths.forEach(m => {
    const row = _getChartMonthlyRow(m, monthly, year, priorYearData);
    if (!row) return;
    const cnt = row[5] || 0;
    if (cnt > bestOff)  { bestOff  = cnt; bestM  = m; }
    if (cnt < worstOff) { worstOff = cnt; worstM = m; }
  });

  return {
    labels, barLabels, barData,
    line1, line2: null, line3: null,
    paceActual, paceGoal, ytd,
    bestWorst: bestM !== null ? {
      best:  { label: MONTH_NAMES[bestM.mIdx],  value: bestOff  },
      worst: { label: MONTH_NAMES[worstM.mIdx], value: worstOff },
    } : null,
  };
}
