/*jshint esversion: 8 */

// Global variables

let testLengthX = 30;
let testLengthY = 10;
let testHeightZ = 20;

// Declaring global printer dimensions
let bedSizeX;
let bedSizeY;
let nozzleWidth;
let bedMargin;

// Declaring global printer parameters
let travelSpeed;
let primeSpeed;
let primeFlowRate;
let bedTemp;
let retractLength = 5;

// Declaring global flow test parameters
let flowStart;
let flowEnd;
let flowSteps;
let flowLength;
let flowIsFB;
let tempStart;
let tempEnd;
let tempSteps;

// --------------------
//      Main code
// --------------------

// Max volumetric speed = Layer Height × Extrusion Width × Speed
// cylinder volume = π * r^2 * h
// cylinder h = V / π * r^2

async function mainFunction() {

    let resultString = "";

    // Reading printer parameters
    bedSizeX = Number(document.getElementById("bedSizeY").value);
    bedSizeY = Number(document.getElementById("bedSizeY").value);
    nozzleWidth = Number(document.getElementById("nozzleWidth").value);
    bedMargin = Number(document.getElementById("bedMargin").value);
    travelSpeed = Number(document.getElementById("travelSpeed").value);
    primeSpeed = Number(document.getElementById("primeSpeed").value);
    primeFlowRate = Number(document.getElementById("primeFlowRate").value);
    bedTemp = Number(document.getElementById("bedTemp").value);

    // Reading flow test parameters
    flowStart = Number(document.getElementById("flowStart").value);
    flowEnd = Number(document.getElementById("flowEnd").value);
    flowSteps = Number(document.getElementById("flowSteps").value);
    flowLength = Number(document.getElementById("flowLength").value);
    flowIsFB = document.getElementById("flowDirectionFB").checked;
    tempStart = Number(document.getElementById("tempStart").value);
    tempEnd = Number(document.getElementById("tempEnd").value);
    tempSteps = Number(document.getElementById("tempSteps").value);

    // Calculating spacing between patterns
    let flowSpacing = (flowSteps > 1) ? ((bedSizeY - (2 * bedMargin) - testLengthY) / (flowSteps - 1)) : 0;
    let flowStepFlow = (flowSteps > 1) ? ((flowEnd - flowStart) / (flowSteps - 1)) : 0;
    let tempSpacing = (tempSteps > 1) ? ((bedSizeX - (2 * bedMargin) - testLengthX) / (tempSteps - 1)) : 0;
    let tempStepTemp = (tempSteps > 1) ? ((tempEnd - tempStart) / (tempSteps - 1)) : 0;

    testHeightZ = Math.min(Math.max((flowLength / 5), 10), 20); // Scales the test blob height between 10 and 20 mm

    let curCoordX = bedMargin;
    let curCoordY = bedMargin;
    let curFlow = flowStart;
    let curTemp = tempEnd;

    resultString += getIntroGCode();
    resultString += getStartGCode();

    for (let itemp = 0; itemp < tempSteps; itemp++) {

        curCoordX = bedMargin + (tempSpacing * itemp);
        curTemp = (tempEnd - (tempStepTemp * itemp));

        resultString += "; temperature change before new pattern" + "\n";
        resultString += `M109 R${curTemp} ; set and wait for hotend temperature, marlin` + "\n";
        resultString += `M109 S${curTemp} ; set and wait for hotend temperature, klipper` + "\n";
        resultString += "\n";

        for (let iflow = 0; iflow < flowSteps; iflow++) {

            curCoordY = flowIsFB ? (bedMargin + (flowSpacing * iflow)) : (bedSizeY - bedMargin - testLengthY - (flowSpacing * iflow));
            curFlow = flowStart + (flowStepFlow * iflow);

            resultString += "; --------------------------------------------------" + "\n";
            resultString += "; starting pattern " + ((itemp * flowSteps) + (iflow + 1)) + " of " + (flowSteps * tempSteps) + "\n";
            resultString += "; flow: " + curFlow + "mm3, " + "temperature: " + curTemp + "C" + "\n";
            resultString += "; starting position: " + curCoordX.toFixed(3) + "x " + curCoordY.toFixed(3) + "y" + "\n";
            resultString += "; --------------------------------------------------" + "\n";
            resultString += "\n";

            resultString += getTestPattern(curCoordX, curCoordY, curFlow);
            resultString += "\n";
        }
    }

    resultString += getEndGCode();

    // Display the results
    document.getElementById("showResult").innerHTML = "<textarea readonly cols=64 rows=32 id=\"resultString\">" + resultString + "</textarea>";
    document.getElementById("showResultCopyText").innerHTML = "<input class=\"submitbutton\" type=\"button\" onclick=\"copyGCode()\" value=\"Copy GCode\">";

}

