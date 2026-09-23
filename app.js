"use strict";

// ============================================================
// BATTLEDISK PACKAGER
// Scratch .sb3 -> standalone Battledisk HTML
// Runtime: Battledisk 0.3.0
// ============================================================

let currentProject = null;
let currentAssets = {};
let currentFileName = null;

// ============================================================
// BASIC HELPERS
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
// PROJECT INFORMATION
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
// LOAD SB3
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
// GENERATED HTML
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
        version: "0.3.0",
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
    position: absolute;

    left: 0;
    top: 0;

    width: 100vw;
    height: 100vh;

    display: block;

    background: #fff;
}

#loading {
    position: absolute;

    left: 50%;
    top: 50%;

    transform:
        translate(-50%, -50%);

    font-family: Arial, sans-serif;

    font-size: 20px;

    color: #000;

    pointer-events: none;
}

#speech {
    position: absolute;

    display: none;

    padding: 8px 12px;

    background: white;

    border: 2px solid black;

    border-radius: 12px;

    font-family: Arial, sans-serif;

    font-size: 16px;

    color: black;

    pointer-events: none;

    max-width: 300px;

    z-index: 20;
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

<div id="speech"></div>

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

const speech =
    document.getElementById(
        "speech"
    );

// ============================================================
// STAGE
// ============================================================

const SCRATCH_WIDTH = 480;
const SCRATCH_HEIGHT = 360;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

// ============================================================
// RUNTIME STATE
// ============================================================

const runtime = {

    targets: [],

    broadcasts: new Map(),

    runningThreads: [],

    stopped: false,

    mouseX: 0,

    mouseY: 0,

    mouseDown: false,

    keys: new Set(),

    penCanvas:
        document.createElement(
            "canvas"
        ),

    penCtx: null

};

runtime.penCtx =
    runtime.penCanvas.getContext(
        "2d"
    );

// ============================================================
// CANVAS
// ============================================================

function resizeCanvas() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;

    runtime.penCanvas.width =
        canvas.width;

    runtime.penCanvas.height =
        canvas.height;

    calculateScale();
}

function calculateScale() {

    const scaleX =
        canvas.width /
        SCRATCH_WIDTH;

    const scaleY =
        canvas.height /
        SCRATCH_HEIGHT;

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
        (
            Number(x) +
            SCRATCH_WIDTH / 2
        ) * scale
    );
}

function toCanvasY(y) {

    return (
        offsetY +
        (
            SCRATCH_HEIGHT / 2 -
            Number(y)
        ) * scale
    );
}

function toScratchX(x) {

    return (
        (x - offsetX) /
        scale -
        SCRATCH_WIDTH / 2
    );
}

function toScratchY(y) {

    return (
        SCRATCH_HEIGHT / 2 -
        (y - offsetY) /
        scale
    );
}

// ============================================================
// ASSETS
// ============================================================

function findAsset(md5ext) {

    if (!md5ext) {
        return null;
    }

    if (ASSETS[md5ext]) {
        return ASSETS[md5ext];
    }

    const base =
        md5ext.split(".")[0];

    for (
        const filename
        of Object.keys(ASSETS)
    ) {

        if (
            filename.split(".")[0] ===
            base
        ) {
            return ASSETS[filename];
        }
    }

    return null;
}

function loadImage(src) {

    return new Promise(
        (resolve, reject) => {

            const image =
                new Image();

            image.onload = () =>
                resolve(image);

            image.onerror = () =>
                reject(
                    new Error(
                        "Image failed to load."
                    )
                );

            image.src = src;
        }
    );
}

// ============================================================
// TARGET RUNTIME OBJECT
// ============================================================

function createTargetRuntime(target) {

    const variables = {};

    if (target.variables) {

        for (
            const id
            of Object.keys(
                target.variables
            )
        ) {

            const entry =
                target.variables[id];

            variables[entry[0]] =
                entry[1];
        }
    }

    const lists = {};

    if (target.lists) {

        for (
            const id
            of Object.keys(
                target.lists
            )
        ) {

            const entry =
                target.lists[id];

            lists[entry[0]] =
                Array.isArray(entry[1])
                    ? [...entry[1]]
                    : [];
        }
    }

    return {

        target,

        name:
            target.name || "Sprite",

        x:
            Number(target.x) || 0,

        y:
            Number(target.y) || 0,

        direction:
            Number(target.direction) || 90,

        size:
            Number(target.size) || 100,

        visible:
            target.visible !== false,

        variables,

        lists,

        currentCostume:
            Number(target.currentCostume) || 0,

        penDown: false,

        penColor: "#000000",

        penSize: 1,

        sayText: "",

        sayTimer: null

    };
}

