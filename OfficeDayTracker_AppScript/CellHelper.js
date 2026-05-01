function GetCurrentDayCellValue(currentDayCell){
  return sheet.getRange(currentDayCell).getValue();
}

function SetCurrentDayCellValue(currentDayCell, newValue){
  return sheet.getRange(currentDayCell).setValue(newValue);
}

function ValidateCurrentDayCellValue (currentDayCell){
  const currentDayCellValue = GetCurrentDayCellValue(currentDayCell);

  if (currentDayCellValue){
    throw new Error(`You ${cheatSheet[currentDayCellValue] == 'Office' ? 'already ': ''}set up ${
    Utilities.formatDate(rawDate, Session.getScriptTimeZone(),"EEEE, MMM d") } as ${cheatSheet[currentDayCellValue]} day.`);
  }
}

function CalculateCurrentDayCell(dayOfWeek, workWeek){
  const dayOfWeekColumnOffset = "C".charCodeAt(0);
  const row = workWeek + wwRowOffset;
  const column = String.fromCharCode(dayOfWeek + dayOfWeekColumnOffset);
  
  return column+row;
}

function GetOfficeDaysCellNeeded(workWeek) {
  const row = workWeek + wwRowOffset;
  return {
    thisWeek:     sheet.getRange("N" + row).getValue(),
    nextWeek:     sheet.getRange("N" + (row + 1)).getValue(),
    nextNextWeek: sheet.getRange("N" + (row + 2)).getValue()
  };
}