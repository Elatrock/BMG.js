const fs = require('node:fs');
const sharp = require('sharp');

// All classes are defined here

class Tile {
    constructor(tile, assetFolder, sizeMultiplier) {
        this.display = tile.display;
        this.name = "";
        this.code = "";
        this.type = "";
        this.variants = {};

        this.assetFolder = assetFolder;
        this.sizeMultiplier = sizeMultiplier;
        this.rawJSON = tile;
    }

    async initialize() {
        // Validate tile arguments
        if ((this.rawJSON.name === undefined) || (this.rawJSON.code === undefined) || (this.rawJSON.type === undefined) ) {
            throw new Error('!!ERROR: Invalid declaration for tile: missing one of the following arguments: name, code, type')
        }
        else {
            if (this.rawJSON.code.length > 1) {
                throw new Error('!!ERROR: Invalid declaration for tile: code must be 1 character long')
            }

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
                        if (this.variants[key].asset === '?binary?.svg') {
                            // Read linkTiles in bulk, this feature is most likely used for water tiles
                            
                            // assetFolder MUST be included for binary linkTiles
                            if (this.variants[key].assetFolder === undefined) {
                                throw new Error('!!ERROR: Invalid declaration for linkTiles binary: missing assetFolder')
                            }

                            // We prepare asset storage
                            this.variants[key].assets = {};
                                
                            for (const file of await fs.promises.readdir(`${this.assetFolder}/${this.variants[key].assetFolder}`)) {
                                if (file.endsWith('.svg')) {
                                    this.variants[key].assets[`${file.replace('.svg', '')}`] = await sharp(`${this.assetFolder}/${this.variants[key].assetFolder}/${file}`)
                                        .resize((await sharp(`${this.assetFolder}/${this.variants[key].assetFolder}/${file}`).metadata()).width * this.sizeMultiplier).png().toBuffer();
                                }
                            }
                        }
                        else {
                            for (const [secondKey, secondValue] of Object.entries(this.variants[key].linkTiles)) {
                                this.variants[key].linkTiles[secondKey].buffer = await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? this.variants[key].assetFolder : ''}${secondValue.asset}`)
                                    .resize((await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${secondValue.asset}`).metadata()).width * this.sizeMultiplier).png().toBuffer();
                                console.log((await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${secondValue.asset}`).metadata()))
                                console.log(`   Loaded linkTile asset for ${key}: ${secondKey}`);
                            }
                        }
                    }
                    else {
                        throw new Error('!!ERROR: Invalid declaration for linkTiles: missing linkRules')
                    }
                }
                else {
                    this.variants[key].buffer = await sharp(`${this.assetFolder}/${value['asset']}`)
                        .resize((await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${value['asset']}`).metadata()).width * this.sizeMultiplier).png().toBuffer();

                    console.log(`Loaded asset for ${key}`);
                }
            }
        }
        else {
            throw new Error('!!ERROR: Invalid declaration for tile: must include at least one variant')
        }

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
        if (this.rawJSON.rules !== undefined && typeof this.rawJSON.rules === 'object') {
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
        this.name = '';
        this.background = {};
        this.defaults = {};
        
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
        
        if (this.background.color1 !== undefined) {
            if ((this.background.color1.r === undefined) || (this.background.color1.g === undefined) || (this.background.color1.b === undefined)) {
                throw new Error('!!ERROR: Invalid declaration for defaultEnvironment: color1 must have r,g,b values')
            }
        }

        if (this.background.color2 !== undefined) {
            if ((this.background.color2.r === undefined) || (this.background.color2.g === undefined) || (this.background.color2.b === undefined)) {
                throw new Error('!!ERROR: Invalid declaration for defaultEnvironment: color2 must have r,g,b values')
            }
        }

        // Check defaults
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

        // // overrideGamemodes is defined in defaults.overrideGamemodes. Will keep this for reference
        // // Define overrideGamemodes
        // // We assume overrideGamemodes is setup correctly, any errors will be thrown when other environments are evaluated with their respective gamemodes
        // if (this.rawJSON.defaults.overrideGamemodes !== undefined && typeof this.rawJSON.defaults.overrideGamemodes === 'object') {
        //     this.overrideGamemodes = this.rawJSON.defaults.overrideGamemodes;
        // }

        console.log(`Loaded defaultEnvironment ${this.name}`)

        return this
    }
}

