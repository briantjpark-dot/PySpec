// Spec tabs — lets the editor pane hold multiple independent spec
// documents, mirroring the output pane's tabbed layout below.

import { getSpecTabs, getActiveSpecTabId, onTabsChanged, switchToSpecTab, addSpecTab, closeSpecTab } from "./spec-tabs-state.js";

const specTabsContainer = document.getElementById("spec-tabs");

function renderSpecTabs() {
  specTabsContainer.textContent = "";

  const specTabs = getSpecTabs();
  const activeSpecTabId = getActiveSpecTabId();

  for (const tab of specTabs) {
    const button = document.createElement("button");
    button.textContent = tab.name;
    if (tab.id === activeSpecTabId) button.classList.add("tab-active");
    button.addEventListener("click", () => switchToSpecTab(tab.id));

    if (specTabs.length > 1) {
      const closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeSpecTab(tab.id);
      });
      button.appendChild(closeBtn);
    }

    specTabsContainer.appendChild(button);
  }

  const addBtn = document.createElement("button");
  addBtn.className = "tab-add-btn";
  addBtn.textContent = "+";
  addBtn.addEventListener("click", addSpecTab);
  specTabsContainer.appendChild(addBtn);
}

onTabsChanged(renderSpecTabs);
