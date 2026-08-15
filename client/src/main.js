import './style.css'
import { EditorView, basicSetup } from "codemirror";
import { yaml, yamlLanguage } from "@codemirror/lang-yaml";
import { completeFromList, autocompletion, startCompletion } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Decoration, ViewPlugin, keymap } from "@codemirror/view";
import { RangeSetBuilder, Prec } from "@codemirror/state";
import { indentWithTab, undo, redo } from "@codemirror/commands";
import JSZip from "jszip";

const buildBtn = document.getElementById("build-btn");
const outputCode = document.getElementById("output-code");
const errorBanner = document.getElementById("error-banner");
const tabs = document.getElementById("tabs");
const buildModal = document.getElementById("build-modal");
const modalStep = document.getElementById("modal-step");
const statusText = document.getElementById("status-text");
const progressFill = document.getElementById("progress-fill");
const taskbarClock = document.getElementById("taskbar-clock");
const editorPane = document.querySelector(".editor-pane");
const paneResizer = document.getElementById("pane-resizer");
const outputPane = document.getElementById("output-pane");
const outputCloseBtn = document.getElementById("output-close-btn");
const showFilesBtn = document.getElementById("show-files-btn");
const fileMenuBtn = document.getElementById("file-menu-btn");
const fileMenu = document.getElementById("file-menu");
const downloadZipBtn = document.getElementById("download-zip-btn");
const editMenuBtn = document.getElementById("edit-menu-btn");
const editMenu = document.getElementById("edit-menu");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const viewMenuBtn = document.getElementById("view-menu-btn");
const viewMenu = document.getElementById("view-menu");
const tabMenuBtn = document.getElementById("tab-menu-btn");
const tabMenu = document.getElementById("tab-menu");
const insertBlankTemplateBtn = document.getElementById("insert-blank-template-btn");
const loadGuideTemplateBtn = document.getElementById("load-guide-template-btn");
const helpMenuBtn = document.getElementById("help-menu-btn");
const helpMenu = document.getElementById("help-menu");
const guideIcon = document.getElementById("guide-icon");
const guideWindow = document.getElementById("guide-window");
const guideTitlebar = document.getElementById("guide-titlebar");
const guideCloseBtn = document.getElementById("guide-close-btn");
const guideResizer = document.getElementById("guide-resizer");

const menus = [
  { btn: fileMenuBtn, menu: fileMenu },
  { btn: editMenuBtn, menu: editMenu },
  { btn: viewMenuBtn, menu: viewMenu },
  { btn: tabMenuBtn, menu: tabMenu },
  { btn: helpMenuBtn, menu: helpMenu },
];

function closeMenus() {
  for (const { btn, menu } of menus) {
    menu.hidden = true;
    btn.classList.remove("menu-open");
  }
}

for (const { btn, menu } of menus) {
  btn.addEventListener("click", () => {
    const opening = menu.hidden;
    closeMenus();
    menu.hidden = !opening;
    btn.classList.toggle("menu-open", !opening);
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-item-wrap")) {
    closeMenus();
  }
});

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

const pyspecHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#000080" }, // navy for keywords
  { tag: tags.string, color: "#a31515" },  // red for quoted strings
  { tag: tags.number, color: "#800080" },  // purple for numbers --> Rn this doesn't work so ive created a custom thing
  { tag: tags.comment, color: "#008000", fontStyle: "italic" },  // green for comments
  { tag: tags.propertyName, color: "#000080", fontWeight: "bold" },  // navy bold for YAML keys
]);

// From build.py --> NEED TO KEEP THE SAME
const nounFieldTypes = [
  "text", "whole number", "number", "decimal", "yes/no", "true/false", "date",
];
const nounFieldTypeSource = completeFromList(nounFieldTypes);

// Walk upward from `lineNumber`, tracking the smallest indentation seen
function topLevelKeyFor(doc, lineNumber) {
  let minIndent = Infinity;
  for (let n = lineNumber; n >= 1; n--) {
    const line = doc.line(n);
    if (line.text.trim() === "") continue;
    const indent = line.text.match(/^ */)[0].length;
    if (indent < minIndent) {
      minIndent = indent;
      if (indent === 0) {
        const match = line.text.match(/^([\w.-]+):/);
        return match ? match[1] : null;
      }
    }
  }
  return null;
}

// Walk upward from a list item at `indent` to see whether its enclosing key is "given:"
function isWithinGivenList(doc, lineNumber, indent) {
  for (let n = lineNumber - 1; n >= 1; n--) {
    const line = doc.line(n);
    if (line.text.trim() === "") continue;
    const lineIndent = line.text.match(/^ */)[0].length;
    if (lineIndent < indent) {
      const trimmed = line.text.trim();
      const key = trimmed.startsWith("- ") ? trimmed.slice(2) : trimmed;
      return key.startsWith("given:");
    }
  }
  return false;
}

