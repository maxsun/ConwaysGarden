import { Universe } from "wasm-game-of-life";

const mouseXElem = document.getElementById('mouseX');
const mouseYElem = document.getElementById('mouseY');

const windowXElem = document.getElementById('windowX');
const windowYElem = document.getElementById('windowY');

const fpsCounterElem = document.getElementById('fpsCounter');
const ipsCounterElem = document.getElementById('ipsCounter');

const fpsInput = document.getElementById('fpsInput');
const ipsInput = document.getElementById('ipsInput');
const iterationStepInput = document.getElementById('iterationStepInput');

const windowWidthElem = document.getElementById('windowWidth');
const windowHeightElem = document.getElementById('windowHeight');


var isMouseDown = false;
var isScrolling = false;
var touchScaling = false;
var lastTouchScaleDist = 0;
var lastMousePos = null;

var viewX = 0;
var viewY = 0;
var viewWidth = 20;
var viewHeight = 20;

var cellWidth = 1;
var cellHeight = 1;

var theme = null;

function toggleSidebar() {
    let sidebarNode = document.getElementById('sidebar');
    console.log(sidebarNode.style.display);
    if (sidebarNode.style.display === 'none') {
        sidebarNode.style.display = 'flex';
    } else {
        sidebarNode.style.display = 'none';
    }
    let canvasNode = document.getElementById('canvas');
    resizeCanvas(canvasNode);
}


function toggleThemePopup() {
    const themePopup = document.getElementById('themePopup');
    if (themePopup.style.display === 'none' || themePopup.style.display === '') {
        themePopup.style.display = 'block';
        setTimeout(() => {
            window.addEventListener('click', function(e) {
                if (!document.getElementById('themePopup').contains(e.target)){
                    e.preventDefault();
                    themePopup.style.display = 'none';
                }
            }, {once: true});
        }, 100);
    } else {
        themePopup.style.display = 'none';
    }
}

function initSidebar() {
    const patterns = [
        {
            title: 'Glider',
            source: 'https://conwaysgarden.s3-us-west-2.amazonaws.com/patterns/glider.rle'
        },
        {
            title: 'Acorn',
            source: 'https://conwaysgarden.s3-us-west-2.amazonaws.com/patterns/acorn.rle'
        },
        {
            title: 'B52 Bomber',
            source: 'https://conwaysgarden.s3-us-west-2.amazonaws.com/patterns/b52bomber.rle'
        },
        {
            title: 'UTM',
            source: 'https://conwaysgarden.s3-us-west-2.amazonaws.com/patterns/utm.rle'
        }
    ];
    let sidebarList = document.getElementById('patternList');
    patterns.forEach(pat => {
        let listElem = document.createElement('div');
        listElem.className = 'listEntry';

        let elemTitle = document.createElement('span');
        elemTitle.innerText = pat.title;
        listElem.appendChild(elemTitle);

        listElem.dataset.source = pat.source;

        listElem.onclick = function (e) {
            console.log(this.dataset.source);
            loadPatternFromUrl(this.dataset.source);
            e.stopPropagation();
        };

        sidebarList.appendChild(listElem);
    });
}

function applyTheme(theme_data) {
    console.log('Applying Theme:', theme_data);
    theme = theme_data

    Object.keys(theme).forEach(k => {
        console.log(k);
        document.body.style.setProperty('--' + k, theme[k]);
    });

}


function initializeThemes(){

    const canvas = document.getElementById('canvas');
    // read text from URL location
    var request = new XMLHttpRequest();
    request.open('GET', 'https://conwaysgarden.s3-us-west-2.amazonaws.com/themes.json', true);
    // request.open('GET', '/themes.json', true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            const theme_data = JSON.parse(request.responseText);
            const themePopup = document.getElementById('themePopup');

            Object.keys(theme_data).forEach((theme_name) => {
                let popupLI = document.createElement('li');
                
                let popupLI_button = document.createElement('button');
                popupLI_button.dataset['theme_data'] = theme_data[theme_name];
                popupLI_button.innerText = theme_name;
                popupLI_button.onclick = function() {
                    applyTheme(theme_data[theme_name]);
                }

                popupLI.appendChild(popupLI_button);
                themePopup.appendChild(popupLI);
            });

            resizeCanvas(canvas);
        }
    }
}


