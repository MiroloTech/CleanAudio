let canvas = document.getElementById("canvas");
let cover = document.getElementById("cover");

let max_height, startPos, vizWidth, vizHeight, midY, midX, lblY;

const bottomCap = 40;

let layout = 0;

let mainColor1 = {
    "r" : 226,
    "g" : 149,
    "b" : 120
};
let mainColor2 = {
    "r" : 255,
    "g" : 221,
    "b" : 210
};;
let bgColor1 = {
    "r" : 0,
    "g" : 109,
    "b" : 119
};;
let bgColor2 = {
    "r" : 131,
    "g" : 197,
    "b" : 190
};;
let outlineOnly = true;
let gradientMain = false;
let gradientBG = false;
let colorMode = 0;
let screenshake = 0.0;
let high_res = true;
let shadow = false;

let projType = 0;
let amplitude = 1.0;
let smoothing = 10.0;
let sampleCount = 10;
let sampleType = 0;

let finCols = [];

let title = "";
let artist = "";
let last_cover_data = "";

let gradient;
let BGgradient;

let colorThief = new ColorThief();

let ctx = canvas.getContext("2d");

// TODO : Update graduatly from right to left to give nice beat flow ( Maybe by shifting quieter tones at sample 1 step to the right. Then, the louder that sample gets, the more it moves to the left, to its intended position)
//        > Watch tutorial on how to make audio visualizer in Adobe AfterEffects
//        > Or Offset each sample based on difference to next sample
//        Prefer Accent colors with the most hue and bg colors with the least contrast / hue  ( Match colors with simmilar contrast, but most different saturation, value and hue)

function setSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    max_height = window.innerHeight * 0.25;
    startPos = window.innerWidth * 0.1;
    vizWidth = window.innerWidth * 0.8;
    vizHeight = window.innerHeight * 0.85;
    midY = canvas.height - canvas.height / 2;
    midX = canvas.width - canvas.width / 2;
}

window.onload = () => {
    setSize();
};

window.onresize = () => {
    setSize();
};

function livelyPropertyListener(name, val) {
    switch(name) {
        case "amplitude":
            amplitude = val;
            break;
        case "samples":
            sampleCount = val;
            break;
        case "highres":
            high_res = val;
            break;
        case "smoothing":
            smoothing = val;
            break;
        case "colorMode":
            colorMode = val;
            break;
        case "mainColor1":
            mainColor1 = hexToRgb(val);
            break;
        case "mainColor2":
            mainColor2 = hexToRgb(val);
            break;
        case "bgColor1":
            bgColor1 = hexToRgb(val);
            break;
        case "bgColor2":
            bgColor2 = hexToRgb(val);
            break;
        case "outlineOnly":
            outlineOnly = val;
            break;
        case "gradient":
            gradientMain = val;
            break;
        case "gradientBG":
            gradientBG = val;
            break;
        case "ProjType":
            projType = val;
            break;
        case "screenshake":
            screenshake = val;
            break;
        case "shadow":
            shadow = val;
            break;
        case "layout":
            layout = val;
            break;
    }
}


let time = 0.0;

