# Guide window design

## Purpose

Replace the currently-unused "My Specs" desktop icon with the existing (also
currently-unused) "GUIDE" icon, and wire that icon up to open a floating,
draggable, resizable Win95-style window containing a condensed syntax
quick-reference for writing PySpec specs.

## Icon changes (`client/index.html`)

- Delete the "My Specs" `.icon` block entirely.
- The "GUIDE" `.icon` block (currently `icon-glyph doc` + label "GUIDE")
  becomes the sole entry in `.desktop-icons`, taking the top slot.
- Give the icon's wrapper an id (`guide-icon`) so it can be wired up in JS.
- Single click on the icon does nothing (matches current icon behavior —
  no icon in the app has single-click interactivity today).

## Guide window markup (`client/index.html`)

A new top-level element, sibling to `#build-modal`, hidden by default:

```html
<div id="guide-window" class="guide-window window raised" hidden>
  <div class="titlebar" id="guide-titlebar">
    <div class="titlebar-icon">?</div>
    <div class="titlebar-text">Guide</div>
    <div class="titlebar-buttons">
      <button id="guide-close-btn" class="tb-btn">&#215;</button>
    </div>
  </div>
  <div class="guide-body sunken">
    <!-- condensed quick-reference content: types table, one noun/function
         example, common-mistakes list, adapted from README.md -->
  </div>
  <div id="guide-resizer" class="guide-resizer"></div>
</div>
```

Reuses `.window`, `.raised`, `.titlebar`, `.titlebar-icon`, `.titlebar-text`,
`.titlebar-buttons`, `.tb-btn` classes already defined for the main app
window, so it inherits the same visual language for free. `.guide-window`,
`.guide-body`, and `.guide-resizer` are new, scoped classes for
positioning/behavior that don't exist elsewhere.

## Content

A condensed quick-reference, written as static HTML directly in the body
(no markdown rendering dependency — none exists in `client/package.json`
today and this doesn't justify adding one):

- The types table (`text`, `whole number`, `decimal`/`number`, `yes/no`,
  `date`).
- One short noun + function example (reuse the `task` / `count_unfinished`
  example from the README).
- The "Common mistakes" bullet list from the README.

Body scrolls internally (`overflow-y: auto`) if content exceeds the window's
current height, since the window is user-resizable.

## Positioning, dragging, resizing (`client/src/style.css` + `client/src/main.js`)

- `.guide-window` is `position: fixed` (not part of the normal
  `.desktop-main` flex flow), so it floats above both the icon column and
  the main app window. Default opening geometry: `width: 480px;
  height: 360px;` positioned with a fixed inline `top`/`left` offset (e.g.
  `top: 60px; left: 140px;`) set once in JS the first time it opens.
- `z-index` places it above `.window` (the main app window) but the exact
  value only matters relative to that one element and `.modal-overlay`
  (build modal) — pick a value above `.window`'s implicit stacking and
  below `.modal-overlay`'s `z-index: 50`, e.g. `z-index: 40`.
- **Dragging**: pointerdown on `#guide-titlebar` (excluding the close
  button) captures the pointer and updates the window's inline `left`/`top`
  on `pointermove`, releasing on `pointerup` — the same pattern already
  used by `#pane-resizer` in `main.js` (`setPointerCapture` /
  `hasPointerCapture` / release on `pointerup`).
- **Resizing**: pointerdown on `#guide-resizer` (a small corner grip,
  bottom-right, styled similarly to `#pane-resizer` but as a corner square
  rather than a bar) captures the pointer and updates inline `width`/
  `height` on `pointermove`, clamped to a minimum of `280px` × `200px` so
  it can't be resized away to nothing. Same capture/release pattern.
- No off-screen clamping on drag or resize — consistent with how a real
  Win95 window can be dragged partly off-screen. Kept simple; not a
  requirement.

## Open/close behavior (`client/src/main.js`)

- Double-click (`dblclick`) on `#guide-icon` sets `guideWindow.hidden =
  false`. If this is the first time it's being opened, apply the default
  geometry (`top`/`left`/`width`/`height`) before showing; on subsequent
  opens, whatever geometry the user last left it at (position/size) is
  preserved, since closing only toggles `hidden` and never resets inline
  styles.
- Click on `#guide-close-btn` sets `guideWindow.hidden = true`. Stops
  propagation so it doesn't also trigger a drag via the titlebar pointerdown
  handler.
- No taskbar entry, no minimize/maximize — out of scope, matches the
  narrower ask (open, move, resize, close, reopen).

## Out of scope

- Minimize/maximize buttons (decorative only elsewhere in this app; not
  requested here).
- Taskbar integration for the Guide window.
- Rendering the full README or fetching it at runtime — content is a fixed,
  condensed excerpt written directly in HTML.
- Multi-window management / focus stacking beyond a single fixed z-index
  (there is only ever one Guide window instance).
- Touch/mobile drag support beyond what Pointer Events already provide for
  free (the existing pane-resizer makes the same assumption).
