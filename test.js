const matrix = [
    'NMMMMMMMM',
    'NNMMMMMMM',
    'MMMMMMMMM',
    'MMMNNNMMM',
    'MMMMFMMMM',
    'MMMFFFMMM',
    'MMMMMMMMM',
    'MMMMMMMMM',
    'MMMMMMMMM'
]

function evaluateCondition(target, condition) {
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

function convertBinary(target, neighbors) {
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

function checkNeighborTiles(array, coordinates, edge) {
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

// // TLC
// checkNeighborTiles(matrix, {'x': 0, 'y': 0}, 1);
// console.log('\n');

// //TR
// checkNeighborTiles(matrix, {'x': 0, 'y': 4}, 1);
// console.log('\n');

// //TRC
// checkNeighborTiles(matrix, {'x': 0, 'y': 8}, 1);
// console.log('\n');

// //LS
// checkNeighborTiles(matrix, {'x': 4, 'y': 0}, 1);
// console.log('\n');

// //RS
// checkNeighborTiles(matrix, {'x': 4, 'y': 8}, 1);
// console.log('\n');

// //BLC
// checkNeighborTiles(matrix, {'x': 8, 'y': 0}, 1);
// console.log('\n');

// //BR
// checkNeighborTiles(matrix, {'x': 8, 'y': 4}, 1);
// console.log('\n');

// //BRC
// checkNeighborTiles(matrix, {'x': 8, 'y': 8}, 1);
// console.log('\n');

let negativeValue = -500
let positiveValue = 500

console.log(negativeValue+positiveValue)