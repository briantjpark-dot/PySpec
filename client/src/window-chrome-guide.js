// Window chrome — the draggable/resizable "guide" help window

const guideIcon = document.getElementById("guide-icon");
const guideWindow = document.getElementById("guide-window");
const guideTitlebar = document.getElementById("guide-titlebar");
const guideCloseBtn = document.getElementById("guide-close-btn");
const guideResizer = document.getElementById("guide-resizer");

guideIcon.addEventListener("dblclick", () => {
  guideWindow.hidden = false;
});

guideCloseBtn.addEventListener("click", () => {
  guideWindow.hidden = true;
});

let guideDragOffsetX = 0;
let guideDragOffsetY = 0;

guideTitlebar.addEventListener("pointerdown", (e) => {
  if (e.target.closest("#guide-close-btn")) return;
  guideTitlebar.setPointerCapture(e.pointerId);
  const rect = guideWindow.getBoundingClientRect();
  guideDragOffsetX = e.clientX - rect.left;
  guideDragOffsetY = e.clientY - rect.top;
});

guideTitlebar.addEventListener("pointermove", (e) => {
  if (!guideTitlebar.hasPointerCapture(e.pointerId)) return;
  guideWindow.style.left = `${e.clientX - guideDragOffsetX}px`;
  guideWindow.style.top = `${e.clientY - guideDragOffsetY}px`;
});

guideTitlebar.addEventListener("pointerup", (e) => {
  if (guideTitlebar.hasPointerCapture(e.pointerId)) {
    guideTitlebar.releasePointerCapture(e.pointerId);
  }
});

const GUIDE_MIN_WIDTH = 280;
const GUIDE_MIN_HEIGHT = 200;

guideResizer.addEventListener("pointerdown", (e) => {
  guideResizer.setPointerCapture(e.pointerId);
});

guideResizer.addEventListener("pointermove", (e) => {
  if (!guideResizer.hasPointerCapture(e.pointerId)) return;
  const rect = guideWindow.getBoundingClientRect();
  const width = Math.max(GUIDE_MIN_WIDTH, e.clientX - rect.left);
  const height = Math.max(GUIDE_MIN_HEIGHT, e.clientY - rect.top);
  guideWindow.style.width = `${width}px`;
  guideWindow.style.height = `${height}px`;
});

guideResizer.addEventListener("pointerup", (e) => {
  if (guideResizer.hasPointerCapture(e.pointerId)) {
    guideResizer.releasePointerCapture(e.pointerId);
  }
});
