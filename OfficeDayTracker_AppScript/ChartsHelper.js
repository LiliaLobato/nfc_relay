const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---- Label formatters ----
function _chartDayLabel(d, year) {
  const mon = MONTH_SHORT[d.getMonth()];
  return d.getFullYear() === year
    ? `${d.getDate()}/${mon}`
    : `${d.getDate()}/${mon}/${String(d.getFullYear()).slice(2)}`;
}

function _chartWwLabel(ww, year) {
  return ww < 1
    ? `WW${ww + 52}/${String(year - 1).slice(2)}`
    : `WW${ww}`;
}

function _chartMonthLabel(mIdx, yr, year) {
  return yr === year ? MONTH_SHORT[mIdx] : `${MONTH_SHORT[mIdx]}/${String(yr).slice(2)}`;
}

// ---- Cross-year data accessors ----
function _getChartWeekRow(ww, allWeekData, priorYearData) {
  if (ww < 1) return priorYearData ? (priorYearData.weekData[ww + 51] || null) : null;
  return allWeekData[ww - 1] || null;
}

function _getChartKlmRow(ww, klmData, priorYearData) {
  if (ww < 1) return priorYearData ? (priorYearData.klmData[ww + 51] || null) : null;
  return klmData[ww - 1] || null;
}

function _getChartMonthlyRow(m, monthly, year, priorYearData) {
  if (m.yr === year) return monthly[m.mIdx] || null;
  return priorYearData ? (priorYearData.monthly[m.mIdx] || null) : null;
}

// ---- Heatmap cell type ----
function _chartHeatmapType(cell, isFuture) {
  if (isFuture) return '';
  if (!cell && cell !== 0) return 'home';
  const label = cheatSheet[cell];
  if (label === 'Office')    return 'office';
  if (label === 'Vacation')  return 'vacation';
  if (label === 'Holiday')   return 'holiday';
  if (label === 'OnCallOff') return 'oncalloff';
  return 'home';
}

// ---- Count [office, home, vac, hol, oc] across a WW range ----
// Respects startColWW1 and only counts through today on the current week.
function _countChartTypesInRange(fromWW, toWW, ctx) {
  const { allWeekData, weekNumber, todayColIdx, startColWW1, priorYearData,
          officeCode, vacCode, holCode, ocCode } = ctx;
  let off=0, hm=0, vac=0, hol=0, oc=0;
  for (let ww = fromWW; ww <= toWW; ww++) {
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? todayColIdx : 4;
    for (let col = startCol; col <= endCol; col++) {
      const cell = row[col];
      if      (cell == officeCode) off++;
      else if (cell == vacCode)    vac++;
      else if (cell == holCode)    hol++;
      else if (cell == ocCode)     oc++;
      else                          hm++;
    }
  }
  return [off, hm, vac, hol, oc];
}

// ---- Orchestrator ----
function BuildChartsData(allWeekData, weekNumber, dayOfWeek, weekGoal, klmData, monthly, year, monthIdx, startColWW1, priorYearData) {
  const officeCode = Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Office');
  const vacCode    = Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Vacation');
  const holCode    = Object.keys(cheatSheet).find(k => cheatSheet[k] === 'Holiday');
  const ocCode     = Object.keys(cheatSheet).find(k => cheatSheet[k] === 'OnCallOff');

  const ctx = {
    allWeekData, weekNumber, dayOfWeek, weekGoal, klmData, monthly,
    year, monthIdx, startColWW1, priorYearData,
    officeCode, vacCode, holCode, ocCode,
    todayColIdx: dayOfWeek - 1,
  };

  return {
    goal:    weekGoal,
    week:    _buildChartWeekTab(ctx),
    month:   _buildChartMonthTab(ctx),
    year:    _buildChartYearTab(ctx),
    heatmap: _buildChartHeatmap(ctx),
  };
}
