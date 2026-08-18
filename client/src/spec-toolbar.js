// Editor toolbar actions — undo/redo and the two "replace the doc" buttons.

import { getSpecTabs, getActiveSpecTabId, editorView, onTabsChanged } from "./spec-tabs-state.js";
import { starterSpecTemplate, blankSpecTemplate } from "./spec-templates.js";
import { closeMenus } from "./window-chrome-menu.js";
import { downloadBlob } from "./build-workflow.js";
import { showError, clearError } from "./error-banner.js";

const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const insertBlankTemplateBtn = document.getElementById("insert-blank-template-btn");
const loadGuideTemplateBtn = document.getElementById("load-guide-template-btn");
const uploadSpecBtn = document.getElementById("upload-spec-btn");
const uploadSpecInput = document.getElementById("upload-spec-input");
const saveSpecBtn = document.getElementById("save-spec-btn");
const downloadSpecBtn = document.getElementById("download-spec-btn");
const titlebarFilename = document.getElementById("titlebar-filename");

// Reflects the active tab's uploaded filename in the titlebar, or the
// "spec.yaml" default if it was never loaded from a file. Runs on every
// tab-state change (switch/add/close) via onTabsChanged, and is also called
// directly right after an upload sets fileName on the active tab.
function renderTitlebarFilename() {
  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  titlebarFilename.textContent = `PySpec 95 — ${activeTab?.fileName ?? "spec.yaml"}`;
}
onTabsChanged(renderTitlebarFilename);

// File System Access API (showOpenFilePicker/showSaveFilePicker) is Chromium-only.
// Where it's missing, "Upload spec" falls back to the plain <input type="file">
// flow below and no "Save" option is offered since there's no handle to write back to.
const supportsFileSystemAccess = "showOpenFilePicker" in window && "showSaveFilePicker" in window;

// "application/octet-stream" (not a YAML-specific MIME type) is deliberate: YAML has no
// universally-registered MIME type, and the native file picker greys out files it can't
// map to an OS-recognized type for the given extensions. octet-stream is always recognized,
// so the .yaml/.yml extension filter actually takes effect.
const YAML_FILE_PICKER_TYPES = [
  { description: "YAML spec", accept: { "application/octet-stream": [".yaml", ".yml"] } },
];

// y-codemirror.next doesn't publicly export undo/redo commandsso these call the active tab's own
// Y.UndoManager directly
undoBtn.addEventListener("click", () => {
  getSpecTabs().find((t) => t.id === getActiveSpecTabId())?.undoManager.undo();
  editorView.focus();
});

redoBtn.addEventListener("click", () => {
  getSpecTabs().find((t) => t.id === getActiveSpecTabId())?.undoManager.redo();
  editorView.focus();
});

insertBlankTemplateBtn.addEventListener("click", () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: blankSpecTemplate },
  });
  closeMenus();
  editorView.focus();
});

loadGuideTemplateBtn.addEventListener("click", () => {
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: starterSpecTemplate },
  });
  closeMenus();
  editorView.focus();
});

uploadSpecBtn.addEventListener("click", async () => {
  if (supportsFileSystemAccess) {
    await pickAndLoadSpecFile();
    closeMenus();
    editorView.focus();
    return;
  }
  uploadSpecInput.click();
});

uploadSpecInput.addEventListener("change", async () => {
  const file = uploadSpecInput.files[0];
  if (!file) return;

  const text = await file.text();
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: text },
  });
  uploadSpecInput.value = "";

  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  activeTab.fileName = file.name;
  renderTitlebarFilename();

  closeMenus();
  editorView.focus();
});

// Names the download after the spec's "project:" value, falling back to "spec.yaml".
function specFilename(yamlText) {
  const match = yamlText.match(/^project:\s*(.+)$/m);
  const rawName = match ? match[1].replace(/\s+#.*$/, "").trim() : "";
  const sanitized = rawName.replace(/[\\/:*?"<>|]/g, "-");
  return sanitized ? `${sanitized}.yaml` : "spec.yaml";
}

downloadSpecBtn.addEventListener("click", () => {
  const yamlText = editorView.state.doc.toString();
  const blob = new Blob([yamlText], { type: "text/yaml" });
  downloadBlob(blob, specFilename(yamlText));
  closeMenus();
});

// Opens a spec file via the native file picker and keeps its handle on the
// active tab, so "Save" can later write straight back to the same file.
async function pickAndLoadSpecFile() {
  let handle;
  try {
    [handle] = await window.showOpenFilePicker({ types: YAML_FILE_PICKER_TYPES });
  } catch (err) {
    if (err.name === "AbortError") return;
    throw err;
  }

  const file = await handle.getFile();
  const text = await file.text();
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: text },
  });

  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  activeTab.fileHandle = handle;
  activeTab.fileName = handle.name;
  renderTitlebarFilename();
}

async function ensureWritePermission(handle) {
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

async function writeSpecToHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

// Writes the active tab's content back to its linked file, or — if it isn't
// linked to one yet — prompts for where to save and links it for next time.
async function saveActiveSpec() {
  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  const yamlText = editorView.state.doc.toString();

  try {
    let handle = activeTab.fileHandle;
    if (handle) {
      if (!(await ensureWritePermission(handle))) {
        showError("Permission to save to this file was denied.");
        return;
      }
    } else {
      handle = await window.showSaveFilePicker({
        suggestedName: specFilename(yamlText),
        types: YAML_FILE_PICKER_TYPES,
      });
      activeTab.fileHandle = handle;
    }

    await writeSpecToHandle(handle, yamlText);
    clearError();
  } catch (err) {
    if (err.name === "AbortError") return;
    showError(`Couldn't save spec: ${err.message}`);
  }
}

if (supportsFileSystemAccess) {
  saveSpecBtn.addEventListener("click", async () => {
    await saveActiveSpec();
    closeMenus();
    editorView.focus();
  });

  document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      await saveActiveSpec();
    }
  });
} else {
  saveSpecBtn.remove();
}
