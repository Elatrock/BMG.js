const fs = require('node:fs');
const sharp = require('sharp');

// All classes are defined here

class Tile {
    constructor(tile, assetFolder) {
        this.display = tile.display;
        this.name = "";
        this.code = "";
        this.type = "";
        this.variants = {};

        this.assetFolder = assetFolder;
        this.rawJSON = tile;
    }

    async initialize() {
        // Validate tile arguments
        if ((this.rawJSON.name === undefined) || (this.rawJSON.code === undefined) || (this.rawJSON.type === undefined) ) {
            throw new Error('!!ERROR: Invalid declaration for tile: missing one of the following arguments: name, code, type')
        }
        else {
            this.name = this.rawJSON.name;
            this.code = this.rawJSON.code;
            this.type = this.rawJSON.type;
        }

        // Define variants
        if (this.rawJSON.variants !== undefined) {
            for (const [key, value] of Object.entries(this.rawJSON.variants)) {
                this.variants[key] = value;

                if (this.variants[key].linkTiles !== undefined) {
                    if (this.variants[key].linkRules !== undefined) {
                        for (const [secondKey, secondValue] of Object.entries(this.variants[key].linkTiles)) {
                            this.variants[key].linkTiles[secondKey].buffer = await sharp(`${this.assetFolder}/${secondValue.asset}`).png().toBuffer()

                        console.log(`   Loaded linkTile asset for ${key}: ${secondKey}`);
                        }
                    }
                    else {
                        throw new Error('!!ERROR: Invalid declaration for linkTiles: missing linkRules')
                    }
                }
                else {
                    this.variants[key].buffer = await sharp(`${this.assetFolder}/${value['asset']}`).png().toBuffer()

                    console.log(`Loaded asset for ${key}`);
                }
            }
        }
        // else {
        //     throw new Error('!!ERROR: Invalid declaration for tile: must include at least one variant')
        // }

        return this
    }
}

class LinkRule {
    constructor(linkRule) {
        this.rules = [];
        this.defaults = {};
        this.multipleConditions = false;
        this.edgeCase = 0;

        this.rawJSON = linkRule;
    }

    async initialize() {
        // Validate linkRule arguments
        if (this.rawJSON.rules !== undefined && typeof this.rawJSON.rules === "object") {
            this.rules = this.rawJSON.rules;
        }
        else {
            throw new Error('!!ERROR: Invalid declaration for linkRule: missing rules')
        }

        // Define defaults
        if (this.rawJSON.defaults !== undefined) {
            if (this.rawJSON.defaults.linkTile !== undefined) {
                this.defaults = this.rawJSON.defaults;
            }
            else {
                throw new Error('!!ERROR: Invalid declaration for linkRule: missing default linkTile')
            }
        }
        else {
            throw new Error('!!ERROR: Invalid declaration for linkRule: missing defaults')
        }

        // Define multipleConditions
        if (this.rawJSON.multipleConditions !== undefined) {
            this.multipleConditions = this.rawJSON.multipleConditions;
        }

        // Define edgeCase
        if (this.rawJSON.edgeCase !== undefined) {
            this.edgeCase = this.rawJSON.edgeCase;
        }
        
        return this
    }

    async getRules() {

    }

    async getDefaults() {

    }

}

class DefaultEnvironment {
    constructor(environment, tiles) {
        this.name = "";
        this.background = {};
        this.defaults = {};
        this.overrideGamemode = {};

        this.rawJSON = environment;
        this.tiles = tiles;
    }

    async initialize() {
        // Validate defaultEnvironment arguments
        if ((this.rawJSON.name === undefined) || (this.rawJSON.background === undefined) || (this.rawJSON.defaults === undefined)) {
            throw new Error('!!ERROR: Invalid declaration for defaultEnvironment: missing one of the following arguments: name, background')
        }
        else {
            this.name = this.rawJSON.name;
            this.background = this.rawJSON.background;
            this.defaults = this.rawJSON.defaults;
        }

        // Define background colors
        if ((this.background.color1 === undefined) && (this.background.color2 === undefined)) {
            throw new Error('Invalid declaration for defaultEnvironment: missing the following arguments: color1, color2')
        }
        
        if (((this.background.color1.r === undefined) || (this.background.color1.g === undefined) || (this.background.color1.b === undefined)) ||
            ((this.background.color2.r === undefined) || (this.background.color2.g === undefined) || (this.background.color2.b === undefined))) {
            throw new Error('!!ERROR: Invalid declaration for defaultEnvironment: color1 must have r,g,b values')
        }

        // Define defaults
        if (this.defaults.tiles !== undefined) {
            for (const [key, value] of Object.entries(this.tiles)) {
                if (this.defaults.tiles[key] === undefined) {
                    throw new Error(`!!ERROR: Invalid declaration for defaultEnvironment: tile ${value.name} must be included in defaults`)
                }
                if (value.variants[this.defaults.tiles[value.name]] === undefined) {
                    throw new Error(`!!ERROR: Invalid declaration for defaultEnvironment: tile ${value.name} does not have variant ${this.defaults.tiles[value.name]}`)
                }
            }
        }

        return this
    }
}

class Environment extends DefaultEnvironment {
    constructor(defaultEnvironment, gamemode) {
        super();

        this.defaultEnvironment = defaultEnvironment;
        this.gamemode = gamemode;
    }

    async initialize() {

    }
}

class Gamemode {
    constructor(gamemode) {
        this.name = [];
        this.drawOver = [];
        this.drawEdit = [];
        this.defaults = {};

        this.rawJSON = gamemode;
    }

