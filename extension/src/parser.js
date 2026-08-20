function parseUsageText(raw) {
  const sessionErrors = [];
  const weeklyErrors  = [];

  // Extract percentages tied to their sections using section headers as anchors
  const sessionMatch = raw.match(/current\s+session[\s\S]*?(\d{1,3})%\s+used/i);
  const weeklyMatch = raw.match(/weekly\s+limits?[\s\S]*?(\d{1,3})%\s+used/i);

  const sessionActualPct = sessionMatch ? parseFloat(sessionMatch[1]) : null;
  const weeklyActualPct  = weeklyMatch ? parseFloat(weeklyMatch[1]) : null;

  if (!sessionActualPct) sessionErrors.push('Session percent not found — expected "4% used" under "Current session" or similar');
  if (!weeklyActualPct) weeklyErrors.push('Weekly percent not found — expected "78% used" under "Weekly limits" or similar');

  const sessionSection = extractSection(raw, /current\s+session/i, /weekly\s+limits?/i);
  const weeklySection  = extractSection(raw, /weekly\s+limits?/i, null);

  const sessionHoursLeft = parseSessionHoursLeft(sessionSection || raw, sessionErrors);
  const weeklyHoursLeft  = parseWeeklyHoursLeft(weeklySection || raw, weeklyErrors);

  const sessionOk = sessionErrors.length === 0 && sessionActualPct !== null && sessionHoursLeft !== null;
  const weeklyOk  = weeklyErrors.length  === 0 && weeklyActualPct  !== null && weeklyHoursLeft  !== null;

  const allErrors = [...sessionErrors.map(e => 'Session: ' + e), ...weeklyErrors.map(e => 'Weekly: ' + e)];

  if (!sessionOk && !weeklyOk) throw allErrors.join('\n');

  return {
    session: sessionOk ? { actualPct: sessionActualPct, hoursLeft: sessionHoursLeft } : null,
    weekly:  weeklyOk  ? { actualPct: weeklyActualPct,  hoursLeft: weeklyHoursLeft  } : null,
    errors:  allErrors,
  };
}

function parseSessionHoursLeft(raw, errors) {
  const m = raw.match(/resets in\s+(.+?)(?:\n|$)/i);
  if (!m) {
    errors.push('Reset time not found — expected "Resets in 1 hr 30 min" or similar');
    return null;
  }

  const timeStr = m[1].trim();

  const hrMin   = timeStr.match(/(\d+)\s*h(?:r(?:s)?|ours?)?\s+(\d+)\s*m(?:in(?:utes?)?)?/i);
  const hrOnly  = timeStr.match(/^(\d+)\s*h(?:r(?:s)?|ours?)?$/i);
  const minOnly = timeStr.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/i);

  if (hrMin)   return parseFloat(hrMin[1])  + parseFloat(hrMin[2]) / 60;
  if (hrOnly)  return parseFloat(hrOnly[1]);
  if (minOnly) return parseFloat(minOnly[1]) / 60;

  errors.push('Reset time "' + timeStr + '" not recognized — try "1 hr 30 min", "45 min", or "2 hr"');
  return null;
}

function parseWeeklyHoursLeft(raw, errors) {
  const dayMatch = raw.match(/resets\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (dayMatch) {
    const dayStr = dayMatch[1].toLowerCase();
    let   hour   = parseInt(dayMatch[2], 10);
    const minute = parseInt(dayMatch[3], 10);
    const ampm   = dayMatch[4].toLowerCase();

    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour  = 0;

    const dayMap = {
      sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
      wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
      sat: 6, saturday: 6,
    };
    const targetDay = dayMap[dayStr];

    const now = new Date();
    const resetDate = new Date(now);
    resetDate.setHours(hour, minute, 0, 0);

    const nowDay = now.getDay();
    let daysAhead = (targetDay - nowDay + 7) % 7;
    if (daysAhead === 0 && resetDate <= now) daysAhead = 7;
    resetDate.setDate(now.getDate() + daysAhead);

    return (resetDate - now) / (1000 * 60 * 60);
  }

  const durationMatch = raw.match(/resets in\s+(.+?)(?:\n|$)/i);
  if (durationMatch) {
    const timeStr = durationMatch[1].trim();
    const hrMin   = timeStr.match(/(\d+)\s*h(?:r(?:s)?|ours?)?\s+(\d+)\s*m(?:in(?:utes?)?)?/i);
    const hrOnly  = timeStr.match(/^(\d+)\s*h(?:r(?:s)?|ours?)?$/i);
    const minOnly = timeStr.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/i);
    const dayHr   = timeStr.match(/(\d+)\s*d(?:ays?)?\s+(\d+)\s*h(?:r(?:s)?|ours?)?/i);
    const dayOnly = timeStr.match(/^(\d+)\s*d(?:ays?)?$/i);

    if (dayHr)   return parseFloat(dayHr[1]) * 24 + parseFloat(dayHr[2]);
    if (dayOnly) return parseFloat(dayOnly[1]) * 24;
    if (hrMin)   return parseFloat(hrMin[1])  + parseFloat(hrMin[2]) / 60;
    if (hrOnly)  return parseFloat(hrOnly[1]);
    if (minOnly) return parseFloat(minOnly[1]) / 60;

    errors.push('Reset time "' + timeStr + '" not recognized — try "6 hr 21 min", "2 days 3 hr", or "Fri 5:59 AM"');
    return null;
  }

  errors.push('Reset time not found — expected "Resets Fri 5:59 AM" or "Resets in 6 hr 21 min"');
  return null;
}

function extractSection(raw, startRe, endRe) {
  const startMatch = raw.match(startRe);
  if (!startMatch) return null;
  const startIdx = startMatch.index + startMatch[0].length;
  if (!endRe) return raw.slice(startIdx);
  const rest = raw.slice(startIdx);
  const endMatch = rest.match(endRe);
  return endMatch ? rest.slice(0, endMatch.index) : rest;
}