// ============================================================
// TARGET LOOKUP
// ============================================================

function findTarget(name) {

    return runtime.targets.find(
        target =>
            target.name === name
    );
}

// ============================================================
// BLOCK ACCESS
// ============================================================

function getBlock(id) {

    if (!id) {
        return null;
    }

    for (
        const target
        of PROJECT.targets
    ) {

        if (
            target.blocks &&
            target.blocks[id]
        ) {
            return {
                block:
                    target.blocks[id],

                target
            };
        }
    }

    return null;
}

function getBlockForTarget(
    targetRuntime,
    id
) {

    if (
        !targetRuntime ||
        !targetRuntime.target ||
        !targetRuntime.target.blocks
    ) {
        return null;
    }

    return targetRuntime
        .target
        .blocks[id] || null;
}

// ============================================================
// INPUT / VALUE EVALUATION
// ============================================================

function unwrapInput(input) {

    if (!Array.isArray(input)) {
        return input;
    }

    if (input.length === 0) {
        return "";
    }

    // Scratch primitive.
    if (
        input.length >= 2 &&
        (
            typeof input[0] === "number" ||
            typeof input[0] === "string"
        )
    ) {
        return input[1];
    }

    return input[0];
}

function getInput(
    block,
    index,
    targetRuntime
) {

    if (
        !block ||
        !block.inputs
    ) {
        return "";
    }

    const input =
        block.inputs[index];

    return evaluateInput(
        input,
        targetRuntime
    );
}

function evaluateInput(
    input,
    targetRuntime
) {

    if (input === null ||
        input === undefined) {
        return "";
    }

    if (
        typeof input ===
        "string"
    ) {

        const block =
            getBlockForTarget(
                targetRuntime,
                input
            );

        if (block) {
            return evaluateReporter(
                block,
                targetRuntime
            );
        }

        return input;
    }

    if (
        typeof input ===
        "number"
    ) {
        return input;
    }

    if (
        Array.isArray(input)
    ) {

        if (
            input.length >= 2 &&
            typeof input[0] ===
            "number"
        ) {

            return input[1];
        }

        if (
            input.length >= 2 &&
            typeof input[0] ===
            "string" &&
            (
                input[0] === "shadow" ||
                input[0] === "text"
            )
        ) {

            return input[1];
        }

        if (
            input.length === 1
        ) {

            return evaluateInput(
                input[0],
                targetRuntime
            );
        }

        const possibleBlock =
            input.find(
                item =>
                    typeof item ===
                    "string" &&
                    getBlockForTarget(
                        targetRuntime,
                        item
                    )
            );

        if (possibleBlock) {

            return evaluateReporter(
                getBlockForTarget(
                    targetRuntime,
                    possibleBlock
                ),
                targetRuntime
            );
        }

        return input[
            input.length - 1
        ];
    }

    return input;
}

function numberValue(value) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : 0;
}

function booleanValue(value) {

    if (
        value === true ||
        value === false
    ) {
        return value;
    }

    if (
        value === 0 ||
        value === "" ||
        value === null ||
        value === undefined
    ) {
        return false;
    }

    return true;
}

// ============================================================
// VARIABLES
// ============================================================

function getVariable(
    targetRuntime,
    name
) {

    if (
        targetRuntime.variables &&
        Object.prototype.hasOwnProperty.call(
            targetRuntime.variables,
            name
        )
    ) {
        return targetRuntime.variables[name];
    }

    const stage =
        runtime.targets.find(
            target =>
                target.target.isStage
        );

    if (
        stage &&
        stage.variables &&
        Object.prototype.hasOwnProperty.call(
            stage.variables,
            name
        )
    ) {
        return stage.variables[name];
    }

    return 0;
}

