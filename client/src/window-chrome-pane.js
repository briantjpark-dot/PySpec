// Window chrome — draggable pane divider and output-pane show/hide

const editorPane = document.querySelector(".editor-pane");
const paneResizer = document.getElementById("pane-resizer");
const outputPane = document.getElementById("output-pane");
const outputCloseBtn = document.getElementById("output-close-btn");
const showFilesBtn = document.getElementById("show-files-btn");

const MIN_PANE_WIDTH = 200;
let savedEditorFlex = "";

paneResizer.addEventListener("pointerdown", (e) => {
  paneResizer.setPointerCapture(e.pointerId);
  paneResizer.classList.add("dragging");
});

paneResizer.addEventListener("pointermove", (e) => {
  if (!paneResizer.hasPointerCapture(e.pointerId)) return;
  const panesRect = paneResizer.parentElement.getBoundingClientRect();
  const maxWidth = panesRect.width - paneResizer.offsetWidth - MIN_PANE_WIDTH;
  const width = Math.min(maxWidth, Math.max(MIN_PANE_WIDTH, e.clientX - panesRect.left));
  editorPane.style.flex = `0 0 ${width}px`;
});

paneResizer.addEventListener("pointerup", (e) => {
  paneResizer.releasePointerCapture(e.pointerId);
  paneResizer.classList.remove("dragging");
});

outputCloseBtn.addEventListener("click", () => {
  savedEditorFlex = editorPane.style.flex;
  outputPane.hidden = true;
  paneResizer.hidden = true;
  editorPane.style.flex = "1";
  showFilesBtn.hidden = false;
});

showFilesBtn.addEventListener("click", () => {
  outputPane.hidden = false;
  paneResizer.hidden = false;
  editorPane.style.flex = savedEditorFlex;
  showFilesBtn.hidden = true;
});
