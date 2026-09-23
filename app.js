// Battledisk Packager
// app.js
//
// Scratch .sb3 -> standalone Battledisk HTML
//
// Requires JSZip to be loaded before this file:
// https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js

"use strict";

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
    const status =
        $("status") ||
        $("projectStatus") ||
        $("romStatus");

    if (status) {
        status.textContent = message;
    }

    console.log("[Battledisk Packager]", message);
}

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Safely place JSON inside a <script> tag.
function safeJSONStringify(value) {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

function getMimeType(filename) {
    const ext = filename
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

    return types[ext] || "application/octet-stream";
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);

    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(
            i,
            Math.min(i + chunkSize, bytes.length)
        );

        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function makeDataURL(filename, buffer) {
    const mime = getMimeType(filename);
    const base64 = arrayBufferToBase64(buffer);

    return `data:${mime};base64,${base64}`;
}

// --------------------------------------------------
// Project information
// --------------------------------------------------

function getProjectName(project, fallback) {
    // Some projects/exporters may include a projectName field.
    if (project.projectName) {
        return project.projectName;
    }

    if (project.name) {
        return project.name;
    }

    // Try to find the stage.
    if (Array.isArray(project.targets)) {
        const stage = project.targets.find(target => target.isStage);

        if (stage && stage.name && stage.name !== "Stage") {
            return stage.name;
        }
    }

    // Last resort: use the .sb3 filename.
    return fallback
        .replace(/\.sb3$/i, "");
}

function countTargets(project) {
    if (!Array.isArray(project.targets)) {
        return 0;
    }

    return project.targets.length;
}

// --------------------------------------------------
// Load .SB3
// --------------------------------------------------

async function loadSB3(file) {
    if (!file) {
        throw new Error("No .sb3 file was selected.");
    }

    if (!file.name.toLowerCase().endsWith(".sb3")) {
        throw new Error("That file is not an .sb3 project.");
    }

    setStatus("Opening .sb3...");

    if (typeof JSZip === "undefined") {
        throw new Error(
            "JSZip is not loaded. Make sure JSZip is included before app.js."
        );
    }

    const buffer = await file.arrayBuffer();

    const zip = await JSZip.loadAsync(buffer);

    setStatus("Reading project.json...");

    const projectEntry = zip.file("project.json");

    if (!projectEntry) {
        throw new Error(
            "This .sb3 file does not contain project.json."
        );
    }

    const projectText = await projectEntry.async("text");

    let project;

    try {
        project = JSON.parse(projectText);
    } catch (error) {
        throw new Error(
            "project.json could not be parsed as JSON."
        );
    }

    if (!project.targets || !Array.isArray(project.targets)) {
        throw new Error(
            "project.json does not appear to be a valid Scratch project."
        );
    }

    currentProject = project;
    currentFileName = file.name;
    currentAssets = {};

    setStatus("Extracting assets...");

    const entries = Object.values(zip.files);

    let assetCount = 0;

    for (const entry of entries) {
        if (entry.dir) {
            continue;
        }

        const filename = entry.name;

        // project.json is already stored separately.
        if (filename === "project.json") {
            continue;
        }

        try {
            const assetBuffer = await entry.async("arraybuffer");

            currentAssets[filename] = makeDataURL(
                filename,
                assetBuffer
            );

            assetCount++;
        } catch (error) {
            console.warn(
                "Could not extract asset:",
                filename,
                error
            );
        }
    }

    setStatus(
        `Loaded "${getProjectName(project, file.name)}" — ` +
        `${countTargets(project)} targets, ` +
        `${assetCount} assets.`
    );

    updateProjectInfo();

    return {
        project,
        assets: currentAssets
    };
}

// --------------------------------------------------
// UI
// --------------------------------------------------

function updateProjectInfo() {
    if (!currentProject) {
        return;
    }

    const name = getProjectName(
        currentProject,
        currentFileName || "Battledisk Project"
    );

    const targetCount = countTargets(currentProject);
    const assetCount = Object.keys(currentAssets).length;

    const projectNameElement =
        $("projectName") ||
        $("project");

    if (projectNameElement) {
        projectNameElement.textContent = name;
    }

    const projectStatusElement =
        $("projectStatus");

    if (projectStatusElement) {
        projectStatusElement.textContent =
            `${targetCount} targets • ${assetCount} assets`;
    }

    const projectInfo =
        $("projectInfo");

    if (projectInfo) {
        projectInfo.textContent =
            `Project: ${name}\n` +
            `Targets: ${targetCount}\n` +
            `Assets: ${assetCount}`;
    }
}

// --------------------------------------------------
// Generate HTML
// --------------------------------------------------

function generateHTML() {
    if (!currentProject) {
        throw new Error(
            "Load an .sb3 project before packaging it."
        );
    }

    const projectName = getProjectName(
        currentProject,
        currentFileName || "Battledisk Project"
    );

    const build = {
        format: "Battledisk HTML",
        version: "0.1.0",

        project: currentProject,

        assets: currentAssets
    };

    const buildJSON = safeJSONStringify(build);

    const title = escapeHTML(projectName);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${title} - Battledisk</title>

<style>
html,
body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #111;
}

body {
    font-family: Arial, sans-serif;
}

#stage {
    position: absolute;
    left: 50%;
    top: 50%;

    width: 480px;
    height: 360px;

    transform: translate(-50%, -50%);

    background: white;
}

