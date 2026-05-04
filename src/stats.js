const SESSION_WINDOW_HOURS = 5;
const WEEKLY_WINDOW_HOURS  = 168;

function computeStats(totalHours, hoursLeft, actualPct, exponent) {
  const elapsed = totalHours - hoursLeft;
  const e = Math.max((exponent !== undefined) ? exponent : 1.0, 0.05);
  let targetPct = Math.pow(elapsed / totalHours, e) * 100;
  targetPct = Math.min(100, Math.max(0, targetPct));

  const diff = actualPct - targetPct;
  const status = Math.abs(diff) < 5 ? 'on' : diff > 0 ? 'over' : 'under';

  return { targetPct, diff, status };
}

function suggestPacing(actualPct) {
  const diff = actualPct - 50;

  if (actualPct > 85) return 0.8;
  if (actualPct > 75) return 0.65;
  if (actualPct > 60) return 0.55;
  if (actualPct > 45) return 0.45;
  return 0.3;
}

function suggestReason(actualPct) {
  if (actualPct > 85) return "You're nearly out — spread the remaining usage slowly to avoid hitting the cap.";
  if (actualPct > 75) return "You've used a lot — ease off now so the rest lasts.";
  if (actualPct > 60) return "Slightly heavy — a gentle slowdown keeps you on track.";
  if (actualPct > 45) return "Usage is balanced — a mild front-load is fine.";
  return "You have plenty left — it's safe to use more early and coast later.";
}