// Continues "- " bullets on Enter while inside a "given:" list; a second Enter on an empty bullet exits the list.
function continueGivenListOnEnter(view) {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const match = line.text.match(/^(\s*)-\s?/);
  if (!match) return false;

  const indent = match[1].length;
  if (!isWithinGivenList(view.state.doc, line.number, indent)) return false;

  const isEmptyBullet = line.text.trim() === "-";
  if (isEmptyBullet) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "" },
    });
    return true;
  }

  const insert = "\n" + " ".repeat(indent) + "- ";
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
  });
  return true;
}

function nounFieldTypeCompletions(context) {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  if (!/^\s*[\w.-]+:\s/.test(beforeCursor)) return null;
  if (topLevelKeyFor(context.state.doc, line.number) !== "nouns") return null;
  return nounFieldTypeSource(context);
}

// Detects the moment a space is pressed right after "key:" to trigger the autosuggest
function triggerNounFieldTypeDropdown(view) {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const beforeCursor = line.text.slice(0, pos - line.from);
  const justAfterColon = /:$/.test(beforeCursor);

  if (justAfterColon && topLevelKeyFor(view.state.doc, line.number) === "nouns") {
    view.dispatch({
      changes: { from: pos, to: pos, insert: " " },
      selection: { anchor: pos + 1 },
    });
    startCompletion(view);
    return true;
  }

  return false;
}

const pyspecAutocompleteTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": {
    background: "#c0c0c0",
    border: "1px solid",
    borderColor: "#dfdfdf #000 #000 #dfdfdf",
    borderRadius: 0,
    padding: "2px",
    boxShadow: "inset 1px 1px 0 #fff, inset -1px -1px 0 #808080, 2px 2px 0 rgba(0, 0, 0, .35)",
  },
  ".cm-tooltip-autocomplete > ul": {
    background: "#fff",
    border: "1px solid",
    borderColor: "#808080 #fff #fff #808080",
    fontFamily: "Tahoma, Verdana, 'MS Sans Serif', sans-serif",
    fontSize: "11px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    padding: "3px 6px",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    background: "#000080",
    color: "#fff",
  },
  ".cm-completionMatchedText": {
    textDecoration: "none",
    fontWeight: "bold",
    color: "#000080",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText": {
    color: "#fff",
  },
});

// @lezer/yaml has no distinct Number node so
// tags.number above never matches. Detect numeric values by content instead.
const yamlNumberPattern = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const numberMark = Decoration.mark({ class: "cm-pyspec-number" });

const yamlNumberHighlighter = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name !== "Literal" || node.node.parent?.name === "Key") return;
            const text = view.state.doc.sliceString(node.from, node.to);
            if (yamlNumberPattern.test(text)) {
              builder.add(node.from, node.to, numberMark);
            }
          },
        });
      }
      return builder.finish();
    }
  },
  { decorations: (instance) => instance.decorations }
);

const functionBlockTemplate = [
  "  - name: ",
  "    does:",
  "    input:",
  "    output:",
  "    examples:",
  "      - given:",
  "        returns:",
].join("\n");

//function so that when you double enter after return it automatically gives you a new function block
function insertFunctionBlockOnDoubleEnter(view) {
  const pos = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(pos);
  const currentIsBlank = currentLine.text.trim() === "";
  const previousLine = currentLine.number > 1
    ? view.state.doc.line(currentLine.number - 1)
    : null;

  if (currentIsBlank && previousLine && previousLine.text.trim().startsWith("returns:")) {
    const cursorOffset = functionBlockTemplate.indexOf("name: ") + "name: ".length;
    view.dispatch({
      changes: { from: currentLine.from, to: currentLine.to, insert: functionBlockTemplate },
      selection: { anchor: currentLine.from + cursorOffset },
    });
    return true;
  }

  return false;
}

const guideTemplate = `project: DateMatch  # The name of your project
overview: |
# Just as you'd prompt Claude Code with an overview of what you're building,
# give some general context here.
# Ex. A simple dating app that scores compatibility between two user profiles.

nouns:
  profile:  # Nouns are the objects or "things" your code works with
    # Fields can be sub-details of the noun. A dating profile might have:
    name: text
    age: whole number
    verified: true/false

functions:
  - name: is_match  # What your function is called
    does: Return whether two profiles are a compatible match.  # What it does, semantically
    input:
      profile_a: profile
      profile_b: profile
    output: true/false
    examples:
      # Examples become tests — give sample inputs and their expected output.
      # Examples are entirely optional but recommended!
      - given:
          profile_a: {name: Sam, age: 30, verified: true}
          profile_b: {name: Alex, age: 28, verified: true}
        returns: true
`;

