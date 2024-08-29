const fs = require('node:fs');
const sharp = require('sharp');
var parseString = require('xml2js').parseString;

var attrToLowerCase = function(name) {
    return name.toLowerCase();
}

async function getDimensions(path) {
    // Get accurate size of .svg assets
    let data = await fs.promises.readFile(path, {encoding:'utf8'})
    let dimensions = null;

    parseString(data, {strict: false, attrkey:'ATTR', attrNameProcessors:[attrToLowerCase]}, function (err, result) {
        if (err) return null;

        var hasWidthHeightAttr = result.SVG.ATTR['width'] && result.SVG.ATTR['height'];
        if (hasWidthHeightAttr) {
            if (result.SVG.ATTR['width'].endsWith('px') && result.SVG.ATTR['height'].endsWith('px')) {
                height = Number(result.SVG.ATTR['height'].replace('px', '')) * 3.779528;
                width = Number(result.SVG.ATTR['width'].replace('px', '')) * 3.779528;
            }
            else {
                height = Number(result.SVG.ATTR['height'].replace('mm', '')) * 3.779528;
                width = Number(result.SVG.ATTR['width'].replace('mm', '')) * 3.779528;
            }
        } else {
            width = Number(result.SVG.ATTR['viewbox'].toString().replace(/^\d+\s\d+\s(\d+\.?[\d])\s(\d+\.?[\d])/, "$1")) * 3.779528;
            height = Number(result.SVG.ATTR['viewbox'].toString().replace(/^\d+\s\d+\s(\d+\.?[\d])\s(\d+\.?[\d])/, "$2")) * 3.779528;
        }

        dimensions = {height: parseFloat(height), width: parseFloat(width)}
    });

    if (dimensions !== null) return dimensions
    else throw new Error(`!!ERROR: Could not read ${path}`);
}

// All classes are defined here