function setVariable(
    targetRuntime,
    name,
    value
) {

    if (
        targetRuntime.variables &&
        Object.prototype.hasOwnProperty.call(
            targetRuntime.variables,
            name
        )
    ) {

        targetRuntime.variables[name] =
            value;

        return;
    }

    const stage =
        runtime.targets.find(
            target =>
                target.target.isStage
        );

    if (
        stage &&
        Object.prototype.hasOwnProperty.call(
            stage.variables,
            name
        )
    ) {

        stage.variables[name] =
            value;

        return;
    }

    targetRuntime.variables[name] =
        value;
}

// ============================================================
// LISTS
// ============================================================

function getList(
    targetRuntime,
    name
) {

    if (
        targetRuntime.lists &&
        targetRuntime.lists[name]
    ) {
        return targetRuntime.lists[name];
    }

    const stage =
        runtime.targets.find(
            target =>
                target.target.isStage
        );

    if (
        stage &&
        stage.lists &&
        stage.lists[name]
    ) {
        return stage.lists[name];
    }

    return [];
}

function ensureList(
    targetRuntime,
    name
) {

    if (
        !targetRuntime.lists[name]
    ) {
        targetRuntime.lists[name] = [];
    }

    return targetRuntime.lists[name];
}

// ============================================================
// REPORTER BLOCKS
// ============================================================

function evaluateReporter(
    block,
    targetRuntime
) {

    if (!block) {
        return "";
    }

    const opcode =
        block.opcode;

    switch (opcode) {

        case "data_variable": {

            const name =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            return getVariable(
                targetRuntime,
                String(name)
            );
        }

        case "data_itemoflist": {

            const listName =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const indexValue =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            const list =
                getList(
                    targetRuntime,
                    String(listName)
                );

            const index =
                Math.floor(
                    numberValue(
                        indexValue
                    )
                );

            if (
                index >= 1 &&
                index <= list.length
            ) {
                return list[index - 1];
            }

            return "";
        }

        case "data_lengthoflist": {

            const listName =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            return getList(
                targetRuntime,
                String(listName)
            ).length;
        }

        case "data_listcontainsitem": {

            const listName =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const item =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            return getList(
                targetRuntime,
                String(listName)
            ).includes(item);
        }

        case "operator_add": {

            return (
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) +
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_subtract": {

            return (
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) -
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_multiply": {

            return (
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) *
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_divide": {

            const a =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            const b =
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                );

            return b === 0
                ? 0
                : a / b;
        }

        case "operator_equals": {

            return String(
                getInput(
                    block,
                    0,
                    targetRuntime
                )
            ) === String(
                getInput(
                    block,
                    1,
                    targetRuntime
                )
            );
        }

        case "operator_gt": {

            return (
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) >
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_lt": {

            return (
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) <
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_join": {

            return (
                String(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) +
                String(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_not": {

            return !booleanValue(
                getInput(
                    block,
                    0,
                    targetRuntime
                )
            );
        }

        case "operator_and": {

            return (
                booleanValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) &&
                booleanValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "operator_or": {

            return (
                booleanValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                ) ||
                booleanValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                )
            );
        }

        case "motion_xposition":
            return targetRuntime.x;

        case "motion_yposition":
            return targetRuntime.y;

        case "motion_direction":
            return targetRuntime.direction;

        case "looks_size":
            return targetRuntime.size;

        case "sensing_answer":
            return window.__battlediskAnswer || "";

        case "sensing_mousedown":
            return runtime.mouseDown;

        case "sensing_mousex":
            return runtime.mouseX;

        case "sensing_mousey":
            return runtime.mouseY;

        case "control_create_clone_of":
            return "";

        default:

            console.warn(
                "Unsupported reporter:",
                opcode
            );

            return "";
    }
}

// ============================================================
// SCRIPT EXECUTION
// ============================================================

async function executeScript(
    targetRuntime,
    firstBlockId
) {

    let currentId =
        firstBlockId;

    let safety =
        0;

    while (
        currentId &&
        safety < 100000 &&
        !runtime.stopped
    ) {

        safety++;

        const block =
            getBlockForTarget(
                targetRuntime,
                currentId
            );

        if (!block) {
            break;
        }

        await executeBlock(
            targetRuntime,
            block
        );

        currentId =
            block.next || null;
    }

    if (safety >= 100000) {

        console.error(
            "Script safety limit reached."
        );
    }
}

// ============================================================
// BLOCK EXECUTION
// ============================================================

