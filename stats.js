const SESSION_WINDOW_HOURS = 5;
const WEEKLY_WINDOW_HOURS  = 168;

function computeStats(totalHours, hoursLeft, actualPct, exponent) {
  const elapsed = totalHours - hoursLeft;
  const e = (exponent !== undefined) ? exponent : 1.0;
  let targetPct = Math.pow(elapsed / totalHours, e) * 100;
  targetPct = Math.min(100, Math.max(0, targetPct));

  const diff = actualPct - targetPct;
  const status = Math.abs(diff) < 5 ? 'on' : diff > 0 ? 'over' : 'under';

  return { targetPct, diff, status };
}
