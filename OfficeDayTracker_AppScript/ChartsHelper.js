/**
 * ChartsHelper.js
 * Rings card data, shared chart utilities, and chart data object creator.
 */

/**
 * Formats a date as a chart axis label.
 * Appends a short year when the date is outside the current year.
 *
 * @param {Date} d
 * @param {number} year current reference year
 * @returns {string} formatted date label dd/Mon
 */
function _chartDayLabel(d, year) {
  const mon = MONTH_SHORT[d.getMonth()];
  return d.getFullYear() === year
    ? `${d.getDate()}/${mon}`
    : `${d.getDate()}/${mon}/${String(d.getFullYear()).slice(2)}`;
}

/**
 * Formats an ISO week as a chart axis label.
 * Handles ww <= 0 as prior-year weeks
 *
 * @param {number} ww ISO week
 * @param {number} year current reference year
 * @returns {string} formatted date label WWn or WWn/yy for prior-year weeks
 */
function _chartWwLabel(ww, year) {
  return ww < 1
    ? `WW${ww + 52}/${String(year - 1).slice(2)}`
    : `WW${ww}`;
}

/**
 * Formats a month as a chart axis label.
 * Appends a short year when the month is outside the current year.
 *
 * @param {number} mIdx zero-based month index (0=Jan, 11=Dec)
 * @param {number} yr year of this entry
 * @param {number} year current reference year
 * @returns {string} formatted date label Mon or Mon/yy for prior-year months
 */
function _chartMonthLabel(mIdx, yr, year) {
  return yr === year ? MONTH_SHORT[mIdx] : `${MONTH_SHORT[mIdx]}/${String(yr).slice(2)}`;
}

/**
 * Gets the [Mon..Fri] cell values for an ISO week.
 * Transparently crosses into the prior year for ww <= 0.
 *
 * @param {number} ww ISO week; may be <= 0 for prior-year weeks
 * @param {Array[][]} allWeekData current-year week data
 * @param {Object|null} priorYearData from GetPriorYearData, or null
 * @returns {Array|null}
 */
function _getChartWeekRow(ww, allWeekData, priorYearData) {
  if (ww < 1) return priorYearData ? (priorYearData.weekData[ww + 51] || null) : null;
  return allWeekData[ww - 1] || null;
}

/**
 * Gets the BELT average values for an ISO week.
 * Transparently crosses into the prior year for ww <= 0.
 *
 * @param {number} ww ISO week; may be <= 0 for prior-year weeks
 * @param {Array[][]} beltData current-year BELT data from GetBeltAveragesRange
 * @param {Object|null} priorYearData from GetPriorYearData, or null
 * @returns {Array|null} [best10of12, best8of12, best8of10] or null
 */
function _getChartBeltRow(ww, beltData, priorYearData) {
  if (ww < 1) return priorYearData ? (priorYearData.beltData[ww + 51] || null) : null;
  return beltData[ww - 1] || null;
}

/**
 * Gets the monthly breakdown row for a month descriptor.
 * Transparently crosses into the prior year when m.yr differs from current year.
 *
 * @param {{ mIdx: number, yr: number }} m month descriptor
 * @param {Array[][]} monthly current-year monthly breakdown
 * @param {number} year current year
 * @param {Object|null} priorYearData from GetPriorYearData, or null
 * @returns {Array|null}
 */
function _getChartMonthlyRow(m, monthly, year, priorYearData) {
  if (m.yr === year) return monthly[m.mIdx] || null;
  return priorYearData ? (priorYearData.monthly[m.mIdx] || null) : null;
}

/**
 * Counts office days in a single week row (Mon-Fri only).
 * Returns 0 if the row is null.
 *
 * @param {Array|null} row week row from allWeekData
 * @returns {number}
 */
function _officeCount(row) {
  return row ? row.slice(WEEK.Mon, WEEK.Fri + 1).filter(c => CellTypeFromValue(c) === 'office').length : 0;
}

/**
 * Finds the best and worst items in a list by a numeric score function.
 * Items where valueFn returns null are skipped.
 * Returns null if no items produce a non-null value.
 *
 * @param {Array} items
 * @param {function(*): number|null} valueFn returns a score or null to skip
 * @returns {{ best: { item: *, value: number }, worst: { item: *, value: number } }|null}
 */
function _bestWorstReduce(items, valueFn) {
  let best = null, bestVal = -Infinity, worst = null, worstVal = Infinity;
  items.forEach(item => {
    const val = valueFn(item);
    if (val === null) return;
    if (val > bestVal)  { bestVal  = val; best  = item; }
    if (val < worstVal) { worstVal = val; worst = item; }
  });
  return best !== null ? { best: { item: best, value: bestVal }, worst: { item: worst, value: worstVal } } : null;
}

