/**
 * DataAssembler.js
 * Creates one full stats object from a pre-fetched SheetBundle.
 * No sheet API calls — all reads are array lookups via SheetHelper parsers.
 */


/**
 * @param {SheetBundle} bundle pre-fetched sheet data
 * @param {number} weekNumber current ISO week
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4); pass WEEK.Fri on weekends
 * @param {number} year current calendar year
 * @param {number} monthIdx zero-based current month index
 * @returns {{ rings: Object, days: Object, calendar: Object, charts: Object }}
 */
function BuildStatsData(bundle, weekNumber, dayOfWeek, year, monthIdx) {
  const beltData          = GetBeltAveragesRange(bundle, 1, weekNumber);
  const beltRow           = beltData[weekNumber - 1];
  const stats             = { best10of12: beltRow[0], best8of12: beltRow[1], best8of10: beltRow[2] };
  const shiftPillsForward = dayOfWeek === WEEK.Fri;
  const baseWW            = shiftPillsForward ? weekNumber + 1 : weekNumber;
  const needed            = GetDaysNeeded(bundle, baseWW);

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const calFirst    = GetISOWeekForDate(new Date(year, monthIdx, 1));
  const calLast     = GetISOWeekForDate(new Date(year, monthIdx, daysInMonth));

  // Extend range to cover both pill weeks (baseWW and baseWW+1)
  const allWeekData = GetDailyDataRange(bundle, 1, Math.max(calLast, baseWW + 1));

  // WW1 may start in Dec of the prior year (e.g. Dec 29-31).
  // startColWW1 is the column index of Jan 1 within WW1 (0=Mon, 4=Fri).
  const jan1Weekday = (new Date(year, 0, 1).getDay() + 6) % 7;
  const startColWW1 = jan1Weekday <= WEEK.Fri ? jan1Weekday : 0;

  const ytd           = CountYTDStats(allWeekData, weekNumber, startColWW1, dayOfWeek);
  const weekGoal      = GetWeekGoal(bundle);
  const monthly       = GetMonthlyBreakdown(bundle);
  const priorYearData = GetPriorYearData(bundle);

  // Subtract Dec days in WW1 to get true calendar-year elapsed days.
  const workDaysElapsedYTD     = (weekNumber - 1) * 5 + dayOfWeek + 1 - startColWW1;
  // Include Vacation, Holiday, OnCallOff in work day count — not just Office+Home.
  const workDaysInCurrentMonth = monthly[monthIdx][MONTHLY.workDays] || 0;
  const monthlyGoal            = monthly[monthIdx][MONTHLY.goal]     || 0;

  let goalTarget = 0, annualTarget = 0, ytdAvgSum = 0, ytdAvgCount = 0;
  for (let m = 0; m < 12; m++) {
    const g = monthly[m][MONTHLY.goal] || 0;
    annualTarget += g;
    if (m <= monthIdx) {
      goalTarget += g;
      const v = monthly[m][MONTHLY.avg];
      if (v) { ytdAvgSum += v; ytdAvgCount++; }
    }
  }
  const yearToDateAverage = ytdAvgCount > 0 ? round1dp(ytdAvgSum / ytdAvgCount) : null;

  const weeksRemaining = Math.max(1, GetISOWeeksInYear(year) - weekNumber);

  // Count absences only for the two weeks shown in the pills
  const _absenceCount = (ww, type) => {
    const row = allWeekData[ww - 1];
    return row ? row.filter(cell => CellTypeFromValue(cell) === type).length : 0;
  };
  const pillAbsence = {
    vacation:  _absenceCount(baseWW, 'vacation')  + _absenceCount(baseWW + 1, 'vacation'),
    oncalloff: _absenceCount(baseWW, 'oncalloff') + _absenceCount(baseWW + 1, 'oncalloff'),
    holiday:   _absenceCount(baseWW, 'holiday')   + _absenceCount(baseWW + 1, 'holiday'),
  };

  const rings    = BuildRingsData(stats, ytd, workDaysElapsedYTD, workDaysInCurrentMonth, goalTarget, weekGoal, yearToDateAverage, monthlyGoal);
  const days     = BuildDaysData(needed, weekNumber, ytd, annualTarget, weeksRemaining, monthIdx, year, shiftPillsForward, pillAbsence);
  const calendar = BuildCalendarData(allWeekData, year, monthIdx, calFirst, calLast);
  const charts   = BuildChartsData(allWeekData, weekNumber, dayOfWeek, weekGoal, beltData, monthly, year, monthIdx, startColWW1, priorYearData);

  return { rings, days, calendar, charts };
}