#loading {
    position: absolute;
    left: 50%;
    top: 50%;

    transform: translate(-50%, -50%);

    color: white;
    font-size: 18px;

    pointer-events: none;
}
</style>
</head>

<body>

<canvas id="stage" width="480" height="360"></canvas>

<div id="loading">
    Loading Battledisk project...
</div>

<script id="battledisk-build" type="application/json">
${buildJSON}
</script>

<script>
"use strict";

/*
 * Battledisk Runtime
 *
 * This is the first runtime shell.
 * The actual Scratch/Battledisk block interpreter will be added
 * here as the packager develops.
 */

const BUILD = JSON.parse(
    document.getElementById("battledisk-build").textContent
);

const PROJECT = BUILD.project;
const ASSETS = BUILD.assets;

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const loading = document.getElementById("loading");

// --------------------------------------------------
// Basic project information
// --------------------------------------------------

console.log("Battledisk project loaded.");
console.log("Project:", PROJECT);
console.log("Assets:", Object.keys(ASSETS).length);

// --------------------------------------------------
// Scratch coordinate system
// --------------------------------------------------

const STAGE_WIDTH = 480;
const STAGE_HEIGHT = 360;

function scratchToCanvasX(x) {
    return x + STAGE_WIDTH / 2;
}

function scratchToCanvasY(y) {
    return STAGE_HEIGHT / 2 - y;
}

// --------------------------------------------------
// Basic stage
// --------------------------------------------------

function clearStage() {
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}

// --------------------------------------------------
// Runtime initialization
// --------------------------------------------------

function startBattledisk() {
    clearStage();

    loading.textContent =
        "Battledisk project loaded";

    console.log(
        "Targets:",
        PROJECT.targets
            ? PROJECT.targets.length
            : 0
    );

    /*
     * Runtime implementation will go here.
     *
     * Planned systems:
     *
     * - Sprites
     * - Costumes
     * - Sounds
     * - Variables
     * - Lists
     * - Broadcasts
     * - Motion
     * - Control
     * - Sensing
     * - Pen
     * - Battledisk sequencing
     */
}

startBattledisk();
</script>

</body>
</html>`;
}

// --------------------------------------------------
// Download generated HTML
// --------------------------------------------------

function downloadHTML() {
    if (!currentProject) {
        setStatus(
            "Load an .sb3 project first."
        );

        return;
    }

    setStatus("Generating HTML...");

    try {
        const html = generateHTML();

        const projectName = getProjectName(
            currentProject,
            currentFileName || "Battledisk Project"
        );

        const safeName = projectName
            .replace(/[<>:"/\\\\|?*]/g, "_")
            .trim() || "Battledisk_Project";

        const filename =
            `${safeName}.html`;

        const blob = new Blob(
            [html],
            {
                type: "text/html;charset=utf-8"
            }
        );

        const url =
            URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        setStatus(
            `Built ${filename}`
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
        console.warn(
            "No .sb3 file input found."
        );

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
                await loadSB3(file);
            } catch (error) {
                console.error(error);

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
        console.warn(
            "No package button found."
        );

        return;
    }

    button.addEventListener(
        "click",
        () => {
            downloadHTML();
        }
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

            const files =
                event.dataTransfer.files;

            if (!files || !files.length) {
                return;
            }

            const file = files[0];

            try {
                await loadSB3(file);
            } catch (error) {
                console.error(error);

                setStatus(
                    "Error: " +
                    error.message
                );
            }
        }
    );
}

// --------------------------------------------------
// Start
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
