import './style.css'
import { EditorView, basicSetup } from "codemirror";
import { yaml, yamlLanguage } from "@codemirror/lang-yaml";
import { completeFromList, autocompletion, startCompletion } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Decoration, ViewPlugin, keymap } from "@codemirror/view";
import { RangeSetBuilder, Prec } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";

const buildBtn = document.getElementById("build-btn");
const outputCode = document.getElementById("output-code");
const errorBanner = document.getElementById("error-banner");
const tabs = document.getElementById("tabs");
const buildModal = document.getElementById("build-modal");
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

fileMenuBtn.addEventListener("click", () => {
  fileMenu.hidden = !fileMenu.hidden;
  fileMenuBtn.classList.toggle("menu-open", !fileMenu.hidden);
});

document.addEventListener("click", (e) => {
  if (!fileMenu.hidden && !e.target.closest(".menu-item-wrap")) {
    fileMenu.hidden = true;
    fileMenuBtn.classList.remove("menu-open");
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

// Walk upward from `lineNumber`, tracking the smallest indentation seen, to
// find the enclosing top-level (0-indent) key - i.e. which top-level YAML
// section this line lives under.
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

// @lezer/yaml has no distinct Number node - every plain scalar (numbers,
// bare words, booleans, ...) parses as "Literal" tagged tags.content, so
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
  "functions:",
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

const editorView = new EditorView({
  parent: document.getElementById("editor"),
  doc: `project: DateMatch  # The name of your project
overview: |
  # Just as you'd prompt Claude Code with an overview of what you're building,
  # give some general context here.
  A simple dating app that scores compatibility between two user profiles.

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
      # Examples become tests — give sample inputs and their expected output
      - given:
          profile_a: {name: Sam, age: 30, verified: true}
          profile_b: {name: Alex, age: 28, verified: true}
        returns: true
`,
  extensions: [
    basicSetup,
    yaml(),
    yamlLanguage.data.of({ autocomplete: nounFieldTypeCompletions }),
    Prec.high(autocompletion({ activateOnTyping: false })),
    syntaxHighlighting(pyspecHighlight),
    yamlNumberHighlighter,
    Prec.highest(keymap.of([
      { key: "Enter", run: insertFunctionBlockOnDoubleEnter },
      { key: " ", run: triggerNounFieldTypeDropdown },
      indentWithTab,
    ])),
    EditorView.baseTheme({
      ".cm-pyspec-number": { color: "#800080" },
    }),
    pyspecAutocompleteTheme,
  ],
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

buildBtn.addEventListener("click", async () => {
  const yamlText = editorView.state.doc.toString();

  errorBanner.hidden = true;
  errorBanner.textContent = "";
  outputCode.textContent = "";
  tabs.textContent = "";
  statusText.textContent = "Building…";
  buildModal.hidden = false;

  let response, data;
  try {
    response = await fetch("http://127.0.0.1:8001/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: yamlText }),
    });
    data = await response.json();
  } finally {
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
});
