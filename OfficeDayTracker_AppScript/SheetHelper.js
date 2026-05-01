
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

function GetBestOfStats(workWeek) {
  const row = workWeek + wwRowOffset;
  return {
    best1012: sheet.getRange("K" + row).getValue(),
    best812:  sheet.getRange("L" + row).getValue(),
    best810:  sheet.getRange("M" + row).getValue()
  };
}