# Always-visible target bar + target endpoint marker

## Context

The unified progress bar on each usage card overlays an "actual used" fill on top of a "target used" fill. Today the actual fill is opaque, so whenever actual ≥ target, the target fill is completely hidden — you lose the "where you should be" reference exactly in the case that matters most (over-target). Even when both bars are visible (under-target), the two endpoints can land close enough that you can't tell where target ends.

Goal: keep both bars legible when they overlap, and add a distinct marker at the target's endpoint so its position is always locatable regardless of actual's width.

Purely visual change. No math, parsing, or data-flow changes.

## Design

### Translucent actual fill with screen blend

- `.bar-actual-fill` backgrounds change from opaque to translucent:
  - `status-under` / `status-on`: `rgba(34, 197, 94, 0.7)` (green)
  - `status-over`: `rgba(239, 68, 68, 0.75)` (red)
- Add `mix-blend-mode: screen` to `.bar-actual-fill`. On the dark `#2a2a2e` track, screen blending produces brighter composites in the overlap region (green + indigo → teal-leaning; red + indigo → magenta-leaning) instead of the muddier darkening that `multiply` or plain alpha would give.
- `.bar-target-fill` stays opaque indigo (`#6366f1`) — it's the reference layer.
- The actual-endpoint dot (`.bar-endpoint-dot`) stays fully opaque — the "you are here" marker must stay crisp.

### Target endpoint marker (line + notch)

Add a new element at `left: targetPct%` on the track.

- Element: `<div class="bar-target-marker">` appended inside `.bar-track.unified` in `buildUnifiedBar`, positioned after the fills but before the actual-endpoint dot so the dot wins if they coincide.
- Style:
  - `position: absolute; left: <targetPct>%; transform: translateX(-50%);`
  - Width `2px`.
  - Height extends ~4px above and ~4px below the 12px track (total height ~20px, `top: -4px; height: 20px`). This is the "notch" that pops above/below the bar so it's distinguishable from the 9 ordinary 1px tick marks that live flush inside the track.
  - Color `#a5b4fc` (lighter indigo) — contrasts against both the indigo target fill and the green/red actual fill.
  - Glow: `box-shadow: 0 0 3px rgba(165, 180, 252, 0.6)` to keep it legible over the translucent actual fill.
  - `pointer-events: none`.
  - `border-radius: 1px`.

### What doesn't change

- Target fill color, tick marks, endpoint dot, status colors, legend.
- `computeStats` and all callers.
- Bar layout, dimensions, or card structure.

## Files to modify

- [renderer.js:88-120](renderer.js#L88-L120) — `buildUnifiedBar`: append one `.bar-target-marker` div, positioned at `targetClamped + '%'`, inserted after the fills and before the endpoint dot.
- [styles.css:168-193](styles.css#L168-L193) — update `.bar-actual-fill.*` backgrounds to rgba, add `mix-blend-mode: screen` to `.bar-actual-fill`, add `.bar-target-marker` rules.

## Verification

Serve locally and paste sample data that exercises each status. Dev server runs on `http://127.0.0.1:5500/`.

Visual checks on the bar in each state:

- **Under** (actual < target): indigo target extends past the green actual; the light-indigo marker line sits at target's right edge, past the green bar. Green and indigo do not overlap.
- **On target** (actual ≈ target): marker line sits on/very near actual's endpoint; where the green and indigo fills overlap, the composite is visibly lighter than either alone (screen blend confirmed working).
- **Over** (actual > target): red translucent bar extends past target's indigo; the marker line sits inside the red region at target's edge and remains clearly visible against the red. The indigo target fill is still visible under the red through the translucency.

Sanity: endpoint dot still reads as the loudest element at actual's position; ticks at 10/20/…/90 are still visible but quieter than the target marker.

Regression check: card renders, legend unchanged, suggestion section unchanged, exponent slider still updates the bar.
