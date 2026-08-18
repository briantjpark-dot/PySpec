// Window chrome — menu bar (File/Edit/View/Tab/Help)

const fileMenuBtn = document.getElementById("file-menu-btn");
const fileMenu = document.getElementById("file-menu");
const editMenuBtn = document.getElementById("edit-menu-btn");
const editMenu = document.getElementById("edit-menu");
const viewMenuBtn = document.getElementById("view-menu-btn");
const viewMenu = document.getElementById("view-menu");
const tabMenuBtn = document.getElementById("tab-menu-btn");
const tabMenu = document.getElementById("tab-menu");
const helpMenuBtn = document.getElementById("help-menu-btn");
const helpMenu = document.getElementById("help-menu");

const menus = [
  { btn: fileMenuBtn, menu: fileMenu },
  { btn: editMenuBtn, menu: editMenu },
  { btn: viewMenuBtn, menu: viewMenu },
  { btn: tabMenuBtn, menu: tabMenu },
  { btn: helpMenuBtn, menu: helpMenu },
];

export function closeMenus() {
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
