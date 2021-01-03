import { Universe } from "wasm-game-of-life";


const mouseXElem = document.getElementById('mouseX');
const mouseYElem = document.getElementById('mouseY');

const windowXElem = document.getElementById('windowX');
const windowYElem = document.getElementById('windowY');

const windowWidthElem = document.getElementById('windowWidth');
const windowHeightElem = document.getElementById('windowHeight');


var isMouseDown = false;
var lastMousePos = null;

var viewX = 0;
var viewY = 0;
var viewWidth = 50;
var viewHeight = 50;

var cellWidth = 1;
var cellHeight = 1;


function unpack_coords(coords_list) {
    let results = [];
    for (let i = 0; i < coords_list.length; i += 2) {
        results.push({x: coords_list[i], y: coords_list[i + 1]});
    }
    // console.log(results.length)
    return results;
}

function getAbsoluteCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    return {x: x, y: y};
}

function getRelativeCursorPosition(canvas, event) {
    let currMousePos = getAbsoluteCursorPosition(canvas, event);
    return {
        x: (currMousePos.x / cellWidth) + viewX,
        y: currMousePos.y / cellHeight + viewY
    };
}

function resizeCanvas(canvas) {
    const canvasContainer = canvas.parentNode;
    const ctx = canvas.getContext('2d');

    var dpr = window.devicePixelRatio || 1;
    let dim = Math.min(canvasContainer.clientWidth, canvasContainer.offsetHeight) * dpr * 0.9;

    // To get high DPI, set canvas dims to double its actual size
    canvas.width = dim;
    canvas.height = dim;
    canvas.style.width = (dim / 2).toString() + "px";
    canvas.style.height = (dim / 2).toString() + "px";

    ctx.scale(dpr, dpr);

    // Add event listeners

    canvas.addEventListener('mousedown', function(e) {
        isMouseDown = true;
        lastMousePos = getAbsoluteCursorPosition(canvas, e);
    });

    canvas.addEventListener('mouseup', function(e) {
        isMouseDown = false;
    });

    canvas.addEventListener('mousemove', function(e) {
        let currMousePos = getAbsoluteCursorPosition(canvas, e);
        if (isMouseDown) {
            let deltaX = currMousePos.x - lastMousePos.x;
            let deltaY = currMousePos.y - lastMousePos.y;
            
            viewX -= deltaX / cellWidth;
            viewY -= deltaY / cellHeight;
            
            lastMousePos = currMousePos;
        }
        let relativePos = getRelativeCursorPosition(canvas, e);
        mouseXElem.innerText = relativePos.x.toFixed(2);
        mouseYElem.innerText = relativePos.y.toFixed(2);
    });

    function handleMouseWheel(event) {

        // var delta = Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail))); 
        // viewZoom += event.deltaY * 0.01;
        let canvas = document.getElementById('canvas');
        let relativePos = getRelativeCursorPosition(canvas, event);
        mouseXElem.innerText = relativePos.x.toFixed(2);
        mouseYElem.innerText = relativePos.y.toFixed(2);

        let currCenter = {x: viewX + viewWidth/2, y: viewY + viewHeight/2};
        let absMousePos = getAbsoluteCursorPosition(canvas, event);
        let relMousePos = getRelativeCursorPosition(canvas, event)
        
        const SPEED = 0.03;

        if (event.deltaY < 0) { // Zooming in
            let targetZoomWidth = 2;
            let targetZoomHeight = 2;

            let targetViewX = relMousePos.x - targetZoomWidth/2;
            let targetViewY = relMousePos.y - targetZoomHeight/2;
    
            let currTopLeft = {x: viewX, y: viewY};
            let currTopRight = {x: viewX + viewWidth, y: viewY};
            let currBottomLeft = {x: viewX, y: viewY + viewHeight};
            let currBottomRight = {x: viewX + viewWidth, y: viewY + viewHeight};
    
            let targetTopLeft = {x: targetViewX, y: targetViewY};
            let targetTopRight = {x: targetViewX + targetZoomWidth, y: targetViewX};
            let targetBottomLeft = {x: targetViewX, y: targetViewY + targetZoomHeight};
            let targetBottomRight = {x: targetViewX + targetZoomWidth, y: targetViewY + targetZoomHeight};
    
            let topLeftVec = {
                x: targetTopLeft.x - currTopLeft.x,
                y: targetTopLeft.y - currTopLeft.y
            };
            let topRightVec = {
                x: targetTopRight.x - currTopRight.x,
                y: targetTopRight.y - currTopRight.y
            };
            let bottomLeftVec = {
                x: targetBottomLeft.x - currBottomLeft.x,
                y: targetBottomLeft.y - currBottomLeft.y
            };
            let bottomRightVec = {
                x: targetBottomRight.x - currBottomRight.x,
                y: targetBottomRight.y - currBottomRight.y
            };
    
            
            let nextTopLeft = {
                x: currTopLeft.x += topLeftVec.x * SPEED,
                y: currTopLeft.y += topLeftVec.y * SPEED,
            };
            let nextTopRight = {
                x: currTopRight.x += topRightVec.x * SPEED,
                y: currTopRight.y += topRightVec.y * SPEED,
            };
            let nextBottomLeft = {
                x: currBottomLeft.x += bottomLeftVec.x * SPEED,
                y: currBottomLeft.y += bottomLeftVec.y * SPEED,
            };
            let nextBottomRight = {
                x: currBottomRight.x += bottomRightVec.x * SPEED,
                y: currBottomRight.y += bottomRightVec.y * SPEED,
            };
    
            let nextWidth = nextTopRight.x - nextTopLeft.x;
            let nextHeight = nextBottomLeft.y - nextTopLeft.y;
    
    

            viewX = nextTopLeft.x;
            viewY = nextTopLeft.y;
            viewWidth = nextWidth;
            viewHeight = nextHeight;
        } else { // zooming out

            let mx = (absMousePos.x / canvas.width*2);
            let my = (absMousePos.y / canvas.height*2);

            let widthDelta = 2;
            let heightDelta = 2;

            let nextWidth = viewWidth + widthDelta;
            let nextHeight = viewHeight + heightDelta;
    
            viewWidth = nextWidth;
            viewHeight = nextHeight;
            viewX -= mx * widthDelta;
            viewY -= my * heightDelta;

        }

        event.preventDefault();
    }

    canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false); // for Firefox
    canvas.addEventListener('wheel', handleMouseWheel, false);
}

