"use strict";

// ============================================================
// BATTLEDISK PACKAGER
// Scratch .sb3 -> standalone HTML
// ============================================================

let currentProject = null;
let currentAssets = {};
let currentFileName = null;

// ============================================================
// Helpers
// ============================================================

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
            Math.min(
                i + chunkSize,
                bytes.length
            )
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

// ============================================================
// Project information
// ============================================================

function getProjectName(project, fallback) {
    if (project.projectName) {
        return project.projectName;
    }

    if (project.name) {
        return project.name;
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

// ============================================================
// Load SB3
// ============================================================

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

    setStatus(
        "Opening Scratch project..."
    );

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

    setStatus(
        "Reading project.json..."
    );

    const projectText =
        await projectFile.async("text");

    let project;

    try {
        project =
            JSON.parse(projectText);
    } catch (error) {
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

    setStatus(
        "Extracting project assets..."
    );

    for (const entry of Object.values(zip.files)) {

        if (entry.dir) {
            continue;
        }

        if (entry.name === "project.json") {
            continue;
        }

        try {

            const assetBuffer =
                await entry.async(
                    "arraybuffer"
                );

            currentAssets[entry.name] =
                makeDataURL(
                    entry.name,
                    assetBuffer
                );

        } catch (error) {

            console.warn(
                "Could not extract asset:",
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
        )} — ready to package.`
    );
}

// ============================================================
// UI
// ============================================================

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
        countTargets(
            currentProject
        );

    const assets =
        Object.keys(
            currentAssets
        ).length;

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

// ============================================================
// Generate HTML
// ============================================================

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
        version: "0.2.0",

        project:
            currentProject,

        assets:
            currentAssets
    };

    const buildJSON =
        safeJSONStringify(
            build
        );

    const title =
        escapeHTML(
            projectName
        );

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

    position: absolute;

    left: 0;
    top: 0;

    width: 100vw;
    height: 100vh;

    display: block;

    background: white;

}

#loading {

    position: absolute;

    left: 50%;
    top: 50%;

    transform:
        translate(-50%, -50%);

    font-family:
        Arial, sans-serif;

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
    Loading Battledisk...
</div>

<script
    id="battledisk-build"
    type="application/json"
>
${buildJSON}
</script>

<script>

"use strict";

// ============================================================
// BATTLEDISK RUNTIME
// ============================================================

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
    canvas.getContext(
        "2d"
    );

const loading =
    document.getElementById(
        "loading"
    );

// ============================================================
// Scratch stage
// ============================================================

const SCRATCH_WIDTH = 480;
const SCRATCH_HEIGHT = 360;

let scale = 1;

let offsetX = 0;
let offsetY = 0;

// ============================================================
// Canvas resizing
// ============================================================

function resizeCanvas() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;

    calculateScale();
}

// ============================================================
// Scratch -> browser coordinates
// ============================================================

function calculateScale() {

    const scaleX =
        canvas.width /
        SCRATCH_WIDTH;

    const scaleY =
        canvas.height /
        SCRATCH_HEIGHT;

    // Preserve Scratch's aspect ratio.
    scale =
        Math.min(
            scaleX,
            scaleY
        );

    offsetX =
        (
            canvas.width -
            SCRATCH_WIDTH * scale
        ) / 2;

    offsetY =
        (
            canvas.height -
            SCRATCH_HEIGHT * scale
        ) / 2;
}

function toCanvasX(x) {

    return (
        offsetX +
        (x +
        SCRATCH_WIDTH / 2) *
        scale
    );
}

function toCanvasY(y) {

    return (
        offsetY +
        (SCRATCH_HEIGHT / 2 -
        y) *
        scale
    );
}

// ============================================================
// Asset lookup
// ============================================================

function findAsset(md5ext) {

    if (!md5ext) {
        return null;
    }

    if (ASSETS[md5ext]) {
        return ASSETS[md5ext];
    }

    const baseName =
        md5ext.split(".")[0];

    for (
        const filename
        of Object.keys(ASSETS)
    ) {

        if (
            filename.split(".")[0] ===
            baseName
        ) {
            return ASSETS[filename];
        }
    }

    return null;
}

// ============================================================
// Load image
// ============================================================

function loadImage(src) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();

            image.onload = () => {
                resolve(image);
            };

            image.onerror = () => {
                reject(
                    new Error(
                        "Could not load image."
                    )
                );
            };

            image.src = src;
        }
    );
}

// ============================================================
// Draw stage backdrop
// ============================================================

async function drawBackdrop() {

    const stage =
        PROJECT.targets.find(
            target =>
                target.isStage
        );

    if (!stage) {
        return;
    }

    const costumes =
        stage.costumes || [];

    if (!costumes.length) {
        return;
    }

    let costumeIndex =
        Number(
            stage.currentCostume
        );

    if (
        !Number.isFinite(
            costumeIndex
        )
    ) {
        costumeIndex = 0;
    }

    costumeIndex =
        Math.max(
            0,
            Math.min(
                costumeIndex,
                costumes.length - 1
            )
        );

    const costume =
        costumes[
            costumeIndex
        ];

    const src =
        findAsset(
            costume.md5ext
        );

    if (!src) {

        console.warn(
            "Backdrop asset not found:",
            costume.md5ext
        );

        return;
    }

    try {

        const image =
            await loadImage(
                src
            );

        const width =
            costume.bitmapResolution
                ? image.width /
                  costume.bitmapResolution
                : image.width;

        const height =
            costume.bitmapResolution
                ? image.height /
                  costume.bitmapResolution
                : image.height;

        ctx.save();

        ctx.translate(
            offsetX +
            SCRATCH_WIDTH *
            scale / 2,

            offsetY +
            SCRATCH_HEIGHT *
            scale / 2
        );

        ctx.drawImage(
            image,

            -width *
            scale / 2,

            -height *
            scale / 2,

            width *
            scale,

            height *
            scale
        );

        ctx.restore();

    } catch (error) {

        console.error(
            "Backdrop failed:",
            error
        );
    }
}

// ============================================================
// Draw sprite
// ============================================================

async function drawSprite(target) {

    if (
        target.visible === false
    ) {
        return;
    }

    const costumes =
        target.costumes || [];

    if (!costumes.length) {
        return;
    }

    let costumeIndex =
        Number(
            target.currentCostume
        );

    if (
        !Number.isFinite(
            costumeIndex
        )
    ) {
        costumeIndex = 0;
    }

    costumeIndex =
        Math.max(
            0,
            Math.min(
                costumeIndex,
                costumes.length - 1
            )
        );

    const costume =
        costumes[
            costumeIndex
        ];

    const src =
        findAsset(
            costume.md5ext
        );

    if (!src) {

        console.warn(
            "Sprite asset not found:",
            target.name,
            costume.md5ext
        );

        return;
    }

    try {

        const image =
            await loadImage(
                src
            );

        let bitmapWidth =
            image.width;

        let bitmapHeight =
            image.height;

        if (
            costume.bitmapResolution
        ) {

            bitmapWidth /=
                costume.bitmapResolution;

            bitmapHeight /=
                costume.bitmapResolution;
        }

        const size =
            Number(
                target.size
            ) || 100;

        const spriteWidth =
            bitmapWidth *
            (size / 100) *
            scale;

        const spriteHeight =
            bitmapHeight *
            (size / 100) *
            scale;

        const x =
            Number(
                target.x
            ) || 0;

        const y =
            Number(
                target.y
            ) || 0;

        const rotationCenterX =
            Number(
                costume.rotationCenterX
            );

        const rotationCenterY =
            Number(
                costume.rotationCenterY
            );

        const centerX =
            Number.isFinite(
                rotationCenterX
            )
                ? rotationCenterX
                : bitmapWidth / 2;

        const centerY =
            Number.isFinite(
                rotationCenterY
            )
                ? rotationCenterY
                : bitmapHeight / 2;

        const direction =
            Number(
                target.direction
            );

        const angle =
            Number.isFinite(
                direction
            )
                ? direction
                : 90;

        ctx.save();

        ctx.translate(
            toCanvasX(x),
            toCanvasY(y)
        );

        // Scratch's default direction is 90°.
        // Convert it into a canvas rotation.
        const radians =
            (
                90 -
                angle
            ) *
            Math.PI /
            180;

        ctx.rotate(
            radians
        );

        ctx.drawImage(
            image,

            -centerX *
            (size / 100) *
            scale,

            -centerY *
            (size / 100) *
            scale,

            spriteWidth,

            spriteHeight
        );

        ctx.restore();

    } catch (error) {

        console.error(
            "Sprite failed:",
            target.name,
            error
        );
    }
}

// ============================================================
// Render project
// ============================================================

async function renderProject() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Black surrounding area.
    ctx.fillStyle =
        "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Draw backdrop.
    await drawBackdrop();

    // Draw sprites in Scratch layer order.
    const targets =
        PROJECT.targets || [];

    for (
        const target
        of targets
    ) {

        if (
            target.isStage
        ) {
            continue;
        }

        await drawSprite(
            target
        );
    }
}

// ============================================================
// Start
// ============================================================

async function startBattledisk() {

    console.log(
        "Battledisk runtime starting..."
    );

    console.log(
        "Project:",
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

    resizeCanvas();

    try {

        await renderProject();

        loading.style.display =
            "none";

    } catch (error) {

        console.error(
            "Runtime error:",
            error
        );

        loading.textContent =
            "Battledisk runtime error. " +
            "Check the browser console.";

    }
}

// ============================================================
// Resize
// ============================================================

window.addEventListener(
    "resize",
    async () => {

        resizeCanvas();

        await renderProject();

    }
);

// ============================================================
// Go!
// ============================================================

startBattledisk();

</script>

</body>
</html>`;
}

// ============================================================
// Download
// ============================================================

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
            safeName +
            ".html";

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

        console.error(
            error
        );

        setStatus(
            "Build failed: " +
            error.message
        );
    }
}

// ============================================================
// File input
// ============================================================

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

// ============================================================
// Package button
// ============================================================

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

// ============================================================
// Drag and drop
// ============================================================

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

// ============================================================
// Initialize
// ============================================================

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
