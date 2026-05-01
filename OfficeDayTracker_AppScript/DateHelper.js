function GetCurrentDayOfWeek(){
  const dayOfWeek = rawDate.getDay();
  if (dayOfWeek == 0 || dayOfWeek > 5 || !dayOfWeek) {
    throw new Error(`Its ${Utilities.formatDate(rawDate,Session.getScriptTimeZone(),"EEEE, MMM d")}
    ... What are you doing in the office?`);
  }
  return dayOfWeek;
}

function GetCurrentISOWeek(){
  // Copy date so we don't modify the original
  const target = new Date(rawDate.valueOf());
  target.setHours(0, 0, 0, 0);

  // ISO week: shift date to Thursday of this week
  const mondayOffset = 3;
  const weekdayISOOffset = 6;
  target.setDate(target.getDate() + mondayOffset - ((target.getDay() + weekdayISOOffset) % 7));

  // Week 1 is the week with January 4th in it
  const week1 = new Date(target.getFullYear(), 0, 4);

  // Calculate full weeks between the two Thursdays
  const milliSecondsInDay = 86400000;
  const workWeek = (
    1 +
    Math.round(
      ((target - week1) / milliSecondsInDay - mondayOffset + ((week1.getDay() + weekdayISOOffset) % 7)) / 7
    )
  );

  if (workWeek < 1 || workWeek > 52 || !workWeek) {
    throw new Error('Calculated work week '+ workWeek + ' for date' +
    Utilities.formatDate(rawDate,
    Session.getScriptTimeZone(),
    "dd/MMM/yyyy") +
    ' is out of range 1-52');
  }

  return workWeek;
}