    async initialize() {

    }
}

class Map {
    constructor(

    ) {
        this.x = 1;
        this.y = 1;
    }

    getX() {
        // Get cursor X coordinate
        return this.x;
    }

    getY() {
        // Get cursor Y coordinate
        return this.y;
    }

    generate() {
        // Initialize map creation
    }

    floodFill() {
        // Algorithm to assign tags recursively to neighboring tiles of the same type
    }

    assignTags() {
        // Under-the-hood tile tags to change behavior of linkTiles
    }

    alterTiles() {
        /* Alter tiles based on gamemode or environment preferences, hierarchy goes down as follows:

            - replaceTiles
            - environment
                - gamemode
            - overrideEnvironment
            - specialTileRules
            - assetSwitchers
            - order
            - orderHor
        */
    }

    skipTiles() {
        // Skip tile rendering along with the background
    }

    replaceTiles() {
        // Replace tile encoding
    }

    assignEnvironmentTiles() {
        // Get environment tile variants. If not found, takes them from default environment
    }

    assignGamemodeTiles() {
        // Get gamemode tile variants by environment. If not found, takes them from gamemode defaults
    }

    overrideEnvironment() {
        // Change tile variants regardless of the preset-defined environment tiles
    }

    specialTileRules() {
        // Change tile variants if the condition is met
    }

    assetSwitcher() {
        // Switch tile with variants of any kind
    }

    drawBackground() {
        // Draw background of the map based on array size
    }
    
    drawOver() {
        // Draw tiles without altering the array code
    }

    drawEdit() {
        // Draw tiles altering the array code
    }

    checkOrder() {
        // Check the order of tiles in the Z coordinate and delay rendering depending in their value
    }

    checkOrderHor() {
        // Check the order of tiles in the Z coordinate for the row and delay rendering depending in their value
    }

    checkNeighborTiles() {
        // Check adjacent tiles based on XY coordinate
    }
}

/*

The Generator class creates the core instance of the program. This object reads all the information
from the given preset as well as the options file

If Generator is initialized with serverMode: false, the options file is ignored and the preset
information is taken as is

*/

class Generator {
    constructor(
        assetFolder,
        outputFolder,
        presetFile,
        optionsFile,
        ignoreOptions
    ) {
        this.assetFolder = assetFolder;
        this.outputFolder = outputFolder;
        this.presetFile = presetFile;
        this.optionsFile = optionsFile;

        this.optionsData = null;
        this.presetData = null;

        this.ignoreOptions = ignoreOptions;

        this.ignoreTiles = null;
        this.tiles = {};
        this.linkRules = {};
        this.defaultEnvironment = {};
        this.environments = [];
        this.gamemodes = [];

        this.initialize();
    }

    async initialize() {
        // Call this method to run the Generator
        console.log(
            `
BMG.js

Developed by: Elatrock
A faithful client and server side adaptation of the original program.

------
Initializing...
            `);

        // await this.readOptions();
        await this.readPreset();
        await this.readTiles();
        await this.readLinkRules();
        await this.readDefaultEnvironment();
    }

    // async readOptions() {
    //     // Read options data
    //     console.log('Loading options file...');

    //     if (!this.ignoreOptions && this.optionsFile === null) {
    //         throw new Error('!!ERROR: Include an options file to run BMG')
    //     }

    //     this.optionsData = JSON.parse(await fs.promises.readFile(this.optionsFile, {encoding: 'utf-8'}));

    //     if (this.optionsData === null) {
    //         throw new Error('!!ERROR: Failed to read options file')
    //     }
    //     else {
    //         console.log('Successfully loaded options file\n')
    //     }
    // }

    async readPreset() {
        // Read preset data and create objects accordingly
        console.log('Loading preset file...');

        this.presetData = JSON.parse(await fs.promises.readFile(this.presetFile, {encoding: 'utf-8'}));

        if (this.presetData === null) {
            throw new Error('!!ERROR: Failed to read preset file')
        }
        else {
            console.log('Successfully loaded preset file\n')
        }
    }

    async readTiles() {
        // Create Tile objects from preset
        console.log('Loading tiles...');
        
        let i = 0;
        let dateStart = new Date();

        for (const tile of this.presetData.tiles) {
            this.tiles[tile.name] = await new Tile(tile, this.assetFolder).initialize();
            i+=1;
        }

        let dateEnd = new Date();
        console.log(`\nSuccessfully loaded ${i} tiles in ${(dateEnd.getTime() - dateStart.getTime()) / 1000}s\n`);
    }

    async readLinkRules() {
        // Create LinkRule objects from preset
        console.log('Loading linkRules...');

        let i = 0;

        for (const [key, value] of Object.entries(this.presetData.linkRules)) {
            this.linkRules[key] = await new LinkRule(value).initialize();
            i+=1;
        }

        console.log(`Successfully loaded ${i} linkRules\n`);
    }

    async readDefaultEnvironment() {
        // Create DefaultEnvironment object from preset
        console.log('Loading defaultEnvironment');

        this.defaultEnvironment = await new DefaultEnvironment(this.presetData.defaultEnvironment, this.tiles).initialize();

        console.log(`Successfully loaded defaultEnvironment\n`);
    }

    async readEnvironments() {
        // Create Environment objects from preset
    }

    async readGamemodes() {
        // Create Gamemode objects from preset
    }
}

module.exports = {
    Generator: Generator
}