let activeArr = []
function livelyAudioListener(audioArray) {
    /* SCREENSHAKE */
    let pos_offset = [0, 0];
    let noise_ferq = 0.4;
    if (screenshake > 0.0) {
        let bass = 0.0;
        for (let i = 0; i < 25; i++){ bass += audioArray[i] * amplitude * screenshake; }
        bass = bass * bass;
        
        pos_offset = [
            noise(time * noise_ferq) * bass,
            noise(10000.0 + time * noise_ferq) * bass,
        ];
    }
    
    time += 0.01;
    
    /* COLORS */
    /*
    if ( last_cover_data != "" ) {
        setColorDataShit(last_cover_data)
    }*/
    
    if ( cover.src == null ) {
        finCols = setColorsToPicked()
    } else {
        try {
            col = colorThief.getPalette(cover, 8);
            // col.unshift(colorThief.getColor(cover));
            switch(colorMode) {
                case 0: // cover
                    finCols = doColorStuff(col);
                    break;
                case 1: // magic
                    finCols = colorMagic(col);
                    break;
                case 2: // random
                    finCols = generatedColors();
                    break;
                case 3: // custom
                    finCols = setColorsToPicked()
                    break;
                default: // random
                    finCols = generatedColors();
                    break;
            }
        } catch (_err) {
            finCols = setColorsToPicked()
        }
    }
    
    linesColor = finCols[0];
    backgroundColor = finCols[1];
    
    /* AUDIO ARRAY */
    // Smooth Audio Array
    while (activeArr.length < audioArray.length) { activeArr.push(0.0); }
    for (let i = 0; i < audioArray.length; i++) {
        activeArr[i] = lerp(activeArr[i], audioArray[i], smoothing * 0.05);
    }
    
    // BG
    ctx.fillStyle = (gradientBG ? BGgradient : backgroundColor);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Setter
    let start = startPos;
    let end = startPos + vizWidth;
    
    
    // Modify Array for Caps and correct sampling type and scaling
    let arr = [0.0];
    let arrx = [0.0];
    let interval = Math.floor(activeArr.length / sampleCount);
    
    // Sample
    for (let i = 0; i < activeArr.length - interval; i += interval) {
        let a = i;
        let b = i + interval;
        let val = 0.0;
        
        // Average
        for (let j = a; j < b; j++) {
            let id = j;
            if (projType == 1) { id = bassProjFn(j, activeArr.length); }
            val = Math.max(val, activeArr[id]);
        }
        
        let xp = parseFloat(i) / parseFloat(activeArr.length);
        let yp = val;
        
        arr.push(yp);
        arrx.push(xp);
    }
    
    arr.push(0.0);
    arrx.push(1.0);
    
    
    // Bezier Test
    // let sample_points = 2;
    let BEZIER_RES = high_res ? 35 : 15;
    let SAMPLES = sampleCount;
    
    
    // Move first point to be more clean, yk
    arrx[0] = arrx[1] - (1.0 / SAMPLES);
    
    
    let pts = []
    
    ctx.beginPath();
    ctx.lineJoin = "round";
    ctx.moveTo(startPos, midY);
    
    
    // Compute
    // TODO : Precompute every point and then calculate smoothing bezier arms
    for (let i = 0; i < SAMPLES; i++) {
        let progFrom = parseFloat(i+0)   / parseFloat(SAMPLES);
        let progTo   = parseFloat(i+1)   / parseFloat(SAMPLES);
        
        // let prog0    = parseFloat(Math.max(i-1), 0)         / parseFloat(SAMPLES);
        // let prog3    = parseFloat(Math.min(i+2), SAMPLES)   / parseFloat(SAMPLES);
        
        let posFrom = (layout == 0) ?  lerp(start, end, progFrom)  : (lerp(0, canvas.width, progFrom));
        let posTo   = (layout == 0) ?  lerp(start, end, progTo)    : (lerp(0, canvas.width, progTo));
        
        //let valFrom = Math.floor(progTo      * (arr.length-1));
        //let valTo =   Math.floor(prog3       * (arr.length-1));
        
        let valFrom = Math.floor(progFrom      * (arr.length-1));
        let valTo =   Math.floor(progTo        * (arr.length-1));
        
        // let val0 = Math.floor(prog0 * (arr.length-1));
        // let val3 = Math.floor(prog3 * (arr.length-1));
        // TODO : Set Arm height to average of samples left and right by offset ( 5 - 0 - 5)
        //                                                                        10  16  12
        let x1 = posFrom;
        let x2 = posTo;
        // TODO : Get Max at sample point
        let y1 = arr[valFrom] * amplitude * max_height;
        let y2 = arr[valTo]   * amplitude * max_height;
        
        // TODO : try calculating bezier handles with next and previous audio array points
        let y0 = y1; // arr[val0]    * amplitude * max_height;
        let y3 = y2; // arr[val3]    * amplitude * max_height;
        // let div = valTo - valFrom;
        
        // Get average volume at sample range
        /*
        let y1 = 0.0;
        for (let k = valFrom; k < valFrom + div; k++) {
            // y1 += arr[i];
            y1 = Math.max(y1, arr[k]);
        }// y1 /= parseFloat(div);
        let y2 = 0.0;
        for (let k = valTo; k < valTo + div; k++) {
            // y2 += arr[i];
            y2 = Math.max(y2, arr[k]);
        }// y2 /= parseFloat(div);
        
        y1 *= amplitude * max_height;
        y2 *= amplitude * max_height;
        
        // Cap volumes at end
        if (i == 0) {
            y1 = 0.0;
        }
        if (i == SAMPLES-1) {
            y2 = 0.0;
        }
        */
        
        // TODO : Make seperate function
        //        Make it work with multiple sample points
        for (let j = 0; j < BEZIER_RES; j++) {
            let t = parseFloat(j) / parseFloat(BEZIER_RES);
            let aM = lerp(x1, x2, 0.5); // Arm Middle
            let p0 = [x1, y1];
            let p1 = [aM, y0]; // arm left to right   // Add y0 and y3 calculation here   0
            let p2 = [aM, y3]; // arm right to left   // Add y0 and y3 calculation here   3
            let p3 = [x2, y2];
            
            
            let px = Math.pow(1-t,3)*p0[0] + 3*t*Math.pow(1-t,2)*p1[0] + 3*t*t*(1-t)*p2[0] + t*t*t*p3[0];
            let py = Math.pow(1-t,3)*p0[1] + 3*t*Math.pow(1-t,2)*p1[1] + 3*t*t*(1-t)*p2[1] + t*t*t*p3[1];
            
            py = Math.max(0.0, py); // Clamp to be at least 0
            
            // if (py < 5.0) { py = 0.0; }
            
            // ctx.lineTo(px, py);
            pts.push([px, py]);
        }
    }
    
    
    /*
    >> Alternative Interpolation Method using Easing
    
    if (false) {
        let NEIGHBORS = 10; // Neighbors to scan left & right
        let RES = 10; // Steps between two sample points
        
        for (let i = 0; i < arr.length * RES; i++) {
            let pos = parseFloat(i) / parseFloat(RES);
            let fpos = Math.floor(pos); // flat
            let v = 0;
            for (let j = -NEIGHBORS; j < NEIGHBORS; j++) {
                let p = Math.min(Math.max(pos + j, 0), arr.length); // Clamp
                
                let prev = arr[Math.floor(p)];
                let next = arr[Math.ceil(p)];
                let fract = p - Math.trunc(p);
                let rv = lerp(prev, next, easeInOutQuint(fract)); // TODO : Use easeing / smooth lerp function
                v += rv;
            }
            
            let px = lerp(start, end, parseFloat(fpos) / parseFloat(arr.length));
            
            if (i == 0) { v = 0; }
            let py = v * amplitude * max_height * 0.1;
            pts.push([px, py]);
        }
    }
    */
    
    
    
    
    BGgradient = ctx.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
    BGgradient.addColorStop(0, finCols[1]);
    BGgradient.addColorStop(1, finCols[4]);
    
    gradient = ctx.createLinearGradient(0, 0, Math.max(window.innerWidth, window.innerHeight), Math.max(window.innerWidth, window.innerHeight));
    gradient.addColorStop(0, finCols[0]);
    gradient.addColorStop(1, finCols[3]);
    
    
    
    // Shadows
    let shadow_pslit_colors = finCols[1].replace("rgb(", "").replace("rgba(", "").replace(")", "").replace(" ", "").split(",");
    let sr = parseInt(shadow_pslit_colors[0]);
    let sg = parseInt(shadow_pslit_colors[1]);
    let sb = parseInt(shadow_pslit_colors[2]);
    let sd = parseFloat((sr + sg + sb) / 3) / 255.0;
    const shadow_darkening = parseInt( lerp(0, 150, Math.pow(sd, 1.6)) );
    let shadow_col = `rgb(${sr - shadow_darkening}, ${sg - shadow_darkening}, ${sb - shadow_darkening})`;
    
    if (shadow) {
        ctx.shadowColor = shadow_col;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 28;
        ctx.shadowOffsetY = 22;
    } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0)';
        ctx.shadowColor = null;
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    
    
    // Draw Lines
    // Bottom
    if (layout == 0) {
        ctx.beginPath();
        ctx.lineJoin = "round";
        ctx.moveTo(startPos + pos_offset[0], midY + pos_offset[1]);
        
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            ctx.lineTo(p[0] + pos_offset[0], midY + p[1] + pos_offset[1]);
        }
        
        // Top
        // ctx.moveTo(startPos + pos_offset[0], midY + pos_offset[1]);
        for (let i = pts.length-1; i >= 0; i--) {
            let p = pts[i];
            ctx.lineTo(p[0] + pos_offset[0], midY - p[1] + pos_offset[1]);
        }
        
        
        if (outlineOnly) {
            ctx.shadowBlur = 10.0;
            ctx.shadowColor = gradientMain ? gradient : linesColor;
            
            ctx.lineWidth = 5;
            ctx.strokeStyle = gradientMain ? gradient : linesColor;
            ctx.stroke();
        }
        else {
            ctx.shadowBlur = 10.0;
            ctx.fillStyle = gradientMain ? gradient : linesColor;
            ctx.fill();
        }
        
        // Song Data
        ctx.textAlign = "center";
        // BG
        ctx.fillStyle = gradientMain ? gradient : linesColor; // gradientMain ? gradient : linesColor
        ctx.strokeStyle = gradientBG ? BGgradient : backgroundColor; // gradientMain ? gradient : linesColor
        ctx.lineWidth = 4.0;
        
        ctx.font = "700 48px Verdana";
        ctx.strokeText(title, midX + pos_offset[0], vizHeight + pos_offset[1]);
        ctx.fillText(title, midX + pos_offset[0], vizHeight + pos_offset[1]);
        ctx.font = "300 32px Verdana";
        ctx.strokeText(artist, midX + pos_offset[0], vizHeight + 72 + pos_offset[1]);
        ctx.fillText(artist, midX + pos_offset[0], vizHeight + 72 + pos_offset[1]);
    } else if (layout == 1) {
        ctx.beginPath();
        ctx.lineJoin = "round";
        ctx.moveTo(startPos + pos_offset[0], 0);
        
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            ctx.lineTo(p[0] + pos_offset[0], p[1]*0.5);
        }
        
        // Top
        ctx.moveTo(canvas.width, canvas.height);
        
        for (let i = pts.length-1; i >= 0; i--) {
            let p = pts[i];
            ctx.lineTo(p[0] + pos_offset[0], canvas.height - p[1]*0.5 - bottomCap);
        }
        
        
        if (outlineOnly) {
            ctx.shadowBlur = 10.0;
            ctx.shadowColor = gradientMain ? gradient : linesColor;
            
            ctx.lineWidth = 5;
            ctx.strokeStyle = gradientMain ? gradient : linesColor;
            ctx.stroke();
        }
        else {
            ctx.shadowBlur = 10.0;
            ctx.fillStyle = gradientMain ? gradient : linesColor;
            ctx.fill();
        }
        
        
        // Song Data
        ctx.textAlign = "center";
        // BG
        ctx.fillStyle = gradientMain ? gradient : linesColor; // gradientMain ? gradient : linesColor
        ctx.strokeStyle = gradientBG ? BGgradient : backgroundColor; // gradientMain ? gradient : linesColor
        ctx.lineWidth = 4.0;
        
        ctx.font = "700 48px Verdana";
        ctx.strokeText(title, midX + pos_offset[0], canvas.height / 2.0 + pos_offset[1]);
        ctx.fillText(title, midX + pos_offset[0], canvas.height / 2.0 + pos_offset[1]);
        ctx.font = "300 32px Verdana";
        ctx.strokeText(artist, midX + pos_offset[0], canvas.height / 2.0 + 72 + pos_offset[1]);
        ctx.fillText(artist, midX + pos_offset[0], canvas.height / 2.0 + 72 + pos_offset[1]);
    }
        
    
    // Bottom Bar for better readabillity
    ctx.fillStyle = finCols[2] ? (gradientBG ? BGgradient : backgroundColor) : (gradientMain ? gradient : linesColor);
    ctx.fillRect(0, window.innerHeight-bottomCap, window.innerWidth, bottomCap);
}






