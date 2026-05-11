/**
 * GlobalConstants.js
 * All shared constants for the project.
 */

// Month name arrays used for labels and calendar rendering
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Sheet range addresses. Update here if the sheet layout changes.
const DATALOCATION = {
  monthlyBreakdownDataRange: "R6:AV20",
  megaRange:                 "D7:N64",   // covers cheatSheet, weekGoal, daily, belt, daysNeeded
  priorMegaRange:            "D13:M64",  // covers prior year daily + belt
};

// Column and row offsets within the D7:N64 mega range.
// Update here if sheet columns are inserted or rows shift.
// All indices are 0-based (array positions after getValues()).
const MEGARANGE = {
  firstSheetRow:  7,    // mega range starts at sheet row 7
  ww1SheetRow:   13,    // WW1 data is at sheet row 13 → array index 6
  rowOffset:     12,    // weekNumber + rowOffset = sheet row for that week

  colDailyStart:  0,    // D (inclusive)
  colDailyEnd:    5,    // H (exclusive slice end)
  colBeltStart:   7,    // K (inclusive)
  colBeltEnd:    10,    // M (exclusive slice end)
  colDaysNeeded: 10,    // N
  colWeekGoal:    1,    // E
  colCheatLabel:  9,    // M
  colCheatCode:  10,    // N
  rowWeekGoal:    3,    // sheet row 10 → index 3
  cheatSheetRows: 4,    // rows 7–10 = 4 rows
};

// R6:AV20 layout: title (row6), empty (row7), headers (row8), Jan-Dec (rows9-20)
// If the sheet structure changes, Update these values
// and any HTML that reads the affected fields.
const MONTHLY = {
  workDays:   3,
  officeDays: 5,
  vacations:  9,
  holidays:   11,
  oncallOff:  13,
  goal:       15,
  avg:        17,
};

// Milliseconds per day — used for ISO week arithmetic.
const MS_PER_DAY = 86400000;

// Chart lookback windows.
// MonthHelper looks back 26 weeks; YearHelper looks back 52 weeks.
// Prior year data is only needed while the longer window still reaches into the previous year.
const CHART_LOOKBACK = {
  monthWeeks:           26,  // weeks MonthHelper chart looks back
  yearWeeks:            52,  // weeks YearHelper chart looks back
  dayCount:             20,  // daily cells shown in the week tab
  barCount:              5,  // months/weeks shown in the bar chart
  monthlyThresholdDays: 12,  // min working days elapsed before current month enters best/worst
};

// Messages shown in the already-logged banner per day type.
// 'home' and 'office' fall through to the default 'Already logged'.
const ALREADY_LOGGED_MSGS = {
  vacation:  'Enjoy your time off!',
  holiday:   'Enjoy your long weekend!',
  oncalloff: 'Enjoy your time off!',
};

// Rounds a number to one decimal place.
function round1dp(x) { return Math.round(x * 10) / 10; }

// ISO weekday indices (Mon=0 .. Sun=6).
// Note: JS Date.getDay() uses Sun=0, Sat=6 — convert with (getDay() + 6) % 7 when needed.
const WEEK = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}