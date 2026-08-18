import { EditorView } from "codemirror";
import { completeFromList, startCompletion } from "@codemirror/autocomplete";
import { HighlightStyle, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// Syntax colors for the YAML spec editor.
export const pyspecHighlight = HighlightStyle.define([
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
export function continueGivenListOnEnter(view) {
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

// Offers "text" / "whole number" / etc. only while typing a field's value under the "nouns:" block.
export function nounFieldTypeCompletions(context) {
  const line = context.state.doc.lineAt(context.pos);
  const beforeCursor = line.text.slice(0, context.pos - line.from);
  if (!/^\s*[\w.-]+:\s/.test(beforeCursor)) return null;
  if (topLevelKeyFor(context.state.doc, line.number) !== "nouns") return null;
  return nounFieldTypeSource(context);
}

// Detects the moment a space is pressed right after "key:" to trigger the autosuggest
export function triggerNounFieldTypeDropdown(view) {
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

// Windows-95-styled dropdown for the noun-field-type autocomplete above
export const pyspecAutocompleteTheme = EditorView.theme({
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
// tags.number above never matches. Detect numeric values by content instead
const yamlNumberPattern = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
const numberMark = Decoration.mark({ class: "cm-pyspec-number" });

export const yamlNumberHighlighter = ViewPlugin.fromClass(
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

// Snippet inserted after a function's last "returns:" line (see insertFunctionBlockOnDoubleEnter below).
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
export function insertFunctionBlockOnDoubleEnter(view) {
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
