# Context

The codebase has grown organically and contains significant duplication — the same DOM creation pattern appears 70+ times, time-formatting logic is duplicated across 4 functions, day-name arrays are declared 4 separate times, and two identical select-building loops exist side by side. The goal is to eliminate this redundancy to reduce file size (token consumption) without changing any behavior or UI appearance.

No build step is added. All changes are vanilla JS/CSS. Each change is independently testable by loading the app and confirming identical output.

---

# Changes

## 1. `renderer.js` — Add `mkEl` helper + module-level `DAYS` (prerequisite for all below)

At the top of the file (after line 3), add:

```js
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function mkEl(tag, cls, txt) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (txt !== undefined) el.textContent = txt;
  return el;
}
```

Then delete the 4 local `DAYS`/`DAYS_R` re-declarations at lines 82, 280, 484, 725.

**~4 lines removed** (net after adding the 6 helper lines, each call-site collapse below saves 2 lines).

---

## 2. `renderer.js` — Apply `mkEl` throughout to collapse `createElement` blocks

Every 3-line `createElement` + `className` + `textContent` block collapses to 1 line. Approximately 70 elements qualify. Examples:

```js
// Before (3 lines)
const title = document.createElement('div');
title.className = 'card-title';
title.textContent = label;

// After (1 line)
const title = mkEl('div', 'card-title', label);
```

Elements that need extra properties (`.id`, `.dataset`, `.innerHTML`, event listeners) still use `mkEl` for the first two properties, then set extras on separate lines.

**~140 lines removed.**

---

## 3. `renderer.js` — Extract `fmtFrac(a, b)` for repeated fraction markup

The pattern below appears 3 times (lines 60, 101, 134):

```js
'<span class="frac-actual">' + x + '%</span><span class="frac-sep">/</span><span class="frac-target">' + y + '%</span>'
```

Add at module level:
```js
function fmtFrac(a, b) {
  return '<span class="frac-actual">' + a + '%</span><span class="frac-sep">/</span><span class="frac-target">' + b + '%</span>';
}
```

Replace all 3 `.innerHTML = '...'` blocks with `.innerHTML = fmtFrac(...)`.

**Net ~2 lines removed** (3-line blocks to 1-line calls; helper adds 3 lines).

---

## 4. `renderer.js` — Use `fmtTime` in `buildCard` reset label (eliminate local duplicate)

Lines 82–89 manually compute a 12-hour reset time with local variables (`DAYS_R`, `rh`, `rm`, `rampm`, `rh12`, `rmm`). The `fmtTime(date)` function at line 375 already does exactly this.

Replace lines 82–89 with:
```js
const resetDate = new Date(resetMs);
const resetLabel = resetDate.toDateString() === new Date().toDateString()
  ? 'today ' + fmtTime(resetDate)
  : DAYS[resetDate.getDay()] + ' ' + fmtTime(resetDate);
```

**~4 lines removed.**

---

## 5. `renderer.js` — Extract `buildSleepSelect(id, defaultHour)` to deduplicate select loops

Lines 400–411 and 419–430 are identical 12-line loops that differ only in `id` and `defaultHour`. Extract:

```js
function buildSleepSelect(id, defaultHour) {
  const sel = document.createElement('select');
  sel.id = id;
  sel.className = 'sleep-select';
  for (let i = 0; i < 24; i++) {
    const opt = mkEl('option', '', (i % 12 || 12) + (i >= 12 ? 'pm' : 'am'));
    opt.value = i;
    if (i === defaultHour) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}
```

Replace the two loops with:
```js
const startSelect = buildSleepSelect('sleep-start', 22);
const endSelect   = buildSleepSelect('sleep-end', 7);
```

**~7 lines removed** (two 12-line loops → helper + 2 calls).

---

## 6. `renderer.js` — Delete unused `statRow` function (lines 221–233)

`statRow(label, value)` is defined but never called anywhere in the codebase. Verify with:
```
grep -rn "statRow(" *.js index.html
```
Then delete all 13 lines.

**13 lines removed.**

---

## 7. `parser.js` — Extract `parseHrMinStr` to eliminate duplicated time-string parsing

Lines 44–50 in `parseSessionHoursLeft` and lines 89–99 in `parseWeeklyHoursLeft` share the same 3 regex matches (`hrMin`, `hrOnly`, `minOnly`) and return logic. Extract:

```js
function parseHrMinStr(timeStr) {
  const hrMin   = timeStr.match(/(\d+)\s*h(?:r(?:s)?|ours?)?\s+(\d+)\s*m(?:in(?:utes?)?)?/i);
  const hrOnly  = timeStr.match(/^(\d+)\s*h(?:r(?:s)?|ours?)?$/i);
  const minOnly = timeStr.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/i);
  if (hrMin)   return +hrMin[1]  + +hrMin[2] / 60;
  if (hrOnly)  return +hrOnly[1];
  if (minOnly) return +minOnly[1] / 60;
  return null;
}
```

`parseSessionHoursLeft` replaces its 7-line block with `return parseHrMinStr(timeStr)`.  
`parseWeeklyHoursLeft` replaces its 5-line block (after the `dayHr`/`dayOnly` checks) with `return parseHrMinStr(timeStr)`.

**Net ~6 lines removed.**

---

## 8. `app.js` — Extract `setExponent(key, v)` to collapse duplicated pacing update blocks

`applySuggestedPacing` has two identical 4-line blocks differing only in `'session'` vs `'weekly'`. Extract:

```js
function setExponent(key, v) {
  if (key === 'session') sessionExponent = v;
  else weeklyExponent = v;
  const slider = document.getElementById(key + '-exponent');
  const label  = document.getElementById(key + '-exponent-label');
  if (slider) slider.value = v.toFixed(2);
  if (label)  label.textContent = exponentToLabel(v);
}
```

`applySuggestedPacing` becomes:
```js
function applySuggestedPacing(parsed) {
  if (parsed.session) setExponent('session', suggestPacing(parsed.session.actualPct));
  if (parsed.weekly)  setExponent('weekly',  suggestPacing(parsed.weekly.actualPct));
}
```

**Net ~4 lines removed.**

---

## 9. `styles.css` — Add CSS custom properties for repeated color values

Top of `:root` block, add:
```css
:root {
  --bg: #1c1c1f;
  --surface: #2a2a2e;
  --muted: #888;
}
```

Replace all instances of `#1c1c1f` (15+), `#2a2a2e` (10+), `#888` (20+) with the variables.

**~45 occurrences replaced** (same line count, but single source of truth and shorter average token length per value).

---

# Critical Files

- [renderer.js](renderer.js) — primary target (~170 lines saved)
- [parser.js](parser.js) — ~6 lines saved
- [app.js](app.js) — ~4 lines saved
- [styles.css](styles.css) — color variables

---

# Verification

1. Load `index.html` in a browser (or via VS Code Live Server task).
2. Paste sample session + weekly usage text.
3. Confirm cards render identically to before (Used %, Resets, status badge, progress bar, sleep windows).
4. Toggle sleep hours — windows list must update correctly.
5. Check console — no JS errors.
6. `grep -rn "DAYS_R\|DAYS = \[" renderer.js` → should return 0 results (module constant only).
7. `grep -rn "statRow(" *.js index.html` → should return 0 results.
