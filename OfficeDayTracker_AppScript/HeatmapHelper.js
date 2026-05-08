/**
 * HeatmapHelper.js
 * Builds the year-to-date heatmap data.
 */

/**
 * Builds the heatmap object for all weeks from WW1 to the current week.
 * Each week is keyed as 'WW{n}' with an array of 5 type strings (Mon-Fri).
 * Future days in the current week get ''.
 *
 * @param {Object} context shared context from BuildChartsData
 * @returns {Object.<string, string[]>} heatmap data for the HTML template
 */
function _buildChartHeatmap(context) {
  const { allWeekData, weekNumber, todayColIdx } = context;

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