class Environment {
    constructor(environment, defaultEnvironment, tiles) {
        this.defaultEnvironment = defaultEnvironment;
        
        this.name = '';
        this.background = {};
        this.defaults = {};

        this.rawJSON = environment;
        this.tiles = tiles;
    }

    async initialize() {
        if (this.rawJSON.name === undefined) {
            throw new Error('!!ERROR: Invalid declaration for defaultEnvironment: missing one of the following arguments: name, background')
        }
        else {
            this.name = this.rawJSON.name;
        }

        if (this.rawJSON.background !== undefined) {
            this.background = this.rawJSON.background;

            // Define background colors
            if ((this.background.color1 === undefined) && (this.background.color2 === undefined)) {
                throw new Error('Invalid declaration for environment: missing one of the following arguments: color1, color2')
            }
            
            if (this.background.color1 !== undefined) {
                if ((this.background.color1.r === undefined) || (this.background.color1.g === undefined) || (this.background.color1.b === undefined)) {
                    throw new Error('!!ERROR: Invalid declaration for environment: color1 must have r,g,b values')
                }
            }
        }
        else {
            this.background = this.defaultEnvironment.background;
        }

        if (this.rawJSON.defaults !== undefined) {
            // This passes all the information from this environment's preset into the defaults if it exists. This includes default tiles and overrideGamemodes rules.
            // Same as defaultEnvironment, any overrideGamemodes errors will be thrown when other environments are evaluated with their respective gamemodes
            this.defaults = this.rawJSON.defaults;

            // We assign tile variants based on what the preset has registered for this environment. If not found, takes values from defaultEnvironment
            if (this.defaults.tiles !== undefined) {
                for (const [key, value] of Object.entries(this.defaults.tiles)) {
                    if (this.defaults.tiles[key] === undefined) {
                        this.defaults.tiles[key] = this.defaultEnvironment.defaults.tiles[key];
                    }
                    else {
                        for (const [key, value] of Object.entries(this.tiles)) {
                            if (value.variants[this.defaults.tiles[value.name]] === undefined) {
                                throw new Error(`!!ERROR: Invalid declaration for defaultEnvironment: tile ${value.name} does not have variant ${this.defaults.tiles[value.name]}`)
                            }
                        }
                    }
                }
            }
            else {
                this.defaults.tiles = this.defaultEnvironment.defaults.tiles;
            }
        }
        else {
            this.defaults = this.defaultEnvironment.defaults;
        }

        console.log(`Loaded environment ${this.name}`);

        return this
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
        options,
        environment,
        sizeMultiplier,
        ignoreTiles,
        tiles,
        border
    ) {
        this.x = 1;
        this.y = 1;

        this.name = '';
        this.options = options;
        this.environment = environment;

        this.sizeMultiplier = sizeMultiplier;
        this.ignoreTiles = ignoreTiles;
        this.tiles = tiles;
        this.border = border;
    }

    async initialize() {
        // Initialize map creation
        if (this.options.name !== undefined) {
            this.name = this.options.name;
        }
        else {
            this.name = 'Map';
        }

        if (this.options.border === undefined) {
            throw new Error('!!ERROR: Specify border amount')
        }

        if (this.options.grid === undefined) {
            throw new Error('!!ERROR: Invalid options format: missing grid')
        }
        else {
            if (this.options.grid.every(x => x.length !== this.options.grid[0].length)) {
                throw new Error('!!ERROR: Invalid grid size. All strings must be of equal length');
            }            
        }

        const background = await this.drawBackground(this.options.grid[0].length, this.options.grid.length, this.options.border, this.environment.background, this.sizeMultiplier);
        const tiles = await this.compileTiles(this.options.grid, this.options.replaceTiles, this.sizeMultiplier, this.environment, this.tiles, this.border);

        await sharp(background)
            .composite(tiles)
            .toFile('./output.png')

        console.log('Map saved')

        return this
    }

    async getX() {
        // Get cursor X coordinate
        return this.x;
    }

    async getY() {
        // Get cursor Y coordinate
        return this.y;
    }

    async floodFill() {
        // Algorithm to assign tags recursively to neighboring tiles of the same type
    }

    async assignTags() {
        // Under-the-hood tile tags to change behavior of linkTiles
    }