function getTestPattern(pCoordX, pCoordY, pFlow) {
    let testPattern = "";
    let curX = pCoordX;
    let curY = pCoordY;
    let curZ = (nozzleWidth / 2);
    let curE = 0;

    // Use whichever of the speed or flow rate is the smallest
    let primeFlowSpeed = Math.min((primeFlowRate / ((nozzleWidth) * nozzleWidth * 3)), primeSpeed);

    // Numbers of lines required to prime 10mm of filament
    let primingLines = Math.ceil(10 / getExtrusionLength(testLengthY, (nozzleWidth * 3), nozzleWidth));

    // Feed rate to use for the test extrusion move
    let testFeedRate = (testHeightZ / (flowLength / (pFlow / (Math.PI * Math.pow((1.75 / 2), 2))))) * 60;

    // Move to the test location's priming zone
    testPattern += getGCodeLineTravel(curX, curY, (travelSpeed * 60)) + " ; move to flow test start position" + "\n";
    testPattern += `G1 Z${curZ.toFixed(3)} F${(travelSpeed*60).toFixed(3)} ; move to flow test z start position` + "\n";
    testPattern += "G92 E0 ; reset extrusion distance" + "\n";

    // Printing speed
    testPattern += "G1 F" + (primeFlowSpeed * 60).toFixed(3) + " ; priming feedrate" + "\n";

    // spacing = extrusion_width - layer_height * (1 - PI/4)
    // https://manual.slic3r.org/advanced/flow-math

    for (let i = 0; i < primingLines / 2; i++) {

        // First priming line
        curY += testLengthY;
        curE += getExtrusionLength(testLengthY, (nozzleWidth * 3), nozzleWidth);
        testPattern += getGCodeLine(curX, curY, curE) + " ; priming line up" + "\n";
        curX += (nozzleWidth * 3) - (nozzleWidth) * (1 - Math.PI / 4);
        testPattern += getGCodeLine(curX, curY, curE) + " ; priming line up" + "\n";

        // Second priming line
        curY -= testLengthY;
        curE += getExtrusionLength(testLengthY, (nozzleWidth * 3), nozzleWidth);
        testPattern += getGCodeLine(curX, curY, curE) + " ; priming line down" + "\n";
        curX += (nozzleWidth * 3) - (nozzleWidth) * (1 - Math.PI / 4);
        testPattern += getGCodeLine(curX, curY, curE) + " ; priming line down" + "\n";
    }

    for (let i = 0; i < 4; i++) {

        // First wipe line
        curY += testLengthY;
        curX += nozzleWidth;
        testPattern += getGCodeLine(curX, curY, curE) + " ; wipe line up" + "\n";

        // Second wipe line
        curY -= testLengthY;
        curX += nozzleWidth;
        testPattern += getGCodeLine(curX, curY, curE) + " ; wipe line down" + "\n";
    }

    // Move to the actual extrusion test location
    curX = pCoordX + testLengthX - (testLengthY / 2);
    curY = pCoordY;
    testPattern += getGCodeLineTravel(curX, curY, (travelSpeed * 60)) + " ; move to flow test start position" + "\n";
    testPattern += "G1 F" + testFeedRate.toFixed(3) + " ; flow test feedrate" + "\n";

    // Perform the actual extrusion test
    curE += flowLength;
    curZ += testHeightZ;
    testPattern += "G1 Z" + curZ.toFixed(3) + " E" + curE.toFixed(5) + " ; flow test extrusion" + "\n";

    // Move out of the way before the next test
    curX += bedMargin;
    curY += flowIsFB ? bedMargin : -bedMargin;
    curZ += 5;
    curE -= retractLength;
    testPattern += `G1 E${curE.toFixed(5)} F${(travelSpeed*60).toFixed(3)} ; retract ${retractLength} mm` + "\n";
    testPattern += getGCodeLineTravel(curX, curY, (travelSpeed * 60)) + " ; move x and y axes" + "\n";
    testPattern += `G1 Z${curZ.toFixed(3)} F${(travelSpeed*60).toFixed(3)} ; move z axis` + "\n";

    return testPattern;
}

