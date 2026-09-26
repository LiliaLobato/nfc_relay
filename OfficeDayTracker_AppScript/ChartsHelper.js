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
    ? `WW${ww + GetISOWeeksInYear(year - 1)}/${String(year - 1).slice(2)}`
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
  if (ww < 1) return priorYearData ? (priorYearData.weekData[ww + priorYearData.weeksInYear - 1] || null) : null;
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
  if (ww < 1) return priorYearData ? (priorYearData.beltData[ww + priorYearData.weeksInYear - 1] || null) : null;
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
  items.forEach((item, i) => {
    const val = valueFn(item, i);
    if (val === null) return;
    if (val >= bestVal)  { bestVal  = val; best  = item; }
    if (val <= worstVal) { worstVal = val; worst = item; }
  });
  return best !== null ? { best: { item: best, value: bestVal }, worst: { item: worst, value: worstVal } } : null;
}

/**
 * Counts occurrences of each day type within an ISO week range.
 * Stops at dayOfWeek on the current week; counts all days of every other week
 * including WW1 pre-Jan days (Dec 29-31) and prior-year weeks via priorYearData.
 *
 * @param {number} fromWW first ISO week to include (may be <= 0 for prior-year weeks)
 * @param {number} toWW last ISO week to include
 * @param {Object} context shared context object from BuildChartsData
 * @returns {Object} map of CSS type string → count (e.g. { office: 5, home: 3, ... })
 */
function _countChartTypesInRange(fromWW, toWW, context) {
  const { allWeekData, weekNumber, dayOfWeek, priorYearData } = context;
  const counts = {};
  for (let ww = fromWW; ww <= toWW; ww++) {
    const row = _getChartWeekRow(ww, allWeekData, priorYearData);
    if (!row) continue;
    const endCol = (ww === weekNumber) ? dayOfWeek : WEEK.Fri;
    for (let col = 0; col <= endCol; col++) {
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
 * @param {number} workDaysInCurrentMonth total Mon-Fri days in the current calendar month (from sheet U column)
 * @param {number} goalTarget cumulative office-day goal through today's month
 * @param {number} weekGoal weekly office-day goal from E10
 * @param {number|null} yearToDateAverage average of monthly avg for elapsed months
 * @param {number} monthlyGoal office-day goal for the current month (from sheet AG column)
 * @returns {Object}
 */
function BuildRingsData(stats, ytd, workDaysElapsedYTD, workDaysInCurrentMonth, goalTarget, weekGoal, yearToDateAverage, monthlyGoal) {
  const effectiveDaysElapsed = workDaysElapsedYTD - (ytd.holiday || 0);
  const lowestAverage = Math.min(stats.best10of12, stats.best8of12, stats.best8of10);
  return {
    best10of12:     stats.best10of12,
    best8of12:      stats.best8of12,
    best8of10:      stats.best8of10,
    lowestAverage,
    rawAverage:     effectiveDaysElapsed > 0
                      ? round1dp((ytd.office || 0) / effectiveDaysElapsed * 5)
                      : null,
    goalActual:     ytd.office || 0,
    goalTarget,
    weekGoal,
    projectedDays:  Math.round(lowestAverage * workDaysInCurrentMonth / 5),
    totalDays:      workDaysInCurrentMonth,
    monthlyGoal,
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

/**
 * Returns BELT average values for a range of ISO weeks.
 * Each row is [best10of12, best8of12, best8of10].
 *
 * @param {SheetBundle} bundle
 * @param {number} startWeek first ISO week (1-based)
 * @param {number} endWeek last ISO week (1-based)
 * @returns {Array[][]}
 */
function GetBeltAveragesRange(bundle, startWeek, endWeek) {
  const start = weekRowIndex(startWeek);
  const end   = weekRowIndex(endWeek) + 1;
  return bundle.main
    .slice(start, end)
    .map(row => row.slice(MEGARANGE.colBeltStart, MEGARANGE.colBeltEnd));
}


/**
 * Office days logged for a single ISO week, reaching into the prior year for
 * week numbers <= 0 (so a trailing-12 window is correct near the year boundary).
 *
 * @param {SheetBundle} bundle
 * @param {number} ww ISO week number; <= 0 means (weeksInPriorYear + ww)
 * @returns {number}
 */
function _weekOfficeCount(bundle, ww) {
  const countOffice = daily =>
    daily.filter(cell => CellTypeFromValue(cell) === 'office').length;

  if (ww >= 1) {
    const row = bundle.main[weekRowIndex(ww)];
    return row ? countOffice(row.slice(MEGARANGE.colDailyStart, MEGARANGE.colDailyEnd)) : 0;
  }

  if (!bundle.prior) return 0;
  const priorWW = bundle.prior.weeksInYear + ww;      // ww=0 -> last week of prior year
  const row     = bundle.prior.main[priorWW - 1];      // prior range starts at WW1 = index 0
  return row ? countOffice(row.slice(MEGARANGE.colDailyStart, MEGARANGE.colDailyEnd)) : 0;
}


/**
 * Returns the number of office days still needed this week and next to keep the
 * BELT goal — best 8 of the trailing 12 weeks averaging at least the week goal.
 *
 * For each pill week it finds the fewest extra office days that bring the
 * best-8-of-12 average up to goal (full belt recovery). Two refinements keep the
 * number honest for the live week:
 *   - office days already logged that week count toward the goal, and
 *   - the answer is capped at the weekdays still open — on the live week only
 *     today..Friday remain (Thursday caps at 2), on future weeks all 5 are open.
 * When even every remaining day cannot reach the goal, it returns that cap
 * ("go every day left").
 *
 * @param {SheetBundle} bundle
 * @param {number} baseWW ISO week of the first pill (current week, or next week on Fri/weekend)
 * @param {number} weekNumber the true current ISO week — used to detect the live week
 * @param {number} dayOfWeek ISO day index of today (WEEK.Mon=0 .. WEEK.Fri=4)
 * @returns {{ thisWeek: number, nextWeek: number }}
 */
function GetDaysNeeded(bundle, baseWW, weekNumber, dayOfWeek) {
  const weekGoal = GetWeekGoal(bundle);

  const daysNeededForWeek = (pw) => {
    const row   = bundle.main[weekRowIndex(pw)] || [];
    const daily = row.slice(MEGARANGE.colDailyStart, MEGARANGE.colDailyEnd);
    const officeSoFar = daily.filter(cell => CellTypeFromValue(cell) === 'office').length;

    // Weekdays still open to log: today..Fri for the live week, the whole week otherwise.
    const openStart = (pw === weekNumber) ? dayOfWeek : WEEK.Mon;
    let openSlots = 0;
    for (let col = openStart; col <= WEEK.Fri; col++) {
      if (!daily[col]) openSlots++;
    }

    const prior11 = [];
    for (let w = pw - 11; w <= pw - 1; w++) prior11.push(_weekOfficeCount(bundle, w));

    const best8of12Avg = (thisWeekOffice) => {
      const window = prior11.concat([thisWeekOffice]).sort((a, b) => b - a);
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += (window[k] || 0);
      return sum / 8;
    };

    for (let add = 0; add <= openSlots; add++) {
      if (best8of12Avg(officeSoFar + add) >= weekGoal) return add;
    }
    return openSlots;   // goal unreachable this week — every remaining day
  };

  return {
    thisWeek: daysNeededForWeek(baseWW),
    nextWeek: daysNeededForWeek(baseWW + 1),
  };
}