function livelyCurrentTrack(data) {
    if ( data == "" ) { return }
    setColorDataShit(data)
    last_cover_data = data
}

// Set all visual data, based on the given .json data
function setColorDataShit(data) {
    let obj = JSON.parse(data);
    if (obj != null) {
        // console.log(data)
        
        if (obj.Thumbnail != null) {
            cover.src = "data:image/png;base64, " + obj.Thumbnail;
        } else {
            cover.src = null
        }
        
        if (obj.Title != null) {
            title = obj.Title;
        }
        if (obj.Artist != null) {
            artist = obj.Artist;
        }
        
    } else {
        cover.src = null
        title = "ERROR"
        artist = "..."
    }
    
    
}



// ID COnversions
function bassProjFn(i, l) {
    return Math.floor( ( Math.pow(parseFloat(i) / parseFloat(l), 2.0) ) * l );
}

// EASINGS
// In Put Quint
function easeInOutQuint(x) {
    return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}


//ref: https://stackoverflow.com/questions/9733288/how-to-programmatically-calculate-the-contrast-ratio-between-two-colors
function luminance(r, g, b) {
    var a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrast(rgb1, rgb2) {
    // let hsv1 = rgbToHsv(rgb1);
    // let hsv2 = rgbToHsv(rgb2);
    let lum1 = luminance(rgb1[0], rgb1[1], rgb1[2]);
    let lum2 = luminance(rgb2[0], rgb2[1], rgb2[2]);
    let brightest = Math.max(lum1, lum2);
    let darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// TODO : Add setting , where you can select the amount of influence the music cover has on the visualizer ( colors ) > full, suggesive, generated

function setColorsToPicked() {
    return [
        `rgb(${mainColor1.r}, ${mainColor1.g}, ${mainColor1.b})`,
        `rgb(${bgColor1.r}, ${bgColor1.g}, ${bgColor1.b})`,
        (bgValue([mainColor1.r, mainColor1.g, mainColor1.b]) > bgValue([bgColor1.r, bgColor1.g, bgColor1.b])),
        `rgb(${mainColor2.r}, ${mainColor2.g}, ${mainColor2.b})`,
        `rgb(${bgColor2.r}, ${bgColor2.g}, ${bgColor2.b})`
    ];
}

function doColorStuff(color) {
    let mainColor = color[1]; // assume
    let minc = 0;
    for (let i = 1; i < color.length; i++) {
        let c = rgbToHsv(color[i])
        let tmp = contrast(mainColor, c); // (Math.abs(c[0] - rgbToHsv(mainColor)[0])) + ( c[1] + c[2] ) * 0.75;
        if (tmp > minc) {
            minc = tmp;
            mainColor = color[i];
        }
    }
    
    let bgColor = color[0]; // assume
    if (bgColor == mainColor) {
        bgColor = color[1];
    }
    
    if (rgbDifference(mainColor, bgColor) < 0.07) {
        let mincs = 0;
        for (let i = 0; i < color.length; i++) {
            // let c = rgbToHsv(color[i]);
            let tmp = contrast(mainColor, color[i]); // (Math.abs(c[0] - rgbToHsv(mainColor)[0])) + ( c[1] + c[2] ) * 0.75;
            if (tmp > mincs && tmp > 0.01) {
                mincs = tmp;
                bgColor = color[i];
            }
        }
    }
    
    let simmilarColor = mainColor; // assume
    let mincs = 1.0;
    for (let i = 1; i < color.length; i++) {
        let tmp = rgbDifference(mainColor, color[i]);
        if (tmp < mincs && tmp > 0.03) {
            mincs = tmp;
            simmilarColor = color[i];
        }
    }
    
    let simmilarColorBG = bgColor; // assume
    let mincsbg = 1.0;
    for (let i = 0; i < color.length; i++) {
        let tmp = rgbDifference(bgColor, color[i]);
        if (tmp < mincsbg && tmp > 0.03) {
            mincsbg = tmp;
            simmilarColorBG = color[i];
        }
    }
    
    
    let darkColor = bgValue(mainColor) > bgValue(bgColor);
  
    // [0] > gradient > [3]  ,  [1] show background at bottom true / false  ,  [2] darker Main / BG  ,  [1] > gradient > [4]
    return [`rgb(${mainColor.toString()}`, `rgb(${bgColor.toString()}`, darkColor, `rgb(${simmilarColor.toString()}`, `rgb(${simmilarColorBG.toString()}`];
}


/* Returns 2 color gradients based on 1 selected main color */
function colorMagic(color) {
    // Get most interesting color
    let mainA = [0, 0, 0];
    let mainA_interest = 0.0;
    
    for (let i = 0; i < color.length; i++) {
        let c = color[i];
        let chsv = rgbToHsv(color[i]);
        let interest = (chsv[1] * 2.5) * chsv[2] * 1.7;
        // TODO : interest should get multiplier if there's another color of similar ( hue and value ) in 'color' array
        
        // Quantitiy multiplier
        let quant = 1.0;
        for (let j = 0; j < color.length; j++) {
            let c2 = color[i];
            let diff = ( Math.abs(c[0] - mainA[0]) + Math.abs(c[1] - mainA[1]) + Math.abs(c[2] - mainA[2]) ) / 3.0 / 256.0;
            quant += diff < 0.25 ? diff : 0.0;
        }
        interest *= quant;
        
        if (interest > mainA_interest) {
            mainA = c;
            mainA_interest = interest;
        }
    }
    
    // Get BG Color
    // Select as BG color if contrast OR colorshift big enough
    let bgA = [0, 0, 0];
    let bgA_contrast = 0.0;
    let bgA_shift = 0.0;    // Closest distance to complimentary hue of main color
    
    for (let i = 0; i < color.length; i++) {
        let c = color[i];
        let chsv = rgbToHsv(color[i]);
        let ctr = contrast(mainA, c);
        let shift = Math.abs( (( rgbToHsv(c)[0] + 180 ) % 360 ) - ( chsv[0] ) ) ;
        
        if (ctr > bgA_contrast || shift > bgA_shift) {
            bgA = c;
            bgA_contrast = ctr;
            bgA_shift = shift;
        }
    }
    
    
    // Get gradient colors
    let mainB =      [0, 0, 0];
    let mainBDiff =  1.0;
    let bgB =        [0, 0, 0];
    let bgBDiff =    1.0;
    
    // Find colors most simmilar to main and bg
    // TODO : Make gradient function 2.0 . focusing on more color contrast
    for (let i = 0; i < color.length; i++) {
        let c = color[i];
        let chsv = rgbToHsv(c);
        
        if (c != mainA) {
            let diff = ( Math.abs(c[0] - mainA[0]) + Math.abs(c[1] - mainA[1]) + Math.abs(c[2] - mainA[2]) ) / 3.0 / 256.0;
            if (diff < mainBDiff) {
                mainBDiff = diff;
                mainB = c;
            }
        }
        
        if (c != bgA) {
            let diff = ( Math.abs(c[0] - bgA[0]) + Math.abs(c[1] - bgA[1]) + Math.abs(c[2] - bgA[2]) ) / 3.0 / 256.0;
            if (diff < bgBDiff) {
                bgBDiff = diff;
                bgB = c;
            }
        }
    }
    
    let isBorderMain = bgValue(mainA) > bgValue(bgA);
    
    
    
    return [`rgb(${mainA.toString()}`, `rgb(${bgA.toString()}`, isBorderMain, `rgb(${mainB.toString()}`, `rgb(${bgB.toString()}`];
}

let mainColorGen = [0, 0, 0];
let bgColorGen = [0, 0, 0];
let similarMainColorGen = [0, 0, 0];
let similarBgColorGen = [0, 0, 0];
let lastTitle = "";
function generatedColors() {
    // [0] > gradient > [3]  ,  [2] show background at bottom true / false  ,  [1] > gradient > [4]
    // return [`rgb(${mainColor.toString()}`, `rgb(${bgColor.toString()}`, darkColor, `rgb(${simmilarColor.toString()}`, `rgb(${simmilarColorBG.toString()}`];
    if (lastTitle != title) {
        mainColorGen = hsvToRgb([Math.floor(Math.random() * 256), 128 + Math.floor(Math.random() * 128), 128 + Math.floor(Math.random() * 128)]);
        bgColorGen = hsvToRgb([mainColorGen[0] + Math.floor((Math.random()*2-1) * 10), 5 + Math.floor(Math.random() * 85), 5 + Math.floor(Math.random() * 85)]);
        
        similarMainColorGen = hsvToRgb([(mainColorGen[0] + Math.floor((Math.random()*2-1) * 15)) % 256, mainColorGen[1], mainColorGen[2]]);
        similarBgColorGen =   hsvToRgb([(bgColorGen[0]   + Math.floor((Math.random()*2-1) * 15)) % 256,   bgColorGen[1],   bgColorGen[2]]);
    }
    
    lastTitle = title;
    
    
    return [`rgb(${mainColorGen.toString()}`, `rgb(${bgColorGen.toString()}`, true, `rgb(${similarMainColorGen.toString()}`, `rgb(${similarBgColorGen.toString()}`];
}



function rgbToHsv(rgb) {
    let r = rgb[0] / 255,
        g = rgb[1] / 255,
        b = rgb[2] / 255,
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        delta = max - min,
        h, s, v = max;

    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
            case g: h = (b - r) / delta + 2; break;
            case b: h = (r - g) / delta + 4; break;
        }
        h *= 60; // degrees
    }

    s = max === 0 ? 0 : delta / max;
    v = max; // max is already in the range 0-1

    return [Math.round(h), Math.round(s * 255), Math.round(v * 255)];
}

