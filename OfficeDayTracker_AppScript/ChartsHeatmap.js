function _buildChartHeatmap(ctx) {
  const { allWeekData, weekNumber, todayColIdx } = ctx;

  const heatmap = {};
  for (let ww = 1; ww <= weekNumber; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    heatmap[`WW${ww}`] = row.map((cell, colIdx) =>
      _chartHeatmapType(cell, ww === weekNumber && colIdx > todayColIdx)
    );
  }
  return heatmap;
}