function updateNumericElem(node, new_value) {
    let curr_value = Number.parseFloat(node.innerText);
    if (new_value.toFixed(2) === curr_value.toFixed(2)) {
        return;
    }

    if (new_value > curr_value) {
        // node.style.color = theme ? theme['base0B'] : 'green';
        node.classList.add('numeric-inc');
    } else if (new_value < curr_value) {
        node.classList.add('numeric-dec');
        // node.style.color = theme ? theme['base08'] : 'red';
    }
    node.innerText = new_value.toFixed(2);
    setTimeout(() => {
        node.classList.remove('numeric-inc');
        node.classList.remove('numeric-dec');
        // console.log('turning color off');
    }, 250);
}

function pack_coords(coords_list) {
    let results = [];
    for (let i = 0; i < coords_list.length; i += 1) {
        results.push(coords_list[i].x);
        results.push(coords_list[i].y);
    }
    // console.log(results.length)
    return results;
}
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

function getRelativeCursorPos(absPos) {
    return {
        x: (absPos.x / cellWidth) + viewX,
        y: absPos.y / cellHeight + viewY
    };
}

function getRelativeCursorPosition(canvas, event) {
    let currMousePos = getAbsoluteCursorPosition(canvas, event);
    return {
        x: (currMousePos.x / cellWidth) + viewX,
        y: currMousePos.y / cellHeight + viewY
    };
}

function resizeCanvas(canvas) {
    console.log('Resizing canvas');
    canvas = document.getElementById('canvas');

    const canvasContainer = canvas.parentNode;
    const ctx = canvas.getContext('2d');

    var dpr = window.devicePixelRatio || 2;
    // var dpr = window.devicePixelRatio || 1;
    let dim = Math.min(canvasContainer.clientWidth, canvasContainer.clientHeight) * 0.95;

    // To get high DPI, set canvas dims to double its actual size

    let canvasMargin = 10;
    let width = canvasContainer.clientWidth - (2 * canvasMargin);
    let height = canvasContainer.clientHeight - (2 * canvasMargin);

    let viewRatio = width/height;

    // viewWidth = viewWidth * 1/viewRatio;
    // if (viewWidth/viewHeight !== width/height) {
        viewWidth = width/10;
        viewHeight = height/10;
    // }
    // let width = dim;
    // let height = dim;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width.toString() + "px";
    canvas.style.height = height.toString() + "px";

    ctx.scale(dpr, dpr);

    // Add event listeners

    canvas.addEventListener('mousedown', function(e) {
        isMouseDown = true;
        document.body.style.cursor = 'grab';
        lastMousePos = getAbsoluteCursorPosition(canvas, e);
    });

    canvas.addEventListener('mouseup', function(e) {
        isMouseDown = false;
        document.body.style.cursor = 'auto';
    });

    canvas.addEventListener('mousemove', function(e) {
        let currMousePos = getAbsoluteCursorPosition(canvas, e);
        if (isMouseDown) {
            let deltaX = currMousePos.x - lastMousePos.x;
            let deltaY = currMousePos.y - lastMousePos.y;
            
            viewX -= deltaX / cellWidth;
            viewY -= deltaY / cellHeight;
            
            lastMousePos = currMousePos;
            // document.body.style.cursor = 'grab';
            document.body.style.cursor = 'grabbing';

        }
        let relativePos = getRelativeCursorPosition(canvas, e);
        updateNumericElem(mouseXElem, relativePos.x);
        updateNumericElem(mouseYElem, relativePos.y);

    });

    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 2) {
            touchScaling = true;
            lastTouchScaleDist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY);
        } else {
            isMouseDown = true;
            lastMousePos = getAbsoluteCursorPosition(canvas, e.touches[0]);
        }
    });

    canvas.addEventListener('touchend', function(e) {
        isMouseDown = false;
        touchScaling = false;
    });


    function handleZoom(absMousePos, deltaY) {

        let canvas = document.getElementById('canvas');
        let relativePos = getRelativeCursorPos(absMousePos);
        mouseXElem.innerText = relativePos.x.toFixed(2);
        mouseYElem.innerText = relativePos.y.toFixed(2);

        // let relMousePos = getRelativeCursorPos(absMousePos)

        const currViewRatio = viewWidth/viewHeight;
        const minWidth = 10 * currViewRatio;
        const minHeight = 10;

        if (deltaY < 0 && (viewWidth <= minWidth || viewHeight <= minHeight)) {
            deltaY = 0;
        }

        const SPEED = 0.1 * -deltaY;
        let mx = (absMousePos.x / canvas.width*dpr);
        let my = (absMousePos.y / canvas.height*dpr);

        let widthDelta = 0.5 * currViewRatio * Math.min(deltaY, 100);
        let heightDelta = 0.5 * Math.min(deltaY, 100);

        let nextWidth = Math.max(viewWidth + widthDelta, minWidth);
        let nextHeight = Math.max(viewHeight + heightDelta, minHeight);
        
        viewX -= mx * (nextWidth - viewWidth);
        viewY -= my * (nextHeight - viewHeight);
 
        viewWidth = nextWidth;
        viewHeight = nextHeight;

        if (deltaY < 0) {
            document.body.style.cursor = 'zoom-in';
        } else if (deltaY > 0) {
            document.body.style.cursor = 'zoom-out';
        }
        
        window.clearTimeout(isScrolling);
        isScrolling = setTimeout(function() {
            console.log('done scrolling');
            document.body.style.cursor = 'auto';
            isScrolling = null;
        }, 100);

    }

    canvas.addEventListener('touchmove', function(e) {
        if (touchScaling) { // is 'pinching' to zoom
            let currTouchDist = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY);
            let deltaDist = lastTouchScaleDist - currTouchDist;
            let scaleAmount = (viewWidth/5) * (deltaDist / Math.min(parseInt(canvas.style.width), parseInt(canvas.style.height)));
            let midpoint = {
                x: (e.touches[0].pageX + e.touches[1].pageX) / 2,
                y: (e.touches[0].pageY + e.touches[1].pageY) / 2,
            };
            handleZoom(midpoint, scaleAmount);

        } else if (isMouseDown) {
            let currMousePos = getAbsoluteCursorPosition(canvas, e.touches[0]);
            let deltaX = currMousePos.x - lastMousePos.x;
            let deltaY = currMousePos.y - lastMousePos.y;

            viewX -= deltaX / cellWidth;
            viewY -= deltaY / cellHeight;

            lastMousePos = currMousePos;
        }
        e.preventDefault();
    });


    function handleMouseWheel(event) {
        handleZoom(getAbsoluteCursorPosition(canvas, event), event.deltaY);
        event.preventDefault();
    }

    canvas.addEventListener("DOMMouseScroll", handleMouseWheel, false); // for Firefox
    canvas.addEventListener('wheel', handleMouseWheel, false);
}