function hsvToRgb(hsv) {
    let [h, s, v] = hsv;
    h = h * 360 / 255; // Convert h from 0-255 to 0-360 degrees
    s /= 255; // Convert s from 0-255 to 0-1
    v /= 255; // Convert v from 0-255 to 0-1

    let r, g, b;

    let i = Math.floor(h / 60);
    let f = h / 60 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    // Convert r, g, b from 0-1 to 0-255
    r = Math.round(r * 255);
    g = Math.round(g * 255);
    b = Math.round(b * 255);

    return [r, g, b];
}

function bgValue(col) {
    return (col[0] + col[1] + col[2]) / 3.0 / 255.0;
}

function rgbDifference(rgb1, rgb2) {
    let hsv1 = rgbToHsv(rgb1);
    let hsv2 = rgbToHsv(rgb2);
    
    // Calculate the squared differences for each color component
    let deltaR = Math.pow(rgb1[0] - rgb2[0], 2);
    let deltaG = Math.pow(rgb1[1] - rgb2[1], 2);
    let deltaB = Math.pow(rgb1[2] - rgb2[2], 2);
    // let deltaS = Math.pow(hsv1[1] - hsv2[1], 2);
    
    // Calculate the Euclidean distance between the two colors
    let distance = Math.sqrt(deltaR + deltaG + deltaB); // + deltaS
    
    // Normalize the distance to a 0.0 - 1.0 scale
    // The maximum possible distance is sqrt(3 * 255^2), since RGB values range from 0 to 255
    let maxDistance = Math.sqrt(3 * Math.pow(255, 2));
    let normalizedDistance = distance / maxDistance;
    
    return normalizedDistance;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}



function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, weight) {
    return a * (1.0 - weight) + b * weight;
}

function noise(x) {
    x *= 100.0;
    
    let a = Math.sin(x * 1.5 +   25.9   );
    let b = Math.sin(x * 3.9 +   4.0    );
    let c = Math.sin(x * 11  +   187.69 );
    let d = Math.sin(x * 29  +   10.2   );
    let e = Math.sin(x * 58  +   0.0    );
    
    return ( a + b + c + d + e ) / 5.0;
}
