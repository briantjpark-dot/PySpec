// Build workflow — sends the spec to the API, renders the generated files,
// and offers them as a zip download.

import JSZip from "jszip";
import { getSpecTabs, getActiveSpecTabId, editorView, onTabsChanged } from "./spec-tabs-state.js";
import { showError, clearError } from "./error-banner.js";

const buildBtn = document.getElementById("build-btn");
const outputCode = document.getElementById("output-code");
const tabs = document.getElementById("tabs");
const buildModal = document.getElementById("build-modal");
const modalStep = document.getElementById("modal-step");
const statusText = document.getElementById("status-text");
const progressFill = document.getElementById("progress-fill");
const downloadZipBtn = document.getElementById("download-zip-btn");

function selectOutputTab(button, name) {
  for (const btn of tabs.children) {
    btn.classList.remove("tab-active");
  }
  button.classList.add("tab-active");
  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  outputCode.textContent = activeTab.buildResult.files[name];
  activeTab.buildResult.selectedFile = name;
}

// Restores the output pane to whichever spec tab is now active like its last
// build's files, its last build error, or the empty "not built yet" state.
function renderOutputForActiveTab() {
  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  if (!activeTab) return;
  const result = activeTab.buildResult;

  clearError();
  tabs.textContent = "";
  outputCode.textContent = "";
  downloadZipBtn.disabled = true;

  if (result.status === "error") {
    showError(result.errorMessage);
    return;
  }

  if (result.status === "success") {
    const fileNames = Object.keys(result.files);
    let selectedButton = null;
    for (const name of fileNames) {
      const tab = document.createElement("button");
      tab.textContent = name;
      tab.addEventListener("click", () => selectOutputTab(tab, name));
      tabs.appendChild(tab);
      if (name === result.selectedFile) selectedButton = tab;
    }
    selectOutputTab(selectedButton || tabs.firstChild, result.selectedFile || fileNames[0]);
    downloadZipBtn.disabled = false;
  }
}

const BUILD_STEPS = [
  "Parsing spec...",
  "Resolving nouns...",
  "Writing functions.py...",
  "Deriving tests and examples...",
];

buildBtn.addEventListener("click", async () => {
  const targetTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  const yamlText = editorView.state.doc.toString();

  clearError();
  outputCode.textContent = "";
  tabs.textContent = "";
  statusText.textContent = "Building…";
  buildModal.hidden = false;
  downloadZipBtn.disabled = true;
  targetTab.buildResult = { status: "idle" };

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
    const errorMessage = data.detail || "Build failed.";
    targetTab.buildResult = { status: "error", errorMessage };
    showError(errorMessage);
    statusText.textContent = "Build failed.";
    return;
  }

  const fileNames = Object.keys(data.files);
  targetTab.buildResult = { status: "success", files: data.files, selectedFile: fileNames[0] };

  let firstTab = null;
  for (const name of fileNames) {
    const tab = document.createElement("button");
    tab.textContent = name;
    tab.addEventListener("click", () => selectOutputTab(tab, name));
    tabs.appendChild(tab);
    if (!firstTab) firstTab = tab;
  }

  if (firstTab) {
    selectOutputTab(firstTab, fileNames[0]);
  }

  statusText.textContent = "Build succeeded.";
  downloadZipBtn.disabled = false;
});

downloadZipBtn.addEventListener("click", async () => {
  const activeTab = getSpecTabs().find((t) => t.id === getActiveSpecTabId());
  const blob = await makeZip(activeTab.buildResult.files);
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
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

onTabsChanged(renderOutputForActiveTab);