function draw(coords, viewX, viewY, viewWidth, viewHeight) {

    const bg_color = getComputedStyle(document.body).getPropertyValue('--base00');
    const cell_color = getComputedStyle(document.body).getPropertyValue('--base05');

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bg_color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let screenWidth = canvas.width;
    let screenHeight = canvas.height;

    updateNumericElem(windowXElem, viewX);
    updateNumericElem(windowYElem, viewY);

    updateNumericElem(windowWidthElem, viewWidth);
    updateNumericElem(windowHeightElem, viewHeight);

    let dpr = window.devicePixelRatio || 1;
    cellWidth = screenWidth / viewWidth / dpr;
    cellHeight = screenHeight / viewHeight / dpr;

    // console.log(cellWidth, cellHeight);

    ctx.fillStyle = cell_color;

    coords.forEach(coord => {
        let x_adj = (coord.x - viewX) * cellWidth;
        let y_adj =  (coord.y - viewY) * cellHeight;
        ctx.fillRect(x_adj, y_adj, cellWidth, cellHeight);
    });

    function findPattern(target, coords) {
        let cmap = {};
        coords.forEach(c => {
            cmap[[c.x, c.y]] = true;
        });
        
        coords.forEach(c => {
            let matches = true;
            for (let i = 0; i < target.length; i++) {
                if (cmap[[c.x + target[i].x, c.y + target[i].y]] !== true) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                ctx.strokeStyle = "red";
                ctx.beginPath();
                let x_adj = (c.x - viewX) * cellWidth;
                let y_adj =  (c.y - viewY) * cellHeight;
                ctx.rect(x_adj, y_adj, 3 * cellWidth, 3 * cellHeight);
                ctx.stroke();
            }
        });
    }

    let block_pat = [
        {x: 0, y: 0},
        {x: 1, y: 0},
        {x: 2, y: 0},
        {x: 2, y: 1},
        {x: 1, y: 2},
    ];

}

