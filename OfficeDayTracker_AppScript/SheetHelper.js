
function GetCurrentSheet(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = rawDate.getFullYear(); //'Copy of ' + rawDate.getFullYear();
    sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found`);
    }

    // General setup
    GetCheatSheet();

    return sheet;
}

function GetCheatSheet(){
  const rawCheatSheet = sheet.getRange("M7:N10").getValues();

  cheatSheet = {};
  rawCheatSheet.forEach(row => {
    const key = row[1];
    const value = row[0];
    cheatSheet[key] = value;
  });
}

function GetWeekRowRange(startWeek, endWeek) {
  const startRow = startWeek + wwRowOffset;
  const endRow   = endWeek   + wwRowOffset;
  return sheet.getRange(`D${startRow}:H${endRow}`).getValues();
}

function CountYTDStats(allWeekData, weekNumber, startColWW1) {
  const totals = { home: 0 };
  for (let ww = 1; ww <= weekNumber; ww++) {
    const row = allWeekData[ww - 1];
    if (!row) continue;
    const startCol = (ww === 1) ? startColWW1 : 0;
    for (let col = startCol; col < row.length; col++) {
      const label = cheatSheet[row[col]];
      if (label) totals[label.toLowerCase()] = (totals[label.toLowerCase()] || 0) + 1;
      else totals.home++;
    }
  }
  return totals;
}

function GetBestOfStats(workWeek) {
  const row = workWeek + wwRowOffset;
  return {
    best1012: sheet.getRange("K" + row).getValue(),
    best812:  sheet.getRange("L" + row).getValue(),
    best810:  sheet.getRange("M" + row).getValue()
  };
}

function GetKLMRange(startWeek, endWeek) {
  const startRow = startWeek + wwRowOffset;
  const endRow   = endWeek   + wwRowOffset;
  return sheet.getRange(`K${startRow}:M${endRow}`).getValues();
  // Each row: [0]=K best10/12  [1]=L best8/12  [2]=M best8/10
}

function GetWeekGoal() {
  return sheet.getRange('E10').getValue();
}

function GetPriorYearData(year) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const priorSheet = ss.getSheetByName(year - 1);
  if (!priorSheet) return null;
  return {
    weekData: priorSheet.getRange('D13:H64').getValues(),  // WW1-52, access [ww+51] for ww<=0
    klmData:  priorSheet.getRange('K13:M64').getValues(),
    monthly:  priorSheet.getRange('R6:AV20').getValues().slice(3),
  };
}

function GetMonthlyBreakdown() {
  // R6:AV20 — title(row6), empty(row7), headers(row8), Jan-Dec(rows9-20)
  // Returns 12-element array (Jan=index 0), each row is the full column array.
  // Column indices per row: [3]=WorkDays [5]=OfficeDays [9]=Vacations
  //   [11]=Holidays [13]=OnCallOff [15]=OfficeDayGoal [17]=MonthAverage
  const values = sheet.getRange('R6:AV20').getValues();
  return values.slice(3);
}