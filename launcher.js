// Launcher for BMG

// This program intends to port most of the features in the C# version of this tool,
// found in https://github.com/bloodwiing/BrawlMapGen. Credit goes to BLOODWIING
// for providing the logical structure of this tool

const { Generator } = require("./config.js");

const assetFolderPath  = `./assets/brawlstars`
const outputFolderPath = `./output`
const presetFilePath   = "./presets/brawlstars.json"
const optionsFilePath  = `./options.json`
const sizeMultiplier   = 100

const BMGBot = new Generator(
    assetFolderPath,
    outputFolderPath,
    presetFilePath,
    optionsFilePath,
    sizeMultiplier,
    false
);