class Tile {
    constructor(tile, assetFolder, sizeMultiplier) {
        this.display = tile.display;
        this.name = "";
        this.code = "";
        this.type = "";
        this.tags = [];
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

        if (this.rawJSON.tags !== undefined) {
            this.tags = this.rawJSON.tags;
        }

        console.log(`    Loading ${this.name}`);

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
                                    let dimensions = await getDimensions(`${this.assetFolder}/${this.variants[key].assetFolder}/${file}`);

                                    this.variants[key].assets[`${file.replace('.svg', '')}`] = await sharp(`${this.assetFolder}/${this.variants[key].assetFolder}/${file}`)
                                        .resize(Math.round(dimensions.width * this.sizeMultiplier)).png().toBuffer();
                                }
                            }
                        }
                        else {
                            for (const [secondKey, secondValue] of Object.entries(this.variants[key].linkTiles)) {
                                let dimensions = await getDimensions(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${secondValue.asset}`);

                                this.variants[key].linkTiles[secondKey].buffer = await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? this.variants[key].assetFolder : ''}${secondValue.asset}`)
                                    .resize(Math.round(dimensions.width * this.sizeMultiplier)).png().toBuffer();
                                console.log(`        Loaded linkTile asset for ${key}: ${secondKey}`);
                            }
                        }
                    }
                    else {
                        throw new Error('!!ERROR: Invalid declaration for linkTiles: missing linkRules')
                    }
                }
                else {
                    let dimensions = await getDimensions(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${value['asset']}`);

                    this.variants[key].buffer = await sharp(`${this.assetFolder}/${this.variants[key].assetFolder !== undefined ? `${this.variants[key].assetFolder}/` : ''}${value['asset']}`)
                        .resize(Math.round(dimensions.width * this.sizeMultiplier)).png().toBuffer();

                    console.log(`        Loaded asset for ${key}`);
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
        this.name = '';
        this.rules = [];
        this.defaults = {};
        this.multipleConditions = false;
        this.edge = 0;

        this.rawJSON = linkRule;
    }

    async initialize() {
        // Validate linkRule arguments
        if (this.rawJSON.name === undefined) {
            throw new Error('!!ERROR: Invalid declaration for linkRule: missing name')
        }
        else {
            this.name = this.rawJSON.name;
        }

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

        // Define edge
        if (this.rawJSON.edge !== undefined) {
            this.edge = this.rawJSON.edge;
        }

        console.log(`    Loaded rule ${this.name}`);
        
        return this
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

        console.log(`    Loaded defaultEnvironment ${this.name}`)

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
                for (const [key, value] of Object.entries(this.defaultEnvironment.defaults.tiles)) {
                    if (this.defaults.tiles[key] === undefined) {
                        this.defaults.tiles[key] = this.defaultEnvironment.defaults.tiles[key];
                    }
                    else {
                        if (this.tiles[key].variants[this.defaults.tiles[key]] === undefined) {
                            throw new Error(`!!ERROR: Invalid declaration for defaultEnvironment: tile ${value.name} does not have variant ${this.defaults.tiles[value.name]}`)
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

        console.log(`    Loaded environment ${this.name}`);

        return this
    }
}

class Gamemode {
    constructor(gamemode) {
        this.name = '';
        this.defaults = {};
        this.drawOver = [];
        this.drawEdit = [];

        this.rawJSON = gamemode;
    }

    async initialize() {
        if (this.rawJSON.name === undefined) {
            throw new Error('!!ERROR: Invalid declaration for gamemode: missing name')
        }
        else {
            this.name = this.rawJSON.name;
        }

        if (this.rawJSON.defaults === undefined && (this.rawJSON.defaults.tiles === undefined && this.rawJSON.defaults.positionTiles === undefined)) {
            throw new Error('!!ERROR: Invalid declaration for gamemode: missing defaults')
        }
        else {
            this.defaults = this.rawJSON.defaults;
        }

        if (this.rawJSON.drawOver !== undefined) {
            this.drawOver = this.rawJSON.drawOver;
        }

        if (this.rawJSON.drawEdit !== undefined) {
            this.drawEdit = this.rawJSON.drawEdit;
        }

        console.log(`    Loaded gamemode ${this.name}`);

        return this
    }
}

class Map {
    constructor(
        options,
        sizeMultiplier,
        ignoreTiles,
        tiles,
        linkRules,
        gamemodes,
        defaultEnvironment,
        environments
    ) {
        // this.x = 1;
        // this.y = 1;

        this.name = '';
        this.tags = {};
        this.options = options;

        // You need to `replaceEnvironment` editing this variable with `this.environments`
        // This also applies to `assetSwitcher`, same logic
        this.environment = environments[options.environment];
        this.gamemode = {};

        this.sizeMultiplier = sizeMultiplier;
        this.ignoreTiles = ignoreTiles;

        this.defaultEnvironment = defaultEnvironment;
        this.environments = environments;
        this.gamemodes = gamemodes;
        
        this.tiles = tiles;
        this.linkRules = linkRules;

        // Tile lists to merge together after generation has finished
        this.compositeBgList = [];
        this.compositeGmListFirst = [];
        this.compositeGmListLast = [];
        this.compositeTileList = [];
        
    }

    async initialize() {
        // Initialize map creation
        if (this.options.name !== undefined) {
            this.name = this.options.name;
        }
        else {
            this.name = 'Map';
        }

        if (this.environment === undefined) {
            // The provided environment was not found, so we just take everything from defaultEnvironment
            this.environment = this.defaultEnvironment;
        }

        if (this.options.border === undefined) {
            throw new Error('!!ERROR: Specify border amount')
        }

        if (this.options.grid === undefined) {
            throw new Error('!!ERROR: Invalid options format: missing grid')
        }
        else {
            if (this.options.grid.every(y => y.length !== this.options.grid[0].length)) {
                throw new Error('!!ERROR: Invalid grid size. All strings must be of equal length');
            }            
        }
        const dateStart = new Date();

        console.log(`Drawing map ${this.name}`);

        await this.replaceTiles();
        await this.replaceEnvironment();
        await this.assetSwitcher();
        await this.processGamemode();
        await this.assignTags();

        const background = await this.drawBackground();
        await this.compileTiles();

        await sharp(background)
            .composite(this.compositeGmListFirst.concat(this.compositeTileList, this.compositeGmListLast))
            .toFile('./output.png')

        console.log('\n    Map saved')

        const dateEnd = new Date();

        console.log(`    Time elapsed: ${(dateEnd.getTime() - dateStart.getTime()) / 1000}\n`)
        

        return this
    }

    // async getX() {
    //     // Get cursor X coordinate
    //     return this.x;
    // }

    // async getY() {
    //     // Get cursor Y coordinate
    //     return this.y;
    // }

    async replaceTiles() {
        // Replace tile encoding before anything

        if (this.options.replaceTiles === undefined) return
        
        console.log('\n    Replacing tiles...');

        for (let y = 0; y <= this.options.grid.length-1; y++) {
            for (let x = 0; x <= this.options.grid[0].length-1; x++) {
                // If replaceTiles is enabled
                for (const rule of this.options.replaceTiles) {
                    // Iterate through each rule
                    if (this.options.grid[y][x] === rule.from) {
                        // If match found, replace
                        this.options.grid[y] = this.options.grid[y].substring(0,x) + rule.to + this.options.grid[y].substring(x+1);
                        console.log(`        Replace: X${y+1},Y${x+1} ${rule.from} > ${rule.to}`)
                    }
                }
            }
        }
    }

    async replaceEnvironment() {
        // Change tile variants regardless of the preset-defined environment tiles

        if (this.options.replaceEnvironment === undefined) return

        console.log('\n    Replacing environment tiles...');

        for (const rule of this.options.replaceEnvironment) {
            // Iterate through each rule
            if (this.tiles[rule.tile] !== undefined && this.environments[rule.environment] !== undefined) {
                // The environment and the tile are valid references
                this.environment.defaults.tiles[rule.tile] = this.environments[rule.environment].defaults.tiles[rule.tile];
                console.log(`        Replace: ${rule.tile} | ${this.environment.name} > ${rule.environment}`)
            }
        }
    }

    async assetSwitcher() {
        // Switch tile with variants of any kind
        if (this.options.assetSwitcher === undefined) return
        
        console.log('\n    Switching tiles...');

        for (const rule of this.options.assetSwitcher) {
            if (rule.find !== undefined && rule.replace !== undefined) {
                // Find/Replace rules exist, we process them
                // We first check the tiles exist

                if (this.tiles[rule.find.tile].variants[rule.find.variant] !== undefined && this.tiles[rule.replace.tile].variants[rule.replace.variant] !== undefined) {
                    // If the variants exist, we replace the asset in this.tiles, NOT this.environment
                    this.tiles[rule.find.tile].variants[rule.find.variant] = this.tiles[rule.replace.tile].variants[rule.replace.variant];
                    console.log(`        Switch: ${rule.find.tile}[${rule.find.variant}] > ${rule.replace.tile}[${rule.replace.variant}]`)
                }
                else {
                    console.log(`!!ERROR: Invalid assetSwitcher assets, skipped rule`);
                }
            }
        }
    }

    async assignTags() {
        // Under-the-hood tile tags to change behavior of linkTiles

        console.log('\n    Assigning tags...')

        for (let y = 0; y <= this.options.grid.length-1; y++) {
            for (let x = 0; x <= this.options.grid[0].length-1; x++) {
                for (const [key, value] of Object.entries(this.tiles)) {
                    // If the tile exists and it matches the code, it's assigned
                    if (this.options.grid[y][x] === value.code) {
                        if (value.tags !== undefined) {
                            for (const tag of value.tags) {
                                console.log(`        Tag: X${y+1},Y${x+1} ${tag}`)
                                this.tags[`${x},${y}`] === undefined ? this.tags[`${x},${y}`] = [{x: x, y: y, tag: tag}] : this.tags[`${x},${y}`].push({x: x, y: y, tag: tag});
                            }
                        }
                    }
                }
            }
        }

        console.log('    Tags assigned');
    }

    async alterTiles() {
        /* Alter tiles based on gamemode or environment preferences, hierarchy goes down as follows:

            + replaceTiles
            + defaultEnvironment
            + environment
            + replaceEnvironment
            + gamemode
            + assetSwitchers
            + drawBackground
                + skipTiles
            - ignoreTiles               || Will add later
            /   - specialTileRules      || Will add later
            - order
            - orderHor
        */
    }

    async compileTiles() {
        console.log('\n    Drawing tiles...');

        // replaceEnvironment replaces tiles from the environment passed with the specified ones

        for (let y = 0; y <= this.options.grid.length-1; y++) {
            for (let x = 0; x <= this.options.grid[0].length-1; x++) {
                let tile = null;
                let found = false;

                for (const [key, value] of Object.entries(this.tiles)) {
                    // If the tile exists and it matches the code, it's assigned
                    if (this.options.grid[y][x] === value.code) {
                        // We check if we should skip this tile for rendering (if it is included in skipTiles)
                        if (this.options.skipTiles !== undefined) {
                            for (const innerTile of this.options.skipTiles) {
                                if (innerTile === value.code) {
                                    found = true;
                                    break;
                                }
                            }

                            if (!found) {
                                tile = value;
                            }
                        }
                        else {
                            tile = value;
                        };
                    }
                }

                if (tile !== null) {
                    // If the tile exists
                    let assignedTile = null;

                    if (this.gamemode.defaults.positionTiles !== undefined) {
                        let i = 0;
                        for (const team of [this.gamemode.defaults.positionTiles.team1, this.gamemode.defaults.positionTiles.team2]) {
                            if (team.tiles !== undefined) {
                                for (const [key, value] of Object.entries(team.tiles)) {
                                    if (typeof value === 'object') {
                                        // Several environment-dependant variants of the same tile
                                        if (value[this.environment.name] !== undefined) {
                                            // The environment matches
                                            if (this.tiles[key].variants[value[this.environment.name]] !== undefined) {
                                                // The variant exists
                                                if (this.gamemode.defaults.positionTiles.positionDivide === 'ver') {
                                                    if (x > Math.round(this.options.grid[0].length / 2) && i === 0) {
                                                        this.environment.defaults.tiles[key] = value[this.environment.name];
                                                    }
                                                    else if (x < Math.round(this.options.grid[0].length / 2) && i === 1) {
                                                        this.environment.defaults.tiles[key] = value[this.environment.name];
                                                    }
                                                }
                                                else {
                                                    if (y > Math.round(this.options.grid.length / 2) && i === 0) {
                                                        this.environment.defaults.tiles[key] = value[this.environment.name];
                                                    }
                                                    else if (y < Math.round(this.options.grid.length / 2) && i === 1) {
                                                        this.environment.defaults.tiles[key] = value[this.environment.name];
                                                    }
                                                }
                                            }
                                        }
                                        else {
                                            // The environment doesn't match
                                            if (this.tiles[key].variants[value.default] !== undefined) {
                                                // The variant exists
                                                if (this.gamemode.defaults.positionTiles.positionDivide === 'ver') {
                                                    if (x > Math.round(this.options.grid[0].length / 2) && i === 0) {
                                                        this.environment.defaults.tiles[key] = value.default;
                                                    }
                                                    else if (x < Math.round(this.options.grid[0].length / 2) && i === 1) {
                                                        this.environment.defaults.tiles[key] = value.default;
                                                    }
                                                }
                                                else {
                                                    if (y > Math.round(this.options.grid.length / 2) && i === 0) {
                                                        this.environment.defaults.tiles[key] = value.default;
                                                    }
                                                    else if (y < Math.round(this.options.grid.length / 2) && i === 1) {
                                                        this.environment.defaults.tiles[key] = value.default;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    else if (typeof value === 'string') {
                                        // The variant is global
                                        if (this.tiles[key].variants[value] !== undefined) {
                                            // The variant exists
                                            if (this.gamemode.defaults.positionTiles.positionDivide === 'ver') {
                                                if (x > Math.round(this.options.grid[0].length / 2) && i === 0) {
                                                    this.environment.defaults.tiles[key] = value;
                                                }
                                                else if (x < Math.round(this.options.grid[0].length / 2) && i === 1) {
                                                    this.environment.defaults.tiles[key] = value;
                                                }
                                            }
                                            else {
                                                if (y > Math.round(this.options.grid.length / 2) && i === 0) {
                                                    this.environment.defaults.tiles[key] = value;
                                                }
                                                else if (y < Math.round(this.options.grid.length / 2) && i === 1) {
                                                    this.environment.defaults.tiles[key] = value;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            i += 1;
                        }
                    }

                    // If this variant has linkTiles
                    if (tile.variants[this.environment.defaults.tiles[tile.name]].linkTiles !== undefined && tile.variants[this.environment.defaults.tiles[tile.name]].linkRules !== undefined) {
                        let binary = [];
                        let rawBinary = '';
                        let match = false;
                        let matchTag = false;

                        let matchRules = [];

                        for (const rule of this.linkRules[tile.variants[this.environment.defaults.tiles[tile.name]].linkRules].rules) {
                            // Iterate through each rule
                            binary = [];
                            rawBinary = await this.linkTiles(y, x, this.linkRules[tile.variants[this.environment.defaults.tiles[tile.name]].linkRules].edge, rule.replaceCode);

                            for (const char of rawBinary) {
                                binary.push(char);
                            }

                            let accuracy = 0;

                            for (let i = 0; i < 8; i++) {
                                if (rule.condition[i] === '*')
                                    accuracy += 1;
                                else if (rule.condition[i] === binary[i])
                                    accuracy += 1;
                            }

                            if (accuracy === 8) {
                                // If the condition matches
                                match = true;

                                // Check requiredGamemode match
                                if (rule.requiredGamemode !== undefined) {
                                    if (rule.requiredGamemode !== this.options.gamemode) {
                                        match = false;
                                    }
                                }
                            
                                // Check requiredTag match
                                if (rule.requiredTag !== undefined) {
                                    if (this.tags[`${x},${y}`] !== undefined) {
                                        for (const tag of this.tags[`${x},${y}`]) {
                                            if (tag.tag === rule.requiredTag) {
                                                matchTag = true;
                                            }
                                        }
                                    }

                                    if (matchTag === false) {
                                        match = false;
                                    }
                                }

                                if (match) {
                                    matchRules.push(rule);

                                    if (!this.linkRules[tile.variants[this.environment.defaults.tiles[tile.name]].linkRules].multipleConditions) {
                                        break;
                                    }
                                }
                            }
                        }

                        if (matchRules.length > 0) {
                            // There was a match in the condition
                            for (const rule of matchRules) {
                                if (rule.changeBinary !== undefined) {
                                    for (let i = 0; i < rule.changeBinary.length; i++) {
                                        binary[Number(rule.changeBinary[i].split('a')[1])] = rule.changeBinary[i].split('a')[0];
                                    }
                                }

                                if (tile.variants[this.environment.defaults.tiles[tile.name]].assets !== undefined) {
                                    // If binary linkTiles are enabled
                                    assignedTile = tile.variants[this.environment.defaults.tiles[tile.name]].linkTiles[rule.linkTile];
                                    
                                    assignedTile.asset = `${binary.join('', binary)}.svg`;
                                    assignedTile.buffer = tile.variants[this.environment.defaults.tiles[tile.name]].assets[`${binary.join('', binary)}`];
                                }
                                else {
                                    // If binary linkTiles are NOT enabled
                                    assignedTile = tile.variants[this.environment.defaults.tiles[tile.name]].linkTiles[rule.linkTile];
                                }
                            }
                        }
                        else {
                            // No match, use default
                            assignedTile = tile.variants[this.environment.defaults.tiles[tile.name]].linkTiles[this.linkRules[tile.variants[this.environment.defaults.tiles[tile.name]].linkRules].defaults.linkTile];
                            
                            if (tile.variants[this.environment.defaults.tiles[tile.name]].assets !== undefined) {
                                // If binary linkTiles are enabled
                                
                                if (tile.variants[this.environment.defaults.tiles[tile.name]].assets[`${binary.join('', binary)}`] !== undefined) {
                                    // The binary tile didn't match any rule, but it exists so we let it pass
                                    assignedTile.asset = `${binary.join('', binary)}.svg`;
                                    assignedTile.buffer = tile.variants[this.environment.defaults.tiles[tile.name]].assets[`${binary.join('', binary)}`];
                                }
                                else {
                                    // We assign the first item in the array as fallback
                                    assignedTile.asset = `${tile.variants[this.environment.defaults.tiles[tile.name]].assets[0]}.svg`;
                                    assignedTile.buffer = tile.variants[this.environment.defaults.tiles[tile.name]].assets[0];
                                }
                            }
                        }
                    }
                    // If this variant does NOT have linkTiles
                    else {
                        assignedTile = tile.variants[this.environment.defaults.tiles[tile.name]];
                    }

                    let tileOffsetLeft = assignedTile.offset.left > 0 ? Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)
                    let tileOffsetTop = assignedTile.offset.top > 0 ? Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)

                    this.compositeTileList.push(
                        {
                            input: assignedTile.buffer,
                            left: ((x+this.options.border)*this.sizeMultiplier) + tileOffsetLeft,
                            top: ((y+this.options.border)*this.sizeMultiplier) + tileOffsetTop
                        }
                    )
                }
            }

            // Do `orderHor` here after a line has been read...?
        }

        console.log('    Tiles drawn');
    }

    // async specialTileRules() {
    //     // Change tile variants if the condition is met
    // }

    async drawBackground() {
        // Draw background of the map based on grid size, border and sizeMultiplier
        console.log('\n    Drawing background...')

        // Read background colors
        let lightBg = null;
        let darkBg = null;
        let bufferBg = null;

        bufferBg = await sharp({
            create: {
                width: (this.options.grid[0].length + (this.options.border*2)) * this.sizeMultiplier,
                height: (this.options.grid.length + (this.options.border*2)) * this.sizeMultiplier,
                channels: 4,
                background: {r: 0,
                             g: 0,
                             b: 0,
                             alpha: 0}
            }
        }).png().toBuffer();

        if (this.environment.background.color1 !== undefined && this.environment.background.color2 !== undefined) {
            // compositeBgList.push({input: await sharp({
            //             create: {
            //                 width: this.options.grid[0].length * sizeMultiplier,
            //                 height: this.options.grid.length * sizeMultiplier,
            //                 channels: 4,
            //                 background: {r: background.color1.r,
            //                              g: background.color1.g,
            //                              b: background.color1.b}
            //             }}).png().toBuffer(),
            //         top: border*sizeMultiplier,
            //         left: border*sizeMultiplier})

            lightBg = await sharp({
                create: {
                    width: this.sizeMultiplier,
                    height: this.sizeMultiplier,
                    channels: 4,
                    background: {r: Math.round(this.environment.background.color1.r),
                                 g: Math.round(this.environment.background.color1.g),
                                 b: Math.round(this.environment.background.color1.b)}
                }
            }).png().toBuffer();

            darkBg = await sharp({
                create: {
                    width: this.sizeMultiplier,
                    height: this.sizeMultiplier,
                    channels: 4,
                    background: {r: this.environment.background.color2.r,
                                 g: this.environment.background.color2.g,
                                 b: this.environment.background.color2.b}
                }
            }).png().toBuffer();
        }
        else if (this.environment.background.color1 !== undefined) {
            // compositeBgList.push({input: await sharp({
            //             create: {
            //                 width: this.options.grid[0].length * sizeMultiplier,
            //                 height: this.options.grid.length * sizeMultiplier,
            //                 channels: 4,
            //                 background: {r: background.color1.r,
            //                              g: background.color1.g,
            //                              b: background.color1.b}
            //             }}).png().toBuffer(),
            //         top: border*sizeMultiplier,
            //         left: border*sizeMultiplier})

            lightBg = await sharp({
                create: {
                    width: this.sizeMultiplier,
                    height: this.sizeMultiplier,
                    channels: 4,
                    background: {r: Math.round(this.environment.background.color1.r),
                                 g: Math.round(this.environment.background.color1.g),
                                 b: Math.round(this.environment.background.color1.b)}
                }
            }).png().toBuffer();

            darkBg = await sharp({
                create: {
                    width: this.sizeMultiplier,
                    height: this.sizeMultiplier,
                    channels: 4,
                    background: {r: Math.round(this.environment.background.color1.r * (242 / 255)),
                                 g: Math.round(this.environment.background.color1.g * (242 / 255)),
                                 b: Math.round(this.environment.background.color1.b * (242 / 255))}
                }
            }).png().toBuffer();
        }

        // Alternate colors
        // let nothing = await sharp({
        //     create: {
        //         width: sizeMultiplier,
        //         height: sizeMultiplier,
        //         channels: 4,
        //         background: {r: 0,
        //                      g: 0,
        //                      b: 0,
        //                      alpha: 0}
        //     }
        // }).png().toBuffer();

        console.log('        Skipping tiles...')
        for (let y = 0; y <= this.options.grid.length-1; y++) {
            for (let x = 0; x <= this.options.grid[0].length-1; x++) {
                // We skip tile rendering if needed, this also skips background rendering
                let found = false;

                if (this.options.skipTiles !== undefined) {
                    for (const tile of this.options.skipTiles) {
                        if (tile === this.options.grid[y][x]) {
                            console.log(`            Skipped: ${tile}`);
                            found = true;
                            break;
                        }
                    }
                }
                
                if (!found) {
                    if ((0 == ((y + (x % 2)) % 2))) {
                        // Darker BG color
                        this.compositeBgList.push({input: darkBg, top: (y+this.options.border) * this.sizeMultiplier, left: (x+this.options.border) * this.sizeMultiplier});
                    }
                    else {
                        this.compositeBgList.push({input: lightBg, top: (y+this.options.border) * this.sizeMultiplier, left: (x+this.options.border) * this.sizeMultiplier});
                    }
                }
            }
        }

        bufferBg = await sharp(bufferBg)
            .composite(this.compositeBgList)
            .toBuffer();

        console.log('    Background drawn');
        return bufferBg
    }
    
    // async drawOver() {
    //     // Draw tiles without altering the array code
    // }

    // async drawEdit() {
    //     // Draw tiles altering the array code. Gamemode-specific
    // }

    async processGamemode() {
        // Read information about the provided gamemode to alter behavior
        
        console.log('\n    Processing gamemode...');
        
        
        let found = false;
        
        if (this.options.gamemode === undefined) return
        else
            // Validate gamemode
            if (this.gamemodes[this.options.gamemode] !== undefined) {
                this.gamemode = this.gamemodes[this.options.gamemode];

                found = true;
            }

            if (!found) return

        // Gamemode has been included in options
        // We check if any defaults have been changed

        for (const [key, value] of Object.entries(this.gamemode.defaults.tiles)) {
            if (typeof value === 'object') {
                // Several environment-dependant variants of the same tile
                if (value[this.environment.name] !== undefined) {
                    // The environment matches
                    if (this.tiles[key].variants[value[this.environment.name]] !== undefined) {
                        // The variant exists
                        this.environment.defaults.tiles[key] = value[this.environment.name];
                    }
                }
                else {
                    // The environment doesn't match
                    if (this.tiles[key].variants[value.default] !== undefined) {
                        // The variant exists
                        this.environment.defaults.tiles[key] = value.default;
                    }
                }
            }
            else if (typeof value === 'string') {
                // The variant is global
                if (this.tiles[key].variants[value] !== undefined) {
                    // The variant exists
                    this.environment.defaults.tiles[key] = value;
                }
            }
        }

        // Now we read the special rules provided for gamemodes

        if (this.gamemode.drawEdit !== undefined) {
            // First, we read drawEdit to see if we need to edit grid data
            await this.drawEdit(this.gamemode.drawEdit);
        }

        if (this.gamemode.drawOver !== undefined) {
            // Then, we read drawOver to see if we need to append any assets
            await this.drawOver(this.gamemode.drawOver);
        }

        if (this.gamemode.defaults.positionTiles !== undefined) {
            // positionTiles are enabled
            // Validate positionTiles
            if (this.gamemode.defaults.positionTiles.team1 !== undefined && this.gamemode.defaults.positionTiles.team2 !== undefined) {
                // Both teams are defined, proceed with rules
                // In this function, we only read drawOver rules, any individual tiles depending on position will be read in compileTiles
                for (const team of [this.gamemode.defaults.positionTiles.team1, this.gamemode.defaults.positionTiles.team2]) {
                    // We read drawOver
                    if (team.drawOver !== undefined) {
                        if (this.gamemode.defaults.positionTiles.positionDivide === 'ver') {
                            for (const rule of team.drawOver) {
                                if (rule.position !== undefined) {
                                    rule.position = `${rule.position.split(',')[1]},${rule.position.split(',')[0]}`;
                                }
                            }
                        }

                        await this.drawOver(team.drawOver);
                    }
                }
            }
        }

        console.log('    Gamemode processed')
    }

    async drawEdit(drawEdit) {
        // drawEdit alters grid code. Gamemode-specific
        // drawEdit included validation
        for (const rule of drawEdit) {
            if (rule.tile !== undefined && rule.position !== undefined) {
                // The rule has correct params
                if (this.tiles[rule.tile] !== undefined) {
                    // The tile exists

                    const anchors = await this.validateAnchors(rule.position);

                    if (anchors.match) {
                        if (this.options.grid[anchors.y][anchors.x] !== this.tiles[rule.tile].code) {
                            this.options.grid[anchors.y] = this.options.grid[anchors.y].substring(0,anchors.x) + this.tiles[rule.tile].code + this.options.grid[anchors.y].substring(anchors.x+1);

                            console.log(`        drawEdit: X${anchors.y+1},Y${anchors.x+1} > ${rule.tile}`);
                        }
                        // else {
                        //     console.log(`        drawEdit skip: X${anchors.y+1},Y${anchors.x+1} > ${rule.tile} - Condition already met`);
                        // }
                    }
                }
            }
        }
    }

    async drawOver(drawOver) {
        // drawOver appends tiles to draw without altering grid code. Gamemode-specific
        for (const rule of drawOver) {
            if (rule.tile !== undefined && rule.variant !== undefined && rule.position !== undefined && rule.drawOrder !== undefined) {
                // The rule has correct params
                if (this.tiles[rule.tile] !== undefined !== undefined) {
                    // The tile exists
                    const anchors = await this.validateAnchors(rule.position);

                    if (anchors.match) {
                        if (typeof rule.variant === 'object') {
                            let assignedTile = (this.tiles[rule.tile].variants[rule.variant[this.environment.name]] !== undefined) ? this.tiles[rule.tile].variants[rule.variant[this.environment.name]] : this.tiles[rule.tile].variants[rule.variant.default];

                            let tileOffsetLeft = assignedTile.offset.left > 0 ? Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)
                            let tileOffsetTop = assignedTile.offset.top > 0 ? Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)
                            
                            if (rule.drawOrder === 1) {
                                this.compositeGmListFirst.push(
                                    {
                                        input: assignedTile.buffer,
                                        left: ((anchors.x+this.options.border)*this.sizeMultiplier) + tileOffsetLeft,
                                        top: ((anchors.y+this.options.border)*this.sizeMultiplier) + tileOffsetTop
                                    }
                                )
                            }
                            else if (rule.drawOrder === 2) {
                                this.compositeGmListLast.push(
                                    {
                                        input: assignedTile.buffer,
                                        left: ((anchors.x+this.options.border)*this.sizeMultiplier) + tileOffsetLeft,
                                        top: ((anchors.y+this.options.border)*this.sizeMultiplier) + tileOffsetTop
                                    }
                                )
                            }
                            else {
                                throw new Error('!!ERROR: Invalid drawOrder in gamemode: must be 1 or 2')
                            }

                            console.log(`        drawOver: X${anchors.x+1},Y${anchors.y+1} > ${rule.tile}`);
                        }
                        else if (typeof rule.variant === 'string') {
                            let assignedTile = this.tiles[rule.tile].variants[rule.variant];

                            let tileOffsetLeft = assignedTile.offset.left > 0 ? Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.left*this.sizeMultiplier)
                            let tileOffsetTop = assignedTile.offset.top > 0 ? Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)*-1 : Math.round((1/1000)*assignedTile.offset.top*this.sizeMultiplier)
                            
                            if (rule.drawOrder === 1) {
                                this.compositeGmListFirst.push(
                                    {
                                        input: assignedTile.buffer,
                                        left: ((anchors.x+this.options.border)*this.sizeMultiplier) + tileOffsetLeft,
                                        top: ((anchors.y+this.options.border)*this.sizeMultiplier) + tileOffsetTop
                                    }
                                )
                            }
                            else if (rule.drawOrder === 2) {
                                this.compositeGmListLast.push(
                                    {
                                        input: assignedTile.buffer,
                                        left: ((anchors.x+this.options.border)*this.sizeMultiplier) + tileOffsetLeft,
                                        top: ((anchors.y+this.options.border)*this.sizeMultiplier) + tileOffsetTop
                                    }
                                )
                            }
                            else {
                                throw new Error('!!ERROR: Invalid drawOrder in gamemode: must be 1 or 2')
                            }

                            console.log(`        drawOver: X${anchors.x+1},Y${anchors.y+1} > ${rule.tile}`);
                        }
                    }
                }
            }
        }
    }

    async checkOrder() {
        // Check the order of tiles in the Z coordinate and delay rendering depending on their value
    }

    async checkOrderHor() {
        // Check the order of tiles in the Z coordinate for the row and delay rendering depending on their value
    }

    async floodFill() {
        // Algorithm to assign tags recursively to neighboring tiles of the same type
    }

    async validateAnchors(anchor) {
        const position = anchor.split(',');

        let x = 0;
        let y = 0;

        let xFound = false;
        let yFound = false;

        if (position.length === 2) {
            // Valid position params
            switch (position[0]) {
                // X Coordinate Anchor
                case 'l':
                    // Left
                    x = 0;
                    xFound = true;
                    break;
                case 'm':
                    // Middle
                    x = Math.round((this.options.grid[0].length) / 2) - 1
                    xFound = true;
                    break;
                case 'r':
                    // Right
                    x = this.options.grid[0].length-1;
                    xFound = true;
                    break;
                default:
                    // The coordinate is a set number
                    try {
                        x = Number(position[0]);

                        x = (x > 0) ? x : (this.options.grid[0].length-1)+x;
                        xFound = true;
                    }
                    catch (err) {
                        console.log(err);
                    }
                    break;
            }

            switch (position[1]) {
                // Y Coordinate Anchor
                case 't':
                    // Left
                    y = 0;
                    yFound = true;
                    break;
                case 'm':
                    // Middle
                    y = Math.round((this.options.grid.length) / 2) - 1
                    yFound = true;
                    break;
                case 'b':
                    // Right
                    y = this.options.grid.length-1
                    yFound = true;
                    break;
                default:
                    // The coordinate is a set number
                    try {
                        y = Number(position[1]);

                        y = (y > 0) ? y : (this.options.grid.length-1)+y;
                        yFound = true;
                    }
                    catch (err) {
                        console.log(err);
                    }
                    break;
            }
        }

        if (xFound && yFound) {
            return {x: x, y: y, match: true}
        }
        else {
            return {match: false}
        }
    }

    async linkTiles(y, x, edge, replaceCode) {
        // Check adjacent tile based on XY coordinate

        // If the rule has a replaceCode, we assign it
        let target = (replaceCode === undefined) ? this.options.grid[y][x] : replaceCode;

        let binary = '';
        let neighbors = '';

        if (y === 0 && y === this.options.grid.length-1) {              // One Line
            if (x === 0 && x === this.options.grid[0].length-1)         // One Column
                neighbors = '%%%%%%%%';
            else if (x === 0)                                           // Left
                neighbors = '%%%% %%%';
            else if (x === this.options.grid[0].length-1)               // Right
                neighbors = '%%% %%%%';
            else                                                        // Middle
                neighbors = '%%%  %%%';                                 
        }
        else if (y == 0) {                                              // Top
            if (x == 0 && x == this.options.grid[0].length - 1)         // One Column
                neighbors = "%%%%%% %";
            else if (x == 0)                                            // Left
                neighbors = "%%%% %  ";
            else if (x == this.options.grid[0].length - 1)              // Right
                neighbors = "%%% %  %";
            else                                                        // Middle
                neighbors = "%%%     ";                   
        }
        else if (y == this.options.grid.length - 1) {                   // Bottom
            if (x == 0 && x == this.options.grid[0].length - 1)         // One Column
                neighbors = "% %%%%%%";
            else if (x == 0)                                            // Left
                neighbors = "%  % %%%";
            else if (x == this.options.grid[0].length - 1)              // Right
                neighbors = "  % %%%%";
            else                                                        // Middle
                neighbors = "     %%%";
        }
        else {                                                          // Middle
            if (x == 0 && x == this.options.grid[0].length - 1)         // One Column
                neighbors = "% %%%% %";
            else if (x == 0)                                            // Left
                neighbors = "%  % %  ";
            else if (x == this.options.grid[0].length - 1)              // Right
                neighbors = "  % %  %";
            else                                                        // Middle
                neighbors = "        ";
        }

        switch (edge) {
            case 0:         // Different
                for (let i = 0; i < neighbors.length; i++) {
                    if (neighbors[i] === '%')
                        binary += '0';
                    else
                        binary += await this.checkNeighborTiles(y, x, target, i);
                }
                break;
            case 1:         // Copies
                for (let i = 0; i < neighbors.length; i++) {
                    if (neighbors[i] === '%')
                        binary += '1';
                    else
                        binary += await this.checkNeighborTiles(y, x, target, i);
                }
                break;
            case 2:         // Mirror
                for (let i = 0; i < neighbors.length; i++) {
                    if (neighbors[i] === '%')
                        if (y % 2 === 1)
                            binary += '1';
                        else {
                            if (await this.hasAdjacentTiles(x-1, y-1, target))
                                binary += '1';
                            else if (await this.hasAdjacentTiles(x-1, y+1, target))
                                binary += '1';
                            else if (await this.hasAdjacentTiles(x+1, y-1, target))
                                binary += '1';
                            else if (await this.hasAdjacentTiles(x+1, y+1, target))
                                binary += '1';
                            else
                                binary += '0';
                        }
                    else
                        binary += await this.checkNeighborTiles(y, x, target, i);
                }
                break;
        }

        return binary
    }

    async checkNeighborTiles(y, x, target, arrayPos) {
        switch (arrayPos) {
            case 0:
                if (this.options.grid[y-1][x-1] === target)
                    return '1'
                else
                    return '0'
            case 1:
                if (this.options.grid[y-1][x] === target)
                    return '1'
                else
                    return '0'

            case 2:
                if (this.options.grid[y-1][x+1] === target)
                    return '1'
                else
                    return '0'
                
            case 3:
                if (this.options.grid[y][x-1] === target)
                    return '1'
                else
                    return '0'
                
            case 4:
                if (this.options.grid[y][x+1] === target)
                    return '1'
                else
                    return '0'
                
            case 5:
                if (this.options.grid[y+1][x-1] === target)
                    return '1'
                else
                    return '0'
                
            case 6:
                if (this.options.grid[y+1][x] === target)
                    return '1'
                else
                    return '0'
                
            case 7:
                if (this.options.grid[y+1][x+1] === target)
                    return '1'
                else
                    return '0'

            default:
                return '0'
                
        }
    }

    async hasAdjacentTiles(y, x, target) {
        if (y < 0) // Top edge
        {
            if (x < 0) // Left corner
            {
                if (this.options.grid[y+1][x+1] === target)
                    return true;
                else
                    return false;
            }
            else if (x > this.options.grid[0].length - 1) // Right corner
            {
                if (this.options.grid[y+1][x-1] === target)
                    return true;
                else
                    return false;
            }
            else // Middle
            {
                if (x != this.options.grid[0].length - 1)
                    if (this.options.grid[y+1][x+1] === target)
                        return true;
                    else
                        return false;
                else if (x != 0)
                    if (this.options.grid[y+1][x-1] === target)
                        return true;
                    else
                        return false;
                else
                    return false;
            }
        }
        else if (y > this.options.grid.length - 1) // Bottom edge
        {
            if (x < 0) // Left corner
            {
                if (this.options.grid[y-1][x+1] === target)
                    return true;
                else
                    return false;
            }
            else if (x > this.options.grid[0].length - 1) // Right corner
            {
                if (this.options.grid[y-1][x-1] === target)
                    return true;
                else
                    return false;
            }
            else // Middle
            {   
                console.log(y, this.options.grid.length)
                console.log(x, this.options.grid[0].length)
                if (x != this.options.grid[0].length - 1)
                    if (this.options.grid[y-2][x+1] === target)
                        return true;
                    else
                        return false;
                else if (x != 0)
                    if (this.options.grid[y-2][x-1] === target)
                        return true;
                    else
                        return false;
                else
                    return false;
            }
        }
        else // -
        {
            if (x < 0) // Left edge
            {
                if (y != 0)
                    if (this.options.grid[y-1][x+1] === target)
                        return true;
                    else
                        return false;
                else if (y != this.options.grid.length - 1)
                    if (this.options.grid[y+1][x+1] === target)
                        return true;
                    else
                        return false;
                else
                    return false;
            }
            else if (x > this.options.grid[0].length - 1) // Right edge
            {
                if (y != 0)
                    if (this.options.grid[y-1][x-1] === target)
                        return true;
                    else
                        return false;
                else if (y != this.options.grid.length - 1)
                    if (this.options.grid[y+1][x-1] === target)
                        return true;
                    else
                        return false;
                else
                    return false;
            }
            else // -
            {
                return false;
            }
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
        await this.readGamemodes();
        await this.readDefaultEnvironment();
        await this.readEnvironments();

        console.log('Preset data and assets fully loaded. Initializing map creation...\n');

        // Any maps we want to generate we go ahead and put them here

        // This options format will be passed once per map
        let options = {
            name: 'Breakpoint',
            grid: [
                // "WWW...............",
                // "......W.WW..WWW...",
                // ".WWW.WW.WWW.WWW...",
                // ".WWW..WWWW.WWWW...",
                // ".WWWW...W..WW.....",
                // "...WW..WW.....W...",
                // "..W...WWWWW..WWW..",
                // ".WWW..W...WW.W....",
                // ".WWWWWW.W.WWWWWW..",
                // "...W.WW...W..WWW..",
                // ".WWW..WWWWW...W...",
                // "..W.W...WW........",
                // "...WWW..W.....WW..",
                // "....W..WWWW..WWWW.",
                // "......WWW.WW.WWWW.",
                // ".......WW.W...WW..",
                // "..................",
                // 'JJJJJJJ.2.2.2.JJJJJJJ',
                // 'JJJJJJJ.......JJJJJJJ',
                // 'JJJJJJJ...,...JJJJJJJ',
                // 'JJJJJJJ.......JJJJJJJ',
                // 'M..RRR............YYY',
                // '...FFFFF.............',
                // '...FFWWWW............',
                // '...FFWWWW............',
                // '...FFWWWWYYY.........',
                // '...FFFFFFFFFF........',
                // '...FFFFFFF...........',
                // '..............TT.....',
                // 'YYY....M.............',
                // 'MM.....M.............',
                // 'MM....MM.....FFF.....',
                // 'M.....MM.....FFFFF...',
                // 'M....III.....III....M',
                // '...FFFFF.....MM.....M',
                // '.....FFF.....MM....MM',
                // '.............M.....MM',
                // '.............M....YYY',
                // '.....TT..............',
                // '...........FFFFFFF...',
                // '........FFFFFFFFFF...',
                // '.........YYYWWWWFF...',
                // '............WWWWFF...',
                // '............WWWWFF...',
                // '.............FFFFF...',
                // 'YYY............FFF..M',
                // 'JJJJJJJ.......JJJJJJJ',
                // 'JJJJJJJ...,...JJJJJJJ',
                // 'JJJJJJJ.......JJJJJJJ',
                // 'JJJJJJJ.1.1.1.JJJJJJJ'
                // '...........................',
                // '...........................',
                // '...........................',
                // '.............8.............',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '.......b...................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '...........................',
                // '.............8.............',
                // '...........................',
                // '...........................',
                // '...........................'
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
                '.....TT..............',
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
            environment: 'Grassfield',
            gamemode: 'Brawl Ball',
            skipTiles: [ 'J' ],
            replaceTiles: [
                {
                    from: 'R',
                    to: 'F'
                },
                // {
                //     from: 'W',
                //     to: 'M'
                // },
                // {
                //     from: 'N',
                //     to: 'X'
                // }
            ],
            // assetSwitcher: [
            //     {
            //         find: {
            //             tile: 'water',
            //             variant: 'water'
            //         },
            //         replace: {
            //             tile: 'blocking2',
            //             variant: 'crystalMagenta'
            //         }
            //     }
            // ],
            // replaceEnvironment: [
            //     {
            //         tile: 'blocking2',
            //         environment: 'Jungle'
            //     }
            // ],
            border: 1
        }

        await new Map(options, this.sizeMultiplier, this.ignoreTiles, this.tiles, this.linkRules, this.gamemodes, this.defaultEnvironment, this.environments).initialize();
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

    async readGamemodes() {
        // Create Gamemode object from preset
        console.log('Loading gamemodes...');

        for (const gamemode of this.presetData.gamemodes) {
            this.gamemodes[gamemode.name] = await new Gamemode(gamemode).initialize();
        }

        console.log(`Successfully loaded gamemodes\n`);
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
}

module.exports = {
    Generator: Generator
}