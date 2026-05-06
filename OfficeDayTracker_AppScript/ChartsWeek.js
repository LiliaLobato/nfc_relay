function _buildChartWeekTab(ctx) {
  const { allWeekData, weekNumber, weekGoal, klmData,
          officeCode, vacCode, holCode, ocCode,
          year, startColWW1, todayColIdx } = ctx;

  const DOW_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

  // Every cell up to today in order; take last 20
  const allCells = [];
  for (let ww = 1; ww <= weekNumber; ww++) {
    const endCol = (ww === weekNumber) ? todayColIdx : 4;
    for (let col = 0; col <= endCol; col++) {
      const mon = getMondayOfISOWeek(ww, year);
      const d   = new Date(mon);
      d.setDate(mon.getDate() + col);
      allCells.push({ ww, col, date: d });
    }
  }
  const cells20 = allCells.slice(-20);

  const labels  = cells20.map(c => _chartDayLabel(c.date, year));
  const barData = (allWeekData[weekNumber - 1] || []).map(cell => cell == officeCode ? 1 : 0);

  const line1 = cells20.map(c => klmData[c.ww - 1] ? klmData[c.ww - 1][0] : null);
  const line2 = cells20.map(c => klmData[c.ww - 1] ? klmData[c.ww - 1][1] : null);
  const line3 = cells20.map(c => klmData[c.ww - 1] ? klmData[c.ww - 1][2] : null);

  let cumOff = 0;
  const paceActual = cells20.map(c => {
    if ((allWeekData[c.ww - 1] || [])[c.col] == officeCode) cumOff++;
    return cumOff;
  });
  const paceGoal = cells20.map((_, i) => Math.round((i + 1) * weekGoal / 5 * 10) / 10);

  let off=0, hm=0, vac=0, hol=0, oc=0;
  cells20.forEach(c => {
    const cell = (allWeekData[c.ww - 1] || [])[c.col];
    if      (cell == officeCode) off++;
    else if (cell == vacCode)    vac++;
    else if (cell == holCode)    hol++;
    else if (cell == ocCode)     oc++;
    else                          hm++;
  });

  // Best/worst weekday by office count across all available data
  const dowCounts = [0, 0, 0, 0, 0];
  for (let ww = 1; ww <= weekNumber; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? todayColIdx : 4;
    for (let col = startCol; col <= endCol; col++) {
      if (row[col] == officeCode) dowCounts[col]++;
    }
  }
  const bestIdx  = dowCounts.indexOf(Math.max(...dowCounts));
  const worstIdx = dowCounts.indexOf(Math.min(...dowCounts));

  return {
    labels, barData, line1, line2, line3, paceActual, paceGoal,
    ytd: [off, hm, vac, hol, oc],
    bestWorst: {
      best:  { label: DOW_NAMES[bestIdx],  value: dowCounts[bestIdx]  },
      worst: { label: DOW_NAMES[worstIdx], value: dowCounts[worstIdx] },
    },
  };
}