function draw(golUniverse, viewX, viewY, viewWidth, viewHeight) {

    const bg_color = 'black';
    const cell_color = 'white';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bg_color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let screenWidth = canvas.width;
    let screenHeight = canvas.height;

    windowXElem.innerText = viewX.toFixed(2);
    windowYElem.innerText = viewY.toFixed(2);

    windowHeightElem.innerText = viewHeight.toFixed(2);
    windowWidthElem.innerText = viewWidth.toFixed(2);

    cellWidth = screenWidth / viewWidth / 2;
    cellHeight = screenHeight / viewHeight / 2;

    ctx.fillStyle = cell_color;

    let coords = unpack_coords(golUniverse.coords(viewX, viewY, viewX + viewWidth, viewY + viewHeight));
    coords.forEach(coord => {
        let x_adj = (coord.x - viewX) * cellWidth;
        let y_adj =  (coord.y - viewY) * cellHeight;
        ctx.fillRect(x_adj, y_adj, cellWidth, cellHeight);

    });
}

function loop() {
    const fps = 30;
    const canvasElem = document.getElementById('canvas');
    window.onresize = () => {resizeCanvas(canvasElem)};

    // Begin recursive loop
    setTimeout(loop, 1000 / (fps));
    window.requestAnimationFrame(_ => {
        draw(uni, viewX, viewY, viewWidth, viewHeight);
        uni.advance(1);
    });
}

function parseRle(text) {
    let rows = text.split('\n');
    let pattern_data = rows.filter(r => !r.match(/^[\#|x|x=]/)).join('');
    let header = rows.filter(r => r.match(/^[x|x=]/))[0];
    let header_data = header.match(/x\s*\=\s*[0-9]+|y\s*\=\s*[0-9]+|rule\s*\=.+/g);
    console.log('RLE Header:', header);
    console.log('RLE Header Data:', header_data);

    let width = parseInt(header_data[0].split('=').pop());
    let height = parseInt(header_data[1].split('=').pop());

    let tokens = pattern_data.match(/[0-9]+|o|b|!|\$/g).filter(m => m !== '');

    let parsed_state = [];
    let parsed_row = [];
    let curr_num = 1;
    let coords = [];
    let x = 0;
    let y = 0;

    tokens.forEach(token => {
        if (token.match(/[0-9]+/))
            curr_num = parseInt(token);
        else if (token === '!')
            console.log('ignore');
        else {
            if (token === 'o') {
                for (let i = x; i < x + curr_num; i++) {
                    coords.push({x: i, y: y});
                }
                x += curr_num;
                curr_num = 1;
            } else if (token === 'b') {
                x += curr_num
                curr_num = 1
            } else if (token === '$') {
                for (let i = 0; i < curr_num - 1; i++) {
                    let temp_row = [];
                    for (let j = 0; j < width; j++) {
                        temp_row.push(0);
                    }
                    parsed_state.push(temp_row);
                    y += 1;
                }
                x = 0;
                y += 1;
                curr_num = 1;
            } else {
                throw Error('Unexpected Token: ' + token)
            }
        }
    });
    return coords;

}

var uni = Universe.new(0, 0);

let fileInputElem = document.getElementById('file-input');
fileInputElem.addEventListener('change', (event) => {
    const file = event.target.files[0];
    let fReader = new FileReader();
    fReader.onload = function() {
        let coords = parseRle(fReader.result);
        coords.forEach(coord => {
            uni.set(coord.x, coord.y);
        });
        console.log('starting render loop');
        loop();
    }
    fReader.readAsText(file);
});



// uni.set(1, 1);
// uni.set(1, 2);
// uni.set(2, 1);
// uni.set(2, 2);

// uni.set(4, 6);
// uni.set(5, 6);
// uni.set(5, 4);
// uni.set(7, 5);
// uni.set(8, 6);
// uni.set(9, 6);
// uni.set(10, 6);

resizeCanvas(document.getElementById('canvas'));
// loop();