async function executeBlock(
    targetRuntime,
    block
) {

    if (!block) {
        return;
    }

    const opcode =
        block.opcode;

    switch (opcode) {

        // ----------------------------------------------------
        // VARIABLES
        // ----------------------------------------------------

        case "data_setvariableto": {

            const name =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const value =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            setVariable(
                targetRuntime,
                String(name),
                value
            );

            break;
        }

        case "data_changevariableby": {

            const name =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const amount =
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                );

            const oldValue =
                numberValue(
                    getVariable(
                        targetRuntime,
                        String(name)
                    )
                );

            setVariable(
                targetRuntime,
                String(name),
                oldValue + amount
            );

            break;
        }

        // ----------------------------------------------------
        // LISTS
        // ----------------------------------------------------

        case "data_deletealloflist": {

            const name =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const list =
                ensureList(
                    targetRuntime,
                    String(name)
                );

            list.length = 0;

            break;
        }

        case "data_addtolist": {

            const value =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const name =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            ensureList(
                targetRuntime,
                String(name)
            ).push(value);

            break;
        }

        case "data_deleteoflist": {

            const index =
                Math.floor(
                    numberValue(
                        getInput(
                            block,
                            0,
                            targetRuntime
                        )
                    )
                );

            const name =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            const list =
                ensureList(
                    targetRuntime,
                    String(name)
                );

            if (
                index >= 1 &&
                index <= list.length
            ) {
                list.splice(
                    index - 1,
                    1
                );
            }

            break;
        }

        case "data_replaceitemoflist": {

            const index =
                Math.floor(
                    numberValue(
                        getInput(
                            block,
                            0,
                            targetRuntime
                        )
                    )
                );

            const name =
                getInput(
                    block,
                    1,
                    targetRuntime
                );

            const value =
                getInput(
                    block,
                    2,
                    targetRuntime
                );

            const list =
                ensureList(
                    targetRuntime,
                    String(name)
                );

            if (
                index >= 1 &&
                index <= list.length
            ) {
                list[index - 1] =
                    value;
            }

            break;
        }

        // ----------------------------------------------------
        // MOTION
        // ----------------------------------------------------

        case "motion_movesteps": {

            const steps =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            const radians =
                (
                    90 -
                    targetRuntime.direction
                ) *
                Math.PI /
                180;

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                targetRuntime.x +
                    Math.cos(radians) *
                    steps,
                targetRuntime.y +
                    Math.sin(radians) *
                    steps
            );

            targetRuntime.x +=
                Math.cos(radians) *
                steps;

            targetRuntime.y +=
                Math.sin(radians) *
                steps;

            break;
        }

        case "motion_turnright": {

            targetRuntime.direction +=
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            break;
        }

        case "motion_turnleft": {

            targetRuntime.direction -=
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            break;
        }

        case "motion_pointindirection": {

            targetRuntime.direction =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            break;
        }

        case "motion_changexby": {

            const amount =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                targetRuntime.x + amount,
                targetRuntime.y
            );

            targetRuntime.x +=
                amount;

            break;
        }

        case "motion_setx": {

            const x =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                x,
                targetRuntime.y
            );

            targetRuntime.x =
                x;

            break;
        }

        case "motion_changeyby": {

            const amount =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                targetRuntime.x,
                targetRuntime.y + amount
            );

            targetRuntime.y +=
                amount;

            break;
        }

        case "motion_sety": {

            const y =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                targetRuntime.x,
                y
            );

            targetRuntime.y =
                y;

            break;
        }

        case "motion_gotoxy": {

            const x =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            const y =
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                );

            drawPenLineIfNeeded(
                targetRuntime,
                targetRuntime.x,
                targetRuntime.y,
                x,
                y
            );

            targetRuntime.x = x;
            targetRuntime.y = y;

            break;
        }

        case "motion_xposition":
        case "motion_yposition":
        case "motion_direction":
            break;

        // ----------------------------------------------------
        // LOOKS
        // ----------------------------------------------------

        case "looks_show":

            targetRuntime.visible =
                true;

            break;

        case "looks_hide":

            targetRuntime.visible =
                false;

            break;

        case "looks_gotofrontback":

            break;

        case "looks_changeeffectby":
            break;

        case "looks_seteffectto":
            break;

        case "looks_changesizeby": {

            targetRuntime.size +=
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            break;
        }

        case "looks_setsizeto": {

            targetRuntime.size =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            break;
        }

        case "looks_say": {

            const message =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            showSpeech(
                targetRuntime,
                String(message)
            );

            break;
        }

        case "looks_sayforsecs": {

            const message =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const seconds =
                numberValue(
                    getInput(
                        block,
                        1,
                        targetRuntime
                    )
                );

            showSpeech(
                targetRuntime,
                String(message)
            );

            await sleep(
                Math.max(
                    0,
                    seconds
                ) * 1000
            );

            hideSpeech();

            break;
        }

        // ----------------------------------------------------
        // CONTROL
        // ----------------------------------------------------

        case "control_wait": {

            const seconds =
                numberValue(
                    getInput(
                        block,
                        0,
                        targetRuntime
                    )
                );

            await sleep(
                Math.max(
                    0,
                    seconds
                ) * 1000
            );

            break;
        }

        case "control_repeat": {

            const times =
                Math.max(
                    0,
                    Math.floor(
                        numberValue(
                            getInput(
                                block,
                                0,
                                targetRuntime
                            )
                        )
                    )
                );

            const substack =
                getSubstack(
                    block,
                    1
                );

            for (
                let i = 0;
                i < times &&
                !runtime.stopped;
                i++
            ) {

                if (substack) {

                    await executeScript(
                        targetRuntime,
                        substack
                    );
                }
            }

            break;
        }

        case "control_forever": {

            const substack =
                getSubstack(
                    block,
                    0
                );

            if (!substack) {
                break;
            }

            while (
                !runtime.stopped
            ) {

                await executeScript(
                    targetRuntime,
                    substack
                );

                await sleep(0);
            }

            break;
        }

        case "control_if": {

            const condition =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            if (
                booleanValue(
                    condition
                )
            ) {

                const substack =
                    getSubstack(
                        block,
                        1
                    );

                if (substack) {

                    await executeScript(
                        targetRuntime,
                        substack
                    );
                }
            }

            break;
        }

        case "control_if_else": {

            const condition =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            const substack =
                booleanValue(
                    condition
                )
                    ? getSubstack(
                        block,
                        1
                    )
                    : getSubstack(
                        block,
                        2
                    );

            if (substack) {

                await executeScript(
                    targetRuntime,
                    substack
                );
            }

            break;
        }

        case "control_stop": {

            runtime.stopped =
                true;

            break;
        }

        // ----------------------------------------------------
        // EVENTS
        // ----------------------------------------------------

        case "event_broadcast": {

            const message =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            await broadcast(
                String(message)
            );

            break;
        }

        case "event_broadcastandwait": {

            const message =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            await broadcast(
                String(message)
            );

            break;
        }

        // ----------------------------------------------------
        // PEN
        // ----------------------------------------------------

        case "pen_clear": {

            clearPen();

            break;
        }

        case "pen_penDown": {

            targetRuntime.penDown =
                true;

            break;
        }

        case "pen_penUp": {

            targetRuntime.penDown =
                false;

            break;
        }

        case "pen_setPenColorToColor": {

            const color =
                getInput(
                    block,
                    0,
                    targetRuntime
                );

            targetRuntime.penColor =
                String(color);

            break;
        }

        case "pen_setPenSizeTo": {

            targetRuntime.penSize =
                Math.max(
                    1,
                    numberValue(
                        getInput(
                            block,
                            0,
                            targetRuntime
                        )
                    )
                );

            break;
        }

        case "pen_changePenSizeBy": {

            targetRuntime.penSize =
                Math.max(
                    1,
                    targetRuntime.penSize +
                    numberValue(
                        getInput(
                            block,
                            0,
                            targetRuntime
                        )
                    )
                );

            break;
        }

        case "pen_stamp":

            break;

        // ----------------------------------------------------
        // DEFAULT
        // ----------------------------------------------------

        default:

            console.warn(
                "Unsupported block:",
                opcode
            );

            break;
    }

    await renderProject();
}