    async alterTiles() {
        /* Alter tiles based on gamemode or environment preferences, hierarchy goes down as follows:

            - replaceTiles
            - drawBackground
                - skipTiles
            - ignoreTiles
            - environment
                - gamemode
            - overrideEnvironment
            - specialTileRules
            - assetSwitchers
            - order
            - orderHor
        */
    }

    async compileTiles(grid, replaceTiles, sizeMultiplier, environment, tiles, border) {
        // Replace tile encoding
        let compositeTileList = [];

        for (let x = 0; x <= grid.length-1; x++) {
            for (let y = 0; y <= grid[0].length-1; y++) {
                if (replaceTiles !== undefined) {
                    for (const rule of replaceTiles) {
                        if (grid[x][y] === rule.from) {
                            console.log(`   Replace: X${x+1},Y${y+1} ${rule.from} > ${rule.to}`)
                            grid[x] = grid[x].substring(0,y) + rule.to + grid[x].substring(y+1)
                        }
                    }
                }
                let tile = null;

                for (const [key, value] of Object.entries(tiles)) {
                    if (grid[x][y] === value.code) {
                        tile = value;
                    }
                }

                if (tile !== null) {
                    let tileOffsetLeft = tile.variants[environment.defaults.tiles[tile.name]].offset.left > 0 ? Math.round((1/1000)*tile.variants[environment.defaults.tiles[tile.name]].offset.left*sizeMultiplier)*-1 : Math.round((1/1000)*tile.variants[environment.defaults.tiles[tile.name]].offset.left*sizeMultiplier)
                    let tileOffsetTop = tile.variants[environment.defaults.tiles[tile.name]].offset.top > 0 ? Math.round((1/1000)*tile.variants[environment.defaults.tiles[tile.name]].offset.top*sizeMultiplier)*-1 : Math.round((1/1000)*tile.variants[environment.defaults.tiles[tile.name]].offset.top*sizeMultiplier)

                    compositeTileList.push(
                        {
                            input: tile.variants[environment.defaults.tiles[tile.name]].buffer,
                            left: ((y+border)*sizeMultiplier) + tileOffsetLeft,
                            top: ((x+border)*sizeMultiplier) + tileOffsetTop
                        }
                    )
                }
            }
        }
        console.log('\n')

        return compositeTileList
    }

    async overrideEnvironment() {
        // Change tile variants regardless of the preset-defined environment tiles
    }

    async specialTileRules() {
        // Change tile variants if the condition is met
    }

    async assetSwitcher() {
        // Switch tile with variants of any kind
    }

    async drawBackground(xWidth, yLength, border, background, sizeMultiplier) {
        // Draw background of the map based on grid size, border and sizeMultiplier
        console.log('   Drawing background...')

        const dateStart = new Date();

        // Read background colors
        let darkBg = null;
        let bufferBg = null;

        let compositeBgList = [];

        bufferBg = await sharp({
            create: {
                width: (xWidth + (border*2)) * sizeMultiplier,
                height: (yLength + (border*2)) * sizeMultiplier,
                channels: 4,
                background: {r: 0,
                             g: 0,
                             b: 0,
                             alpha: 0}
            }
        }).png().toBuffer();

        if (background.color1 !== undefined && background.color2 !== undefined) {
            compositeBgList.push({input: await sharp({
                        create: {
                            width: xWidth * sizeMultiplier,
                            height: yLength * sizeMultiplier,
                            channels: 4,
                            background: {r: background.color1.r,
                                         g: background.color1.g,
                                         b: background.color1.b}
                        }}).png().toBuffer(),
                    top: border*sizeMultiplier,
                    left: border*sizeMultiplier})

            darkBg = await sharp({
                create: {
                    width: sizeMultiplier,
                    height: sizeMultiplier,
                    channels: 4,
                    background: {r: background.color2.r,
                                 g: background.color2.g,
                                 b: background.color2.b}
                }
            }).png().toBuffer();
        }
        else if (background.color1 !== undefined) {
            compositeBgList.push({input: await sharp({
                        create: {
                            width: xWidth * sizeMultiplier,
                            height: yLength * sizeMultiplier,
                            channels: 4,
                            background: {r: background.color1.r,
                                         g: background.color1.g,
                                         b: background.color1.b}
                        }}).png().toBuffer(),
                    top: border*sizeMultiplier,
                    left: border*sizeMultiplier})

            darkBg = await sharp({
                create: {
                    width: sizeMultiplier,
                    height: sizeMultiplier,
                    channels: 4,
                    background: {r: Math.round(background.color1.r * (242 / 255)),
                                 g: Math.round(background.color1.g * (242 / 255)),
                                 b: Math.round(background.color1.b * (242 / 255))}
                }
            }).png().toBuffer();
        }

        // Alternate colors
        for (let x = 0; x <= xWidth-1; x++) {
            for (let y = 0; y <= yLength-1; y++) {
                if ((0 == ((x + (y % 2)) % 2))) {
                    // Darker BG color
                    compositeBgList.push({input: darkBg, top: (y+border) * 100, left: (x+border) * 100});
                }
            }
        }

        bufferBg = await sharp(bufferBg)
            .composite(compositeBgList)
            .toBuffer();

        const dateEnd = new Date();

        console.log(`Time elapsed: ${(dateEnd.getTime() - dateStart.getTime()) / 1000}`)
        return bufferBg
    }
    
