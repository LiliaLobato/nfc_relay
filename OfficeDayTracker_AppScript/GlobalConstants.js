/**
 * GlobalConstants.js
 * All shared constants for the project.
 */

// Month name arrays used for labels and calendar rendering
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Row offset: WW1 data starts at sheet row 13, so weekNumber + wwRowOffset = sheet row
const wwRowOffset = 12;

// Sheet column/cell addresses. Update here if the sheet layout changes.
// Note: some column letters are reused for multiple purposes,
// keep each purpose as a separate line for clarity.
const DATALOCATION = {
  weekGoalCell:              "E10",
  cheatSheetLabelCol:        "M",
  cheatSheetCodeCol:         "N",
  cheatSheetRange:           "M7:N10",
  daysNeededCol:             "N",
  weekDataStartCol:          "D",
  weekDataEndCol:            "H",
  weekDataRange:             "D13:H64",
  best10of12Col:             "K",
  best8of12Col:              "L",
  best8of10Col:              "M",
  beltDataRange:             "K13:M64",
  monthlyBreakdownDataRange: "R6:AV20",
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