// ============================================================
// SUBSTACKS
// ============================================================

function getSubstack(
    block,
    index
) {

    if (
        !block ||
        !block.inputs
    ) {
        return null;
    }

    const input =
        block.inputs[index];

    if (
        typeof input ===
        "string"
    ) {
        return input;
    }

    if (
        Array.isArray(input)
    ) {

        for (
            const value
            of input
        ) {

            if (
                typeof value ===
                "string"
            ) {

                return value;
            }
        }
    }

    return null;
}

// ============================================================
// THREAD STARTERS
// ============================================================

function getHatBlocks() {

    const hats = [];

    for (
        const targetRuntime
        of runtime.targets
    ) {

        const blocks =
            targetRuntime.target.blocks;

        if (!blocks) {
            continue;
        }

        for (
            const id
            of Object.keys(blocks)
        ) {

            const block =
                blocks[id];

            if (
                block.opcode ===
                "event_whenflagclicked"
            ) {

                hats.push({
                    target:
                        targetRuntime,

                    id
                });
            }
        }
    }

    return hats;
}

// ============================================================
// BROADCASTS
// ============================================================

async function broadcast(message) {

    const jobs = [];

    for (
        const targetRuntime
        of runtime.targets
    ) {

        const blocks =
            targetRuntime.target.blocks;

        if (!blocks) {
            continue;
        }

        for (
            const id
            of Object.keys(blocks)
        ) {

            const block =
                blocks[id];

            if (
                block.opcode ===
                "event_whenbroadcastreceived"
            ) {

                const received =
                    getInput(
                        block,
                        0,
                        targetRuntime
                    );

                if (
                    String(received) ===
                    String(message)
                ) {

                    jobs.push(
                        executeScript(
                            targetRuntime,
                            block.next
                        )
                    );
                }
            }
        }
    }

    await Promise.all(
        jobs
    );
}