/**
 * Returns the heatmap type string for a cell.
 * Returns '' for future cells so the HTML renders them as blank.
 *
 * @param {*} cell raw cell value
 * @param {boolean} isFuture true if the cell date is after today
 * @returns {string}
 */
function _chartHeatmapType(cell, isFuture) {
  if (isFuture) return '';
  return CellTypeFromValue(cell);
}

/**
 * Counts occurrences of each day type within an ISO week range.
 * Respects startColWW1 for WW1 and stops at todayColIdx on the current week.
 *
 * @param {number} fromWW first ISO week to include
 * @param {number} toWW last ISO week to include
 * @param {Object} context shared context object from BuildChartsData
 * @returns {Object} map of CSS type string → count (e.g. { office: 5, home: 3, ... })
 */
function _countChartTypesInRange(fromWW, toWW, context) {
  const { allWeekData, weekNumber, todayColIdx, startColWW1, priorYearData } = context;
  const counts = {};
  for (let ww = fromWW; ww <= toWW; ww++) {
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    const endCol   = (ww === weekNumber) ? todayColIdx : WEEK.Fri;
    for (let col = startCol; col <= endCol; col++) {
      const type = CellTypeFromValue(row[col]);
      counts[type] = (counts[type] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Builds the rings card data object.
 *
 * @param {{ best10of12: number, best8of12: number, best8of10: number }} stats belt averages
 * @param {Object} ytd from CountYTDStats
 * @param {number} workDaysElapsedYTD calendar-year work days elapsed (Dec WW1 days excluded)
 * @param {number} workDaysInCurrentMonth total work days in the current calendar month
 * @param {number} goalTarget cumulative office-day goal through today's month
 * @param {number} weekGoal weekly office-day goal from E10
 * @param {number|null} yearToDateAverage average of monthly avg for elapsed months
 * @returns {Object}
 */
function BuildRingsData(stats, ytd, workDaysElapsedYTD, workDaysInCurrentMonth, goalTarget, weekGoal, yearToDateAverage) {
  const effectiveDaysElapsed = workDaysElapsedYTD - (ytd.holiday || 0);
  return {
    best10of12:    stats.best10of12,
    best8of12:     stats.best8of12,
    best8of10:     stats.best8of10,
    rawAverage:    effectiveDaysElapsed > 0
                     ? Math.round((ytd.office || 0) / effectiveDaysElapsed * 5 * 10) / 10
                     : null,
    goalActual:    ytd.office || 0,
    goalTarget,
    weekGoal,
    projectedDays:      workDaysElapsedYTD > 0
                          ? Math.round((ytd.office || 0) / workDaysElapsedYTD * workDaysInCurrentMonth)
                          : 0,
    totalDays:          workDaysInCurrentMonth,
    yearToDateAverage,
  };
}


/**
 * Assembles chart data for all four tabs.
 * Resolves raw cell codes from cheatSheet by label, builds the shared context object,
 * and delegates to each tab builder.
 *
 * @param {Array[][]} allWeekData daily cell values WW1 through end of current month
 * @param {number} weekNumber current ISO week
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4)
 * @param {number} weekGoal weekly office-day goal from E10
 * @param {Array[][]} beltData BELT averages for WW1 through weekNumber
 * @param {Array[][]} monthly monthly breakdown from GetMonthlyBreakdown
 * @param {number} year current year
 * @param {number} monthIdx zero-based current month index
 * @param {number} startColWW1 column index of Jan 1 within WW1 (0=Mon, 4=Fri)
 * @param {Object|null} priorYearData prior year data or null
 * @returns {{ goal: number, week: Object, month: Object, year: Object, heatmap: Object }}
 */
function BuildChartsData(allWeekData, weekNumber, dayOfWeek, weekGoal, beltData, monthly, year, monthIdx, startColWW1, priorYearData) {
  const context = {
    allWeekData, weekNumber, dayOfWeek, weekGoal, beltData, monthly,
    year, monthIdx, startColWW1, priorYearData,
    todayColIdx: dayOfWeek,
  };

  // Derive ordered type list from cheatSheet; home is the implicit catch-all
  const seen = new Set();
  const types = [];
  Object.values(cheatSheet).forEach(label => {
    const type = label.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(type)) { seen.add(type); types.push({ type, label }); }
  });
  if (!seen.has('home')) types.push({ type: 'home', label: 'Home' });

  return {
    goal:    weekGoal,
    types,
    week:    _buildChartWeekTab(context),
    month:   _buildChartMonthTab(context),
    year:    _buildChartYearTab(context),
    heatmap: _buildChartHeatmap(context),
  };
}
