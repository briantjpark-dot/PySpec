import { EditorView, basicSetup } from "codemirror";
import { yaml, yamlLanguage } from "@codemirror/lang-yaml";
import { autocompletion } from "@codemirror/autocomplete";
import { syntaxHighlighting } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { Prec, EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import { ydoc, provider, yarray } from "../collab.js";
import {
  nounFieldTypeCompletions,
  triggerNounFieldTypeDropdown,
  continueGivenListOnEnter,
  insertFunctionBlockOnDoubleEnter,
  pyspecHighlight,
  yamlNumberHighlighter,
  pyspecAutocompleteTheme,
} from "./yaml-editor-extensions.js";

// content is the tab's Y.Text
// yCollab only syncs future changes, it doesn't reconcile an initial mismatch.
function createSpecState(content, undoManager) {
  return EditorState.create({
    doc: content.toString(),
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
      yCollab(content, provider.awareness, { undoManager }),
    ],
  });
}

// Each spec tab holds its own Y.Text (shared) and Y.UndoManager (local -
// undo history is per-user, never synced). The CodeMirror state itself is
// rebuilt fresh via createSpecState() every time the editor attaches to a
// tab, rather than cached, so its starting text always matches the tab's
// *current* content even if a collaborator edited it while it wasn't visible.
let specTabs = [];
let activeSpecTabId = null;

// Placeholder until the first real tab exists (not yCollab-backed since there's
// no Y.Text to attach to yet)
export const editorView = new EditorView({
  parent: document.getElementById("editor"),
  state: EditorState.create({ doc: "", extensions: [basicSetup, yaml()] }),
});

export function getSpecTabs() {
  return specTabs;
}

export function getActiveSpecTabId() {
  return activeSpecTabId;
}

// Lets renderSpecTabs/renderOutputForActiveTab react to tab-state changes
// without reconcileSpecTabs/switchToSpecTab needing to call them by name -
// keeps this module decoupled from the rendering modules that consume it.
const tabsChangedListeners = [];
export function onTabsChanged(fn) {
  tabsChangedListeners.push(fn);
}
function notifyTabsChanged() {
  for (const fn of tabsChangedListeners) fn();
}

// Rebuilds specTabs from yarray
function reconcileSpecTabs() {
  const existingById = new Map(specTabs.map((t) => [t.id, t]));
  const ymaps = yarray.toArray();
  const currentIds = new Set(ymaps.map((ymap) => ymap.get("id")));

  // A tab whose id is no longer in yarray was closed (by us or a
  // collaborator) - its undoManager would otherwise keep listening on ydoc
  // forever, since ydoc itself never gets destroyed.
  for (const [id, tab] of existingById) {
    if (!currentIds.has(id)) tab.undoManager.destroy();
  }

  specTabs = ymaps.map((ymap) => {
    const id = ymap.get("id");
    const existing = existingById.get(id);
    if (existing) {
      existing.name = ymap.get("title");
      return existing;
    }
    const content = ymap.get("content");
    return {
      id,
      name: ymap.get("title"),
      content,
      undoManager: new Y.UndoManager(content),
      buildResult: { status: "idle" },
      fileHandle: null,
      fileName: null,
    };
  });

  if (!specTabs.some((t) => t.id === activeSpecTabId)) {
    activeSpecTabId = specTabs[0]?.id ?? null;
    if (activeSpecTabId) {
      const activeTab = specTabs.find((t) => t.id === activeSpecTabId);
      editorView.setState(createSpecState(activeTab.content, activeTab.undoManager));
    }
  }

  notifyTabsChanged();
}

// Seeds the shared room with one blank tab the first time it's ever opened.
provider.on("synced", (isSynced) => {
  if (!isSynced) return;
  if (yarray.length === 0) {
    const tab = new Y.Map();
    tab.set("id", crypto.randomUUID());
    tab.set("title", "Spec 1");
    tab.set("content", new Y.Text());
    yarray.push([tab]);
  }
});

export function switchToSpecTab(id) {
  if (id === activeSpecTabId) return;

  const nextTab = specTabs.find((t) => t.id === id);
  if (!nextTab) return;

  activeSpecTabId = id;
  // Rebuilt fresh (not cached) so the doc always matches nextTab.content's
  // current value, even if a collaborator edited it while we were on another tab.
  editorView.setState(createSpecState(nextTab.content, nextTab.undoManager));
  notifyTabsChanged();
}

// Computes "Spec N" from the shared tab list's last title, same scheme the
// old local-only makeSpecTab() used.
function nextTabName() {
  const lastTab = yarray.get(yarray.length - 1);
  const lastNumber = lastTab ? parseInt(lastTab.get("title").slice("Spec ".length), 10) || 0 : 0;
  return `Spec ${lastNumber + 1}`;
}

export function addSpecTab() {
  const ymap = new Y.Map();
  const id = crypto.randomUUID();
  ymap.set("id", id);
  ymap.set("title", nextTabName());
  ymap.set("content", new Y.Text());
  yarray.push([ymap]); // triggers reconcileSpecTabs synchronously, so specTabs already has `id` below
  switchToSpecTab(id);
}

export function closeSpecTab(id) {
  if (specTabs.length === 1) return;

  const index = yarray.toArray().findIndex((ymap) => ymap.get("id") === id);
  if (index === -1) return;

  const wasActive = id === activeSpecTabId;
  yarray.delete(index, 1); // triggers reconcileSpecTabs synchronously, which already picked some fallback active tab

  if (wasActive) {
    // Prefer the tab that slid into the closed one's spot (or the one before
    // it, if the closed tab was last) over reconcileSpecTabs' default of "just
    // pick specTabs[0]".
    const neighbor = specTabs[index] || specTabs[index - 1];
    if (neighbor) switchToSpecTab(neighbor.id);
  }
}

// Called last from main.js, once every module that needs to subscribe via
// onTabsChanged has been imported.
export function initSpecTabs() {
  yarray.observe(reconcileSpecTabs);
  reconcileSpecTabs();
}