// ============================================================
// PEN
// ============================================================

function clearPen() {

    runtime.penCtx.clearRect(
        0,
        0,
        runtime.penCanvas.width,
        runtime.penCanvas.height
    );
}

function drawPenLineIfNeeded(
    targetRuntime,
    oldX,
    oldY,
    newX,
    newY
) {

    if (!targetRuntime.penDown) {
        return;
    }

    const pen =
        runtime.penCtx;

    pen.save();

    pen.strokeStyle =
        targetRuntime.penColor;

    pen.lineWidth =
        targetRuntime.penSize *
        scale;

    pen.lineCap =
        "round";

    pen.beginPath();

    pen.moveTo(
        toCanvasX(oldX),
        toCanvasY(oldY)
    );

    pen.lineTo(
        toCanvasX(newX),
        toCanvasY(newY)
    );

    pen.stroke();

    pen.restore();
}

// ============================================================
// SPEECH
// ============================================================

function showSpeech(
    targetRuntime,
    message
) {

    targetRuntime.sayText =
        message;

    speech.textContent =
        message;

    speech.style.display =
        message
            ? "block"
            : "none";

    const x =
        toCanvasX(
            targetRuntime.x
        );

    const y =
        toCanvasY(
            targetRuntime.y
        );

    speech.style.left =
        Math.min(
            window.innerWidth - 320,
            Math.max(
                10,
                x + 20
            )
        ) + "px";

    speech.style.top =
        Math.max(
            10,
            y - 80
        ) + "px";
}

function hideSpeech() {

    speech.style.display =
        "none";
}

// ============================================================
// SLEEP
// ============================================================

function sleep(milliseconds) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}

// ============================================================
// BACKDROP
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
        return;
    }

    try {

        const image =
            await loadImage(
                src
            );

        const resolution =
            Number(
                costume.bitmapResolution
            ) || 1;

        const width =
            image.width /
            resolution;

        const height =
            image.height /
            resolution;

        ctx.save();

        ctx.translate(
            offsetX +
            SCRATCH_WIDTH *
            scale /
            2,

            offsetY +
            SCRATCH_HEIGHT *
            scale /
            2
        );

        ctx.drawImage(
            image,

            -width *
            scale /
            2,

            -height *
            scale /
            2,

            width *
            scale,

            height *
            scale
        );

        ctx.restore();

    } catch (error) {

        console.error(
            "Backdrop error:",
            error
        );
    }
}

// ============================================================
// SPRITES
// ============================================================