function getExtrusionLength(pMoveLength, pLineWidth = nozzleWidth, pLineHeight = (nozzleWidth / 2)) {
    return pMoveLength * pLineHeight * pLineWidth / Math.PI * Math.pow((1.75 / 2), 2);
}

function getGCodeLine(pX, pY, pE) {
    return "G1 X" + pX.toFixed(3) + " Y" + pY.toFixed(3) + " E" + pE.toFixed(5);
}

function getGCodeLineTravel(pX, pY, pF) {
    return "G1 X" + pX.toFixed(3) + " Y" + pY.toFixed(3) + " F" + pF.toFixed(3);
}

function getIntroGCode() {
    return `; --------------------------------------------------
;
; volumetric flow rate benchmark tool
; inspired by the work of Stefan Hermann @ CNC Kitchen
; found on https://github.com/CNCKitchen/ExtrusionSystemBenchmark
;
; author: Keven Duchesneau
; version: 0.1.0
; https://github.com/kevenduchesneau/VolumetricFlowBenchmark
;
; --------------------------------------------------

; bedSizeX: ${bedSizeX}
; bedSizeY: ${bedSizeY}
; bedMargin: ${bedMargin}
; nozzleWidth: ${nozzleWidth}
; travelSpeed: ${travelSpeed}
; primeFlowRate: ${primeFlowRate}
; primeSpeed: ${primeSpeed}
; bedTemp: ${bedTemp}
; flowStart: ${flowStart}
; flowEnd: ${flowEnd}
; flowSteps: ${flowSteps}
; flowLength: ${flowLength}
; flowIsFB: ${flowIsFB}
; tempStart: ${tempStart}
; tempEnd: ${tempEnd}
; tempSteps: ${tempSteps}

`;
}

function getStartGCode() {
    let primeFlowSpeed = 5 / (nozzleWidth * nozzleWidth);

    return `; --------------------------------------------------
; start gcode
; --------------------------------------------------

G21 ; set units to millimeters
G90 ; use absolute coordinates
M82 ; use absolute distances for extrusion
M140 S${bedTemp} ; set bed temperature
G28 ; home all axes
G1 Z5.000 F${(travelSpeed*60).toFixed(3)} ; move z axis 5 mm up
M190 S${bedTemp} ; wait for bed temperature
M109 R${tempEnd} ; set and wait for hotend temperature, marlin
M109 S${tempEnd} ; set and wait for hotend temperature, klipper

; --------------------------------------------------
; initial priming sequence
; --------------------------------------------------

G92 E0 ; reset extrusion distance
G1 X1.000 Y${bedMargin.toFixed(3)} Z${nozzleWidth.toFixed(3)} F${(travelSpeed*60).toFixed(3)} ; move to priming start position
G1 F${(primeFlowSpeed * 60).toFixed(3)} ; priming feedrate
G1 X1.000 Y${(bedSizeY-bedMargin).toFixed(3)} E${getExtrusionLength((bedSizeY-(2*bedMargin)), nozzleWidth, nozzleWidth).toFixed(5)} ; priming line up
G1 X${(1 + nozzleWidth).toFixed(3)} Y${(bedSizeY-bedMargin).toFixed(3)} ; priming line up
G1 X${(1 + nozzleWidth).toFixed(3)} Y${bedMargin.toFixed(3)} E${(getExtrusionLength((bedSizeY-(2*bedMargin)), nozzleWidth, nozzleWidth) * 2).toFixed(5)} ; priming line down
G92 E0 ; reset extrusion distance

`;
}

function getEndGCode() {
    return `; --------------------------------------------------
; end gcode
; --------------------------------------------------

G91 ; use relative coordinates
G1 Z5.000 F${(travelSpeed*60).toFixed(3)} ; move z axis 10 mm up
G1 E-5.000 F${(travelSpeed*60).toFixed(3)} ; retract 5 mm
G28 X0 Y0 ; home x and y axes
M106 S0 ; turn off cooling fan
M104 S0 ; turn off hot end temperature
M140 S0 ; turn off bed temperature
M84 ; turn off steppers

`;
}

function copyGCode() {
    navigator.clipboard.writeText(document.getElementById("resultString").value);
}
