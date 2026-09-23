"use strict";

// Battledisk Packager
// Scratch .sb3 -> standalone HTML

let currentProject = null;
let currentAssets = {};
let currentFileName = null;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function $(id) {
    return document.getElementById(id);
}

function setStatus(message) {
    const status = $("status");

    if (status) {
        status.textContent = message;
    }

    console.log("[Battledisk]", message);
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safeJSONStringify(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function getMimeType(filename) {
    const extension = filename
        .split(".")
        .pop()
        .toLowerCase();

    const types = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        bmp: "image/bmp",

        wav: "audio/wav",
        mp3: "audio/mpeg",
        ogg: "audio/ogg",

        json: "application/json",
        txt: "text/plain"
    };

    return types[extension] ||
        "application/octet-stream";
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (
        let i = 0;
        i < bytes.length;
        i += chunkSize
    ) {
        const chunk = bytes.subarray(
            i,
            Math.min(i + chunkSize, bytes.length)
        );

        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function makeDataURL(filename, buffer) {
    return (
        "data:" +
        getMimeType(filename) +
        ";base64," +
        arrayBufferToBase64(buffer)
    );
}

// --------------------------------------------------
// Project information
// --------------------------------------------------

function getProjectName(project, fallback) {
    if (project.projectName) {
        return project.projectName;
    }

    if (project.name) {
        return project.name;
    }

    if (Array.isArray(project.targets)) {
        const stage = project.targets.find(
            target => target.isStage
        );

        if (
            stage &&
            stage.name &&
            stage.name !== "Stage"
        ) {
            return stage.name;
        }
    }

    return fallback.replace(
        /\.sb3$/i,
        ""
    );
}

function countTargets(project) {
    return Array.isArray(project.targets)
        ? project.targets.length
        : 0;
}

// --------------------------------------------------
// Load SB3
// --------------------------------------------------

async function loadSB3(file) {
    if (!file) {
        throw new Error(
            "No .sb3 file selected."
        );
    }

    if (
        !file.name
            .toLowerCase()
            .endsWith(".sb3")
    ) {
        throw new Error(
            "Please select a Scratch .sb3 file."
        );
    }

    if (typeof JSZip === "undefined") {
        throw new Error(
            "JSZip is not loaded."
        );
    }

    setStatus("Opening project...");

    const buffer =
        await file.arrayBuffer();

    const zip =
        await JSZip.loadAsync(buffer);

    const projectFile =
        zip.file("project.json");

    if (!projectFile) {
        throw new Error(
            "project.json was not found."
        );
    }

    setStatus("Reading project.json...");

    const projectText =
        await projectFile.async("text");

    let project;

    try {
        project =
            JSON.parse(projectText);
    } catch {
        throw new Error(
            "project.json contains invalid JSON."
        );
    }

    if (
        !project.targets ||
        !Array.isArray(project.targets)
    ) {
        throw new Error(
            "This does not appear to be a valid Scratch project."
        );
    }

    currentProject = project;
    currentFileName = file.name;
    currentAssets = {};

    setStatus("Extracting assets...");

    for (const entry of Object.values(zip.files)) {
        if (entry.dir) {
            continue;
        }

        if (entry.name === "project.json") {
            continue;
        }

        try {
            const assetBuffer =
                await entry.async("arraybuffer");

            currentAssets[entry.name] =
                makeDataURL(
                    entry.name,
                    assetBuffer
                );
        } catch (error) {
            console.warn(
                "Could not extract:",
                entry.name,
                error
            );
        }
    }

    updateProjectInfo();

    setStatus(
        `Loaded ${getProjectName(
            project,
            file.name
        )}`
    );
}

// --------------------------------------------------
// UI
// --------------------------------------------------

function updateProjectInfo() {
    if (!currentProject) {
        return;
    }

    const name =
        getProjectName(
            currentProject,
            currentFileName
        );

    const targets =
        countTargets(currentProject);

    const assets =
        Object.keys(currentAssets).length;

    if ($("projectName")) {
        $("projectName").textContent =
            name;
    }

    if ($("projectStatus")) {
        $("projectStatus").textContent =
            `${targets} targets • ${assets} assets`;
    }

    if ($("projectInfo")) {
        $("projectInfo").textContent =
            `Project: ${name}\n` +
            `Targets: ${targets}\n` +
            `Assets: ${assets}`;
    }
}

// --------------------------------------------------
// Generate HTML
// --------------------------------------------------

function generateHTML() {
    if (!currentProject) {
        throw new Error(
            "Load a project first."
        );
    }

    const projectName =
        getProjectName(
            currentProject,
            currentFileName ||
            "Battledisk Project"
        );

    const build = {
        format: "Battledisk HTML",
        version: "0.1.0",
        project: currentProject,
        assets: currentAssets
    };

    const buildJSON =
        safeJSONStringify(build);

    const title =
        escapeHTML(projectName);

    return `<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,
             initial-scale=1.0,
             maximum-scale=1.0,
             user-scalable=no"
>

<title>${title}</title>

<style>

html,
body {
    margin: 0;
    padding: 0;

    width: 100%;
    height: 100%;

    overflow: hidden;

    background: #000;
}

body {
    position: fixed;

    left: 0;
    top: 0;

    width: 100vw;
    height: 100vh;
}

#stage {
    display: block;

    position: absolute;

    left: 0;
    top: 0;

    width: 100vw;
    height: 100vh;

    background: white;
}

#loading {
    position: absolute;

    left: 50%;
    top: 50%;

    transform:
        translate(-50%, -50%);

    font-family: Arial, sans-serif;

    font-size: 20px;

    color: black;

    pointer-events: none;
}

</style>

</head>

<body>

<canvas
    id="stage"
    width="480"
    height="360"
></canvas>

<div id="loading">
    Loading...
</div>

<script
    id="battledisk-build"
    type="application/json"
>
${buildJSON}
</script>

<script>

"use strict";

// --------------------------------------------------
// Battledisk Runtime
// --------------------------------------------------

const BUILD =
    JSON.parse(
        document
            .getElementById(
                "battledisk-build"
            )
            .textContent
    );

const PROJECT =
    BUILD.project;

const ASSETS =
    BUILD.assets;

const canvas =
    document.getElementById(
        "stage"
    );

const ctx =
    canvas.getContext("2d");

const loading =
    document.getElementById(
        "loading"
    );

// --------------------------------------------------
// Scratch coordinate system
// --------------------------------------------------

const SCRATCH_WIDTH = 480;
const SCRATCH_HEIGHT = 360;

// --------------------------------------------------
// Fullscreen canvas
// --------------------------------------------------

function resizeCanvas() {

    const width =
        window.innerWidth;

    const height =
        window.innerHeight;

    canvas.width = width;
    canvas.height = height;
}

// --------------------------------------------------
// Coordinate conversion
// --------------------------------------------------

function scratchX(x) {

    return (
        canvas.width / 2 +
        x *
        (canvas.width /
         SCRATCH_WIDTH)
    );
}

function scratchY(y) {

    return (
        canvas.height / 2 -
        y *
        (canvas.height /
         SCRATCH_HEIGHT)
    );
}

// --------------------------------------------------
// Stage
// --------------------------------------------------

function clearStage() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}

// --------------------------------------------------
// Runtime startup
// --------------------------------------------------

function startBattledisk() {

    resizeCanvas();

    clearStage();

    loading.style.display =
        "none";

    console.log(
        "Battledisk loaded:"
    );

    console.log(
        PROJECT
    );

    console.log(
        "Targets:",
        PROJECT.targets
            ? PROJECT.targets.length
            : 0
    );

    console.log(
        "Assets:",
        Object.keys(
            ASSETS
        ).length
    );
}

// --------------------------------------------------
// Resize
// --------------------------------------------------

window.addEventListener(
    "resize",
    () => {

        resizeCanvas();

        clearStage();

    }
);

// --------------------------------------------------
// Start
// --------------------------------------------------

startBattledisk();

</script>

</body>
</html>`;
}

// --------------------------------------------------
// Download HTML
// --------------------------------------------------

function downloadHTML() {

    if (!currentProject) {

        setStatus(
            "Load an .sb3 project first."
        );

        return;
    }

    try {

        setStatus(
            "Building HTML..."
        );

        const html =
            generateHTML();

        const projectName =
            getProjectName(
                currentProject,
                currentFileName ||
                "Battledisk Project"
            );

        const safeName =
            projectName
                .replace(
                    /[<>:"/\\\\|?*]/g,
                    "_"
                )
                .trim() ||
            "Battledisk_Project";

        const blob =
            new Blob(
                [html],
                {
                    type:
                        "text/html;charset=utf-8"
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                "a"
            );

        link.href = url;

        link.download =
            safeName + ".html";

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        setTimeout(
            () => {
                URL.revokeObjectURL(
                    url
                );
            },
            1000
        );

        setStatus(
            "HTML build complete."
        );

    } catch (error) {

        console.error(error);

        setStatus(
            "Build failed: " +
            error.message
        );
    }
}

// --------------------------------------------------
// File input
// --------------------------------------------------

function setupFileInput() {

    const input =
        $("sb3Input") ||
        $("fileInput") ||
        $("projectInput");

    if (!input) {
        return;
    }

    input.addEventListener(
        "change",
        async event => {

            const file =
                event.target.files[0];

            if (!file) {
                return;
            }

            try {

                await loadSB3(
                    file
                );

            } catch (error) {

                console.error(
                    error
                );

                setStatus(
                    "Error: " +
                    error.message
                );
            }
        }
    );
}

// --------------------------------------------------
// Package button
// --------------------------------------------------

function setupPackageButton() {

    const button =
        $("packageButton") ||
        $("package") ||
        $("compileButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        downloadHTML
    );
}

// --------------------------------------------------
// Drag and drop
// --------------------------------------------------

function setupDragAndDrop() {

    const dropZone =
        $("dropZone");

    if (!dropZone) {
        return;
    }

    dropZone.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );
        }
    );

    dropZone.addEventListener(
        "dragleave",
        () => {

            dropZone.classList.remove(
                "dragging"
            );
        }
    );

    dropZone.addEventListener(
        "drop",
        async event => {

            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );

            const file =
                event
                    .dataTransfer
                    .files[0];

            if (!file) {
                return;
            }

            try {

                await loadSB3(
                    file
                );

            } catch (error) {

                console.error(
                    error
                );

                setStatus(
                    "Error: " +
                    error.message
                );
            }
        }
    );
}

// --------------------------------------------------
// Initialize
// --------------------------------------------------

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupFileInput();

        setupPackageButton();

        setupDragAndDrop();

        setStatus(
            "Waiting for .sb3 project..."
        );
    }
);