async function drawSprite(
    targetRuntime
) {

    if (
        !targetRuntime.visible
    ) {
        return;
    }

    const target =
        targetRuntime.target;

    const costumes =
        target.costumes || [];

    if (!costumes.length) {
        return;
    }

    let costumeIndex =
        Number(
            targetRuntime.currentCostume
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
        return;
    }

    try {

        const image =
            await loadImage(
                src
            );

        const resolution =
            Number(
                costume.bitmapResolution
            ) || 1;

        const width =
            image.width /
            resolution;

        const height =
            image.height /
            resolution;

        const size =
            targetRuntime.size /
            100;

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
                : width / 2;

        const centerY =
            Number.isFinite(
                rotationCenterY
            )
                ? rotationCenterY
                : height / 2;

        ctx.save();

        ctx.translate(
            toCanvasX(
                targetRuntime.x
            ),
            toCanvasY(
                targetRuntime.y
            )
        );

        const radians =
            (
                90 -
                targetRuntime.direction
            ) *
            Math.PI /
            180;

        ctx.rotate(
            radians
        );

        ctx.drawImage(
            image,

            -centerX *
            size *
            scale,

            -centerY *
            size *
            scale,

            width *
            size *
            scale,

            height *
            size *
            scale
        );

        ctx.restore();

    } catch (error) {

        console.error(
            "Sprite rendering error:",
            targetRuntime.name,
            error
        );
    }
}

// ============================================================
// RENDER
// ============================================================

async function renderProject() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle =
        "#000";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    await drawBackdrop();

    // Pen goes underneath sprites.
    ctx.drawImage(
        runtime.penCanvas,
        0,
        0
    );

    // Scratch renders sprites according
    // to their layer order.
    for (
        const targetRuntime
        of runtime.targets
    ) {

        if (
            targetRuntime.target.isStage
        ) {
            continue;
        }

        await drawSprite(
            targetRuntime
        );
    }
}

// ============================================================
// GREEN FLAG
// ============================================================

async function startGreenFlag() {

    console.log(
        "GREEN FLAG"
    );

    runtime.stopped =
        false;

    clearPen();

    hideSpeech();

    const hats =
        getHatBlocks();

    console.log(
        "Green flag scripts:",
        hats.length
    );

    const jobs = [];

    for (
        const hat
        of hats
    ) {

        const block =
            getBlockForTarget(
                hat.target,
                hat.id
            );

        if (
            block &&
            block.next
        ) {

            jobs.push(
                executeScript(
                    hat.target,
                    block.next
                )
            );
        }
    }

    await Promise.all(
        jobs
    );

    await renderProject();
}

// ============================================================
// MOUSE / KEYBOARD
// ============================================================

window.addEventListener(
    "mousemove",
    event => {

        runtime.mouseX =
            toScratchX(
                event.clientX
            );

        runtime.mouseY =
            toScratchY(
                event.clientY
            );
    }
);

window.addEventListener(
    "mousedown",
    () => {

        runtime.mouseDown =
            true;
    }
);

window.addEventListener(
    "mouseup",
    () => {

        runtime.mouseDown =
            false;
    }
);

window.addEventListener(
    "keydown",
    event => {

        runtime.keys.add(
            event.key
        );
    }
);

window.addEventListener(
    "keyup",
    event => {

        runtime.keys.delete(
            event.key
        );
    }
);

// ============================================================
// STARTUP
// ============================================================

async function startBattledisk() {

    console.log(
        "Battledisk runtime starting..."
    );

    runtime.targets = [];

    for (
        const target
        of PROJECT.targets
    ) {

        runtime.targets.push(
            createTargetRuntime(
                target
            )
        );
    }

    resizeCanvas();

    await renderProject();

    loading.style.display =
        "none";

    // Give the browser one frame to
    // finish rendering before starting
    // project scripts.
    await sleep(0);

    await startGreenFlag();
}

// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    async () => {

        resizeCanvas();

        await renderProject();
    }
);

// ============================================================
// GO
// ============================================================

startBattledisk().catch(
    error => {

        console.error(
            "BATTLEDISK RUNTIME ERROR:",
            error
        );

        loading.textContent =
            "Runtime error — check the browser console.";
    }
);

</script>

</body>
</html>`;
}

// ============================================================
// DOWNLOAD HTML
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
            "Building Battledisk HTML..."
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

        console.error(error);

        setStatus(
            "Build failed: " +
            error.message
        );
    }
}

// ============================================================
// FILE INPUT
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
// PACKAGE BUTTON
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
// DRAG & DROP
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
// INITIALIZE PACKAGER
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