    async drawOver() {
        // Draw tiles without altering the array code
    }

    async drawEdit() {
        // Draw tiles altering the array code
    }

    async checkOrder() {
        // Check the order of tiles in the Z coordinate and delay rendering depending on their value
    }

    async checkOrderHor() {
        // Check the order of tiles in the Z coordinate for the row and delay rendering depending on their value
    }

    async evaluateCondition(target, condition) {
        let i = 0;
        let match = true;
    
        for (const char of target) {
            if (condition[i] !== char.value) {
                if (condition[i] !== '*') {
                    match = false;
                }
            }
    
            i+=1;
        }
    
        return match
    }
    
    async convertBinary(target, neighbors) {
        let str = '';
    
        for (const char of neighbors) {
            if (char === target) {
                str += '1';
            }
            else {
                str += '0';
            }
        }
    
        return str
    }
    
    async checkNeighborTiles(array, coordinates, edge) {
        // Check adjacent tiles based on XY coordinate

        let target = array[coordinates.x][coordinates.y];
    
        console.log(`Target: ${target}\nPOS: X${coordinates.x}, Y${coordinates.y}`);
    
        let neighbors = [];
    
        for (let x = coordinates.x-1; x <= coordinates.x+1; x++) {
            for (let y = coordinates.y-1; y <= coordinates.y+1; y++) {
                if (x !== coordinates.x || y !== coordinates.y) {
                    // If this is not the target tile
                    if ((x < 0 || y < 0) || (x > array.length-1 || y > array[array.length-1].length)) {
                        // If the tile is outside the grid
                        neighbors.push(undefined);
                    }
                    else {
                        // If the tile is inside the grid
                        neighbors.push(array[x][y]);
                    }
                }
            }
        }
    
        // Check edges
    
        /*
    
        01235
      X X X
      X M . . .
      X . . . .
        . . . .
        . . . .
    
        01247
            X X X
        . . . M X
        . . . . X
        . . . .
        . . . .
    
        012
        X X X
        . M . .
        . . . .
        . . . .
        . . . .
    
        */
    
        let corValue = null;
        let sideValue = null;
        let sideBotValue = null;
    
        if (neighbors[1] === undefined) {
            // Top Row
            for (let i = 0; i <= 2; i++) {
                // Top [0,1,2] Only
                switch (edge) {
                    case 0:
                        // Different
                        neighbors[i] = '!!INVALID_POS';
                        break;
                    case 1:
                        // Mirror
                        neighbors[i] = target;
                        break;
                    case 2:
                        // Copy
                        if (i === 1) {
                            // N of target
                            neighbors[i] = target;
                        }
                        else {
                            // NW, NE of target
                            neighbors[i] = array[coordinates.x][array[coordinates.x][coordinates.y-1] !== undefined ? coordinates.y-1 : (array[coordinates.x][coordinates.y+1] !== undefined ? coordinates.y+1 : '!!INVALID_POS')];
                        }
                        break;
                }
            }
            
            if (neighbors[3] === undefined) {
                // Left Corner
                corValue = 0; // NW of target
                sideValue = 3; // W of target
                sideBotValue = 5; // SW of target
            }
            if (neighbors[4] === undefined) {
                // Right Corner
                corValue = 2; // NE of target
                sideValue = 4; // E of target
                sideBotValue = 7; // SE of target
            }
    
            if (corValue !== null && sideValue !== null && sideBotValue !== null) {
                // Check Top Corners if they match, otherwise ignore
                if (edge === 1) {
                    // Mirror: true
                    neighbors[corValue] = target;
                }
                else {
                    // Different, Copy: false
                    neighbors[corValue] = '!!INVALID_POS';
                }
    
                switch (edge) {
                    case 0:
                        // Different
                        neighbors[sideValue] = '!!INVALID_POS';
                        neighbors[sideBotValue] = '!!INVALID_POS';
                        break;
                    case 1:
                        // Mirror
                        neighbors[sideValue] = target;
                        neighbors[sideBotValue] = target;
                        break;
                    case 2:
                        // Copy
                        neighbors[sideValue] = target;
                        neighbors[sideBotValue] = array[coordinates.x][coordinates.y+1];
                        break;
                }
            }
        }
    
        /*
    
        035
        X . . . .
        X M . . .
        X . . . .
        . . . .
    
        247
        . . . . X
        . . . M X
        . . . . X
        . . . .
    
        */
    
        else if ((neighbors[3] === undefined || neighbors[4] === undefined) && (neighbors[1] !== undefined && neighbors[6] !== undefined)) {
            // Middle Row
    
            // Middle [3, 4] Only
            if (neighbors[3] === undefined) {
                // Left Side
                corValue = 0;
                sideValue = 3;
                sideBotValue = 5;
            }
            if (neighbors[4] === undefined) {
                // Right Side
                corValue = 0;
                sideValue = 4;
                sideBotValue = 7;
            }
    
            switch (edge) {
                case 0:
                    neighbors[corValue] = '!!INVALID_POS';
                    neighbors[sideValue] = '!!INVALID_POS';
                    neighbors[sideBotValue] = '!!INVALID_POS';
                    break;
                case 1:
                    neighbors[corValue] = target;
                    neighbors[sideValue] = target;
                    neighbors[sideBotValue] = target;
                    break;
                case 2:
                    neighbors[sideValue] = target;
                    neighbors[corValue] = array[coordinates.x][array[coordinates.x][coordinates.y-1] !== undefined ? coordinates.y-1 : (array[coordinates.x][coordinates.y+1] !== undefined ? coordinates.y+1 : '!!INVALID_POS')];
                    break;
            }
        }
    
        /*
    
        03567
        . . . .
        . . . .
        X . . . .
        X M . . .
        X X X
    
        24567
        . . . .
        . . . .
        . . . . X
        . . . M X
            X X X
    
        567
        . . . .
        . . . .
        . . . .
        . M . .
        X X X
    
        */
    
        else if (neighbors[6] === undefined) {
            // Bottom Row
            for (let i = 5; i <= 7; i++) {
                // Bottom [5,6,7] Only
                switch (edge) {
                    case 0:
                        // Different
                        neighbors[i] = '!!INVALID_POS';
                        break;
                    case 1:
                        // Mirror
                        neighbors[i] = target;
                        break;
                    case 2:
                        // Copy
                        if (i === 1) {
                            // S of target
                            neighbors[i] = target;
                        }
                        else {
                            // SW, SE of target
                            neighbors[i] = array[array[coordinates.x-1][coordinates.y] !== undefined ? coordinates.x-1 : (array[coordinates.x+1][coordinates.y] !== undefined ? coordinates.x+1 : '!!INVALID_POS')][coordinates.y];
                        }
                        break;
                }
            }
            
            if (neighbors[3] === undefined) {
                // Left Corner
                corValue = 5; // SW of target
                sideValue = 3; // W of target
                sideBotValue = 0; // NW of target
            }
            if (neighbors[4] === undefined) {
                // Right Corner
                corValue = 7; // SE of target
                sideValue = 4; // E of target
                sideBotValue = 2; // NE of target
            }
    
            if (corValue !== null && sideValue !== null && sideBotValue !== null) {
                // Check Bottom Corners if they match, otherwise ignore
                if (edge === 1) {
                    // Mirror: true
                    neighbors[corValue] = target;
                }
                else {
                    // Different, Copy: false
                    neighbors[corValue] = '!!INVALID_POS';
                }
    
                switch (edge) {
                    case 0:
                        // Different
                        neighbors[sideValue] = '!!INVALID_POS';
                        neighbors[sideBotValue] = '!!INVALID_POS';
                        break;
                    case 1:
                        // Mirror
                        neighbors[sideValue] = target;
                        neighbors[sideBotValue] = target;
                        break;
                    case 2:
                        // Copy
                        neighbors[sideValue] = target;
                        neighbors[sideBotValue] = array[coordinates.x+1][coordinates.y];
                        break;
                }
            }
        }
    
        console.log(neighbors);
    
        let binary = convertBinary(array[coordinates.x][coordinates.y], neighbors, edge);
    
        let condition = '0*0***11';
    
        console.log(binary, condition);
        console.log('\n');
    
        if (evaluateCondition(binary, condition, edge)) {
            console.log(`Condition ${condition} matched ${binary}`)
        }
        else {
            console.log('Condition rejected')
        }
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
        sizeMultiplier,
        ignoreOptions
    ) {
        this.assetFolder = assetFolder;
        this.outputFolder = outputFolder;
        this.presetFile = presetFile;
        this.optionsFile = optionsFile;

        this.presetData = null;
        this.optionsData = null;

        this.sizeMultiplier = sizeMultiplier;
        this.ignoreOptions = ignoreOptions;

        this.ignoreTiles = [];
        this.tiles = {};
        this.tileCodes = [];
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
        await this.readEnvironments();

        console.log('Preset data and assets fully loaded. Initializing map creation...\n');

        // Any maps we want to generate we go ahead and put them here

        // This options format will be passed once per map
        let options = {
            name: 'Breakpoint',
            grid: [
                'MMM.....2.2.2..FFFFFM',
                'MM...............FFFM',
                'MM.................MM',
                'M..................MM',
                'M..RRR............YYY',
                '...FFFFF.............',
                '...FFWWWW............',
                '...FFWWWW............',
                '...FFWWWWYYY.........',
                '...FFFFFFFFFF........',
                '...FFFFFFF...........',
                '..............TT.....',
                'YYY....M.............',
                'MM.....M.............',
                'MM....MM.....FFF.....',
                'M.....MM.....FFFFF...',
                'M....III.....III....M',
                '...FFFFF.....MM.....M',
                '.....FFF.....MM....MM',
                '.............M.....MM',
                '.............M....YYY',
                '.....................',
                '...........FFFFFFF...',
                '........FFFFFFFFFF...',
                '.........YYYWWWWFF...',
                '............WWWWFF...',
                '............WWWWFF...',
                '.............FFFFF...',
                'YYY............FFF..M',
                'MM..................M',
                'MM.................MM',
                'MFFF...............MM',
                'MFFFFF..1.1.1.....MMM',
            ],
            environment: 'Canyon',
            skipTiles: [ 'J' ],
            replaceTiles: [
                {
                    from: 'R',
                    to: 'F'
                },
                {
                    from: 'W',
                    to: '.'
                }
            ],
            border: 1
        }

        const map = await new Map(options, this.environments[options.environment], this.sizeMultiplier, this.ignoreTiles, this.tiles, options.border).initialize();
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
            if (this.presetData.ignoreTiles !== undefined) {
                this.ignoreTiles = this.presetData.ignoreTiles;
            }

            console.log('Successfully loaded preset file\n')
        }
    }

    async readTiles() {
        // Create Tile objects from preset
        console.log('Loading tiles...');
        
        let i = 0;
        let dateStart = new Date();

        for (const tile of this.presetData.tiles) {
            this.tiles[tile.name] = await new Tile(tile, this.assetFolder, this.sizeMultiplier).initialize();
            this.tileCodes.push(this.tiles[tile.name].code);
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
        console.log('Loading defaultEnvironment...');

        this.defaultEnvironment = await new DefaultEnvironment(this.presetData.defaultEnvironment, this.tiles).initialize();

        console.log(`Successfully loaded defaultEnvironment\n`);
    }

    async readEnvironments() {
        // Create Environment objects from preset
        console.log('Loading environments...');

        for (const environment of this.presetData.environments) {
            this.environments[environment.name] = await new Environment(environment, this.defaultEnvironment, this.tiles).initialize();
        }

        console.log(`Successfully loaded environments\n`);
    }

    async readGamemodes() {
        // Create Gamemode objects from preset
    }
}

module.exports = {
    Generator: Generator
}