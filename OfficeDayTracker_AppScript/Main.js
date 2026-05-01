//////// Global variables ////////
const rawDate = new Date(); // todays date (or set a date for debug)
const wwRowOffset = 12;
var sheet;
var cheatSheet;

function getTokens() {
  const props = PropertiesService.getScriptProperties();
  return {
    Office: props.getProperty('TOKEN_OFFICE'),
    Home:   props.getProperty('TOKEN_HOME'),
  };
}

function Main(key) {
  var data = { key: key };

  try {
    sheet = GetCurrentSheet();
    data.workWeek = GetCurrentISOWeek();
  } catch (e) {
    console.log("Setup error:", e.message);
    return { error: e.message };
  }

  data.formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "EEEE, dd/MMM/yyyy – h:mm:ss a");

  try {
    data.dayOfWeek = GetCurrentDayOfWeek();
  } catch (e) {
    console.log("Weekend:", e.message);
    data.isWeekend = true;
    data.weekendMessage = e.message;
    data.days  = GetOfficeDaysCellNeeded(data.workWeek);
    data.stats = GetBestOfStats(data.workWeek);
    return data;
  }

  if (key === "Office") {
    const currentDayCell = CalculateCurrentDayCell(data.dayOfWeek, data.workWeek);
    try {
      ValidateCurrentDayCellValue(currentDayCell);
      SetCurrentDayCellValue(currentDayCell, Object.keys(cheatSheet).find(k => cheatSheet[k] === "Office"));
      console.log("Marked as Office:", currentDayCell);
    } catch (e) {
      console.log("Write blocked:", e.message);
      data.writeError = e.message;
    }
  } else {
    console.log("Home day — no write");
  }

  data.days  = GetOfficeDaysCellNeeded(data.workWeek);
  data.stats = GetBestOfStats(data.workWeek);

  console.log(JSON.stringify(data));
  return data;
}

