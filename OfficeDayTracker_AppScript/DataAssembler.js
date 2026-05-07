/**
 * DataAssembler.js
 * Creates one full stats object: reads sheet data, computes intermediates,
 * and delegates to BuildRingsData, BuildDaysData, BuildCalendarData, BuildChartsData.
 */


/**
 * @param {number} weekNumber current ISO week
 * @param {number} dayOfWeek ISO day index (WEEK.Mon=0 .. WEEK.Fri=4); pass WEEK.Fri on weekends
 * @param {number} year current calendar year
 * @param {number} monthIdx zero-based current month index
 * @returns {{ rings: Object, days: Object, calendar: Object, charts: Object }}
 */
function BuildStatsData(weekNumber, dayOfWeek, year, monthIdx) {
  const stats  = GetBeltAverages(weekNumber);
  const needed = GetDaysNeeded(weekNumber);

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const calFirst    = GetISOWeekForDate(new Date(year, monthIdx, 1));
  const calLast     = GetISOWeekForDate(new Date(year, monthIdx, daysInMonth));

  const allWeekData = GetDailyDataRange(1, Math.max(calLast, weekNumber));

  // WW1 may start in Dec of the prior year (e.g. Dec 29-31).
  // startColWW1 is the column index of Jan 1 within WW1 (0=Mon, 4=Fri).
  const jan1Weekday = (new Date(year, 0, 1).getDay() + 6) % 7;
  const startColWW1 = jan1Weekday <= WEEK.Fri ? jan1Weekday : 0;

  const ytd           = CountYTDStats(allWeekData, weekNumber, startColWW1, dayOfWeek);
  const weekGoal      = GetWeekGoal();
  const monthly       = GetMonthlyBreakdown();
  const beltData      = GetBeltAveragesRange(1, weekNumber);
  const priorYearData = GetPriorYearData(year);

  // Subtract Dec days in WW1 to get true calendar-year elapsed days.
  const workDaysElapsedYTD     = (weekNumber - 1) * 5 + dayOfWeek + 1 - startColWW1;
  // Include Vacation, Holiday, OnCallOff in work day count — not just Office+Home.
  const workDaysInCurrentMonth = (monthly[monthIdx][MONTHLY.workDays]  || 0)
                                + (monthly[monthIdx][MONTHLY.vacations] || 0)
                                + (monthly[monthIdx][MONTHLY.holidays]  || 0)
                                + (monthly[monthIdx][MONTHLY.oncallOff] || 0);

  let goalTarget = 0, annualTarget = 0;
  for (let m = 0; m < 12; m++) {
    const g = monthly[m][MONTHLY.goal] || 0;
    annualTarget += g;
    if (m <= monthIdx) goalTarget += g;
  }

  const weeksRemaining = Math.max(1, 52 - weekNumber);

  const rings    = BuildRingsData(stats, ytd, workDaysElapsedYTD, workDaysInCurrentMonth, goalTarget, weekGoal);
  const days     = BuildDaysData(needed, weekNumber, ytd, annualTarget, weeksRemaining, monthIdx);
  const calendar = BuildCalendarData(allWeekData, year, monthIdx, calFirst, calLast);
  const charts   = BuildChartsData(allWeekData, weekNumber, dayOfWeek, weekGoal, beltData, monthly, year, monthIdx, startColWW1, priorYearData);

  return { rings, days, calendar, charts };
}
