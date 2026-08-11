const buildBtn = document.getElementById("build-btn");
const specInput = document.getElementById("spec-input");
const outputCode = document.getElementById("output-code");
const errorBanner = document.getElementById("error-banner");
const tabs = document.getElementById("tabs");

buildBtn.addEventListener("click", async () => {
    const yamlText = specInput.value;

    errorBanner.textContent = "";
    outputCode.textContent = "";
    tabs.textContent = "";

    const response = await fetch("http://127.0.0.1:8001/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec: yamlText }),
    });

    const data = await response.json();

    if (!response.ok) {
        errorBanner.textContent = data.detail || "Build failed.";
        return;
    }

    const fileNames = Object.keys(data.files);

    for (const name of fileNames) {
        const tab = document.createElement("button");
        tab.textContent = name;
        tab.addEventListener("click", () => {
            outputCode.textContent = data.files[name];
        });
        tabs.appendChild(tab);
    }

    outputCode.textContent = data.files[fileNames[0]];
});