const editorView = new EditorView({
  parent: document.getElementById("editor"),
  doc: guideTemplate,
  extensions: [
    basicSetup,
    yaml(),
    yamlLanguage.data.of({ autocomplete: nounFieldTypeCompletions }),
    Prec.high(autocompletion({ activateOnTyping: false })),
    syntaxHighlighting(pyspecHighlight),
    yamlNumberHighlighter,
    Prec.highest(keymap.of([
      { key: "Enter", run: (view) => continueGivenListOnEnter(view) || insertFunctionBlockOnDoubleEnter(view) },
      { key: " ", run: triggerNounFieldTypeDropdown },
      indentWithTab,
    ])),
    EditorView.baseTheme({
      ".cm-pyspec-number": { color: "#800080" },
    }),
    pyspecAutocompleteTheme,
  ],
});

undoBtn.addEventListener("click", () => {
  undo(editorView);
  editorView.focus();
});

redoBtn.addEventListener("click", () => {
  redo(editorView);
  editorView.focus();
});

insertBlankTemplateBtn.addEventListener("click", () => {
  const blankTemplate = `project:
overview: |


nouns:
  noun1:
    field1:
    field2:

functions:
  - name:
    does:
    input:
    output:
    examples:
      - given:
          - {}
          - {}
        returns:`;

  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: blankTemplate },
  });
  closeMenus();
  editorView.focus();
});

loadGuideTemplateBtn.addEventListener("click", () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: guideTemplate },
  });
  closeMenus();
  editorView.focus();
});

function updateClock() {
  taskbarClock.textContent = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

updateClock();
setInterval(updateClock, 1000 * 30);

function selectTab(button, name, data) {
  for (const btn of tabs.children) {
    btn.classList.remove("tab-active");
  }
  button.classList.add("tab-active");
  outputCode.textContent = data.files[name];
}

let lastBuildFiles = null;

const BUILD_STEPS = [
  "Parsing spec...",
  "Resolving nouns...",
  "Writing functions.py...",
  "Deriving tests and examples...",
];

buildBtn.addEventListener("click", async () => {
  const yamlText = editorView.state.doc.toString();

  errorBanner.hidden = true;
  errorBanner.textContent = "";
  outputCode.textContent = "";
  tabs.textContent = "";
  statusText.textContent = "Building…";
  buildModal.hidden = false;
  downloadZipBtn.disabled = true;
  lastBuildFiles = null;

  const STEP_DURATION_MS = 800;

  let stepIndex = 0;
  modalStep.textContent = BUILD_STEPS[stepIndex];
  const stepInterval = setInterval(() => {
    stepIndex = (stepIndex + 1) % BUILD_STEPS.length;
    modalStep.textContent = BUILD_STEPS[stepIndex];
  }, STEP_DURATION_MS);

  let response, data;
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: yamlText }),
    });
    data = await response.json();
  } finally {
    clearInterval(stepInterval);
    progressFill.classList.add("complete");
    await new Promise((resolve) => setTimeout(resolve, 300));
    buildModal.hidden = true;
    progressFill.classList.remove("complete");
  }

  if (!response.ok) {
    errorBanner.textContent = data.detail || "Build failed.";
    errorBanner.hidden = false;
    statusText.textContent = "Build failed.";
    return;
  }

  const fileNames = Object.keys(data.files);

  let firstTab = null;
  for (const name of fileNames) {
    const tab = document.createElement("button");
    tab.textContent = name;
    tab.addEventListener("click", () => selectTab(tab, name, data));
    tabs.appendChild(tab);
    if (!firstTab) firstTab = tab;
  }

  if (firstTab) {
    selectTab(firstTab, fileNames[0], data);
  }

  statusText.textContent = "Build succeeded.";

  lastBuildFiles = data.files;
  downloadZipBtn.disabled = false;
});

downloadZipBtn.addEventListener("click", async () => {
  const blob = await makeZip(lastBuildFiles);
  downloadBlob(blob, "pyspec-output.zip");
});

async function makeZip(files) {
  const zip = new JSZip();
  for (const [filename, contents] of Object.entries(files)) {
    zip.file(filename, contents);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return blob;
}

//making a temp url and an invisible link
//i know we can use fileSave.js but I tried it that way and for some reason it didn't work,
//maybe the library is just funky
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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