var frameCounter = 0;
var iterationCounter = 0;

var last_poll_time = undefined;

function statsLoop() {
    const polling_time = 3;
    setTimeout(statsLoop, 1000 * polling_time);
    window.requestAnimationFrame(_ => {
        if (last_poll_time !== undefined) {
            let timeDelta = performance.now() - last_poll_time;
            let measuredFrameRate = frameCounter * 1000 / timeDelta;
            let measuredIterationRate = iterationCounter * 1000 / timeDelta;
            updateNumericElem(fpsCounterElem, measuredFrameRate);
            updateNumericElem(ipsCounterElem, measuredIterationRate);
            frameCounter = 0;
            iterationCounter = 0;
        }
        last_poll_time = performance.now();
    });
}


function universeLoop() {
    let targetIts = parseInt(ipsInput.value);
    let targetItStep = parseInt(iterationStepInput.value)
    console.log(targetItStep);
    const its = targetIts;
    const step_size = targetItStep;

    setTimeout(universeLoop, 1000 / (its));
    window.requestAnimationFrame(_ => {
        uni.advance(step_size);
        iterationCounter += step_size;
    });
}


function drawLoop() {
    let targetFPS = parseInt(fpsInput.value);

    const fps = targetFPS;
    // Begin recursive loop
    setTimeout(drawLoop, 1000 / (fps));
    window.requestAnimationFrame(_ => {
        let currWindow = {
            viewX: viewX,
            viewY: viewY,
            viewWidth: viewWidth,
            viewHeight: viewHeight
        };
        let coords = unpack_coords(uni.coords(viewX, viewY, viewX + viewWidth, viewY + viewHeight));
        draw(coords, viewX, viewY, viewWidth, viewHeight);
        frameCounter += 1;
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
    return {
        width: width,
        height: height,
        coords: coords
    };

}


let fileInputElem = document.getElementById('file-input');
fileInputElem.addEventListener('change', (event) => {
    const file = event.target.files[0];
    let fReader = new FileReader();
    fReader.onload = function() {
        let patternData = parseRle(fReader.result);
        console.log('Parsed RLE:', patternData);
        patternData.coords.forEach(coord => {
            uni.set(coord.x, coord.y);
        });
        // let pc = pack_coords(patternData.coords);
        console.log('got pc')
        // uni.set_bulk(pc);
        console.log('starting render loop');
        universeLoop();
    }
    fReader.readAsText(file);
});

function loadPatternFromUrl(url){
    // read text from URL location
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            var type = request.getResponseHeader('Content-Type');
            if (type.indexOf("text") !== 1) {
                let patternData = parseRle(request.responseText);
                
                let dim = Math.max(patternData.width, patternData.height) * 2;
                console.log(patternData);

                patternData.coords.forEach(coord => {
                    uni.set(coord.x, coord.y);
                });
                console.log('starting render loop');
                universeLoop();
            }
        }
    }
}

// document.getElementById('sidebarToggle').onclick = function(evt) {
//     console.log('Toggle sidebar');

// };

document.getElementById('sidebarToggle').onclick = toggleSidebar;
document.getElementById('themeToggle').onclick = toggleThemePopup;
initSidebar();
initializeThemes();


var uni = Universe.new(0, 0);

// uni.set(4, 6);
// uni.set(5, 6);
// uni.set(5, 4);
// uni.set(7, 5);
// uni.set(8, 6);
// uni.set(9, 6);
// uni.set(10, 6);

const canvasElem = document.getElementById('canvas');
var resizeTimed;
window.onresize = () => {
    clearTimeout(resizeTimed);
    resizeTimed = setTimeout(() => {resizeCanvas(canvasElem)}, 150);
};
// resizeCanvas(canvasElem);
// window.onload = () => {resizeCanvas(canvasElem)};

// console.log(uni.root_level());
// console.log(unpack_coords(uni.coords(0, 0, 10, 10)));
// uni.advance(1);
// uni.advance(1);
// uni.advance(1);
// uni.advance(1);
// uni.advance(1);
// console.log(uni.root_level());
// console.log(unpack_coords(uni.coords(0, 0, 10, 10)));
drawLoop();
statsLoop();
// universeLoop();