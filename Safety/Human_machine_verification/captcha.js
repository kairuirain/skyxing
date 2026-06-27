/**
 * Human Verification Module
 * Math-based SVG captcha with noise and rotation
 * Answers stored in KV, 5-min TTL, one-time use
 */

var safeCrypto = typeof crypto !== 'undefined' ? crypto : globalThis.crypto;

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

export function generateCaptcha() {
    const a = randInt(1, 15), b = randInt(1, 15), ops = ['+', '-', 'x'];
    const op = ops[randInt(0, 2)];
    let answer;
    if (op === '+') answer = a + b;
    else if (op === '-') answer = a - b;
    else answer = a * b;

    const expression = a + ' ' + op + ' ' + b;
    const id = (safeCrypto.randomUUID ? safeCrypto.randomUUID() : 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = safeCrypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        }));
    const svgText = buildSvg(expression);
    return { id, svg: svgToDataUri(svgText), answer };
}

function buildSvg(text) {
    var w = 180, h = 60, noise = '', i;
    for (i = 0; i < 6; i++) {
        noise += '<line x1="' + randInt(0, w) + '" y1="' + randInt(0, h) + '" x2="' + randInt(0, w) + '" y2="' + randInt(0, h) + '" stroke="rgba(120,120,120,' + (randInt(3, 8) / 10).toFixed(1) + ')" stroke-width="1"/>';
    }
    for (i = 0; i < 30; i++) {
        noise += '<circle cx="' + randInt(0, w) + '" cy="' + randInt(0, h) + '" r="' + (randInt(1, 3) / 2).toFixed(1) + '" fill="rgba(180,180,180,' + (randInt(2, 6) / 10).toFixed(1) + ')"/>';
    }
    var rotate = randInt(-5, 5);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
        '<rect width="' + w + '" height="' + h + '" fill="#1a1a2e" rx="6"/>' +
        noise +
        '<text x="' + (w / 2) + '" y="' + (h / 2) + '" text-anchor="middle" dominant-baseline="central" font-family="Courier New,monospace" font-size="26" font-weight="bold" fill="#e0e0ff" transform="rotate(' + rotate + ',' + (w / 2) + ',' + (h / 2) + ')" style="letter-spacing:4px">' + text + ' = ?</text>' +
        '</svg>';
}

function svgToDataUri(svg) {
    var bytes = new TextEncoder().encode(svg);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return 'data:image/svg+xml;base64,' + btoa(binary);
}

export async function storeCaptcha(env, id, answer) {
    await env.SkyXing.put('captcha:' + id, String(answer), { expirationTtl: 300 });
}

export async function verifyCaptcha(env, id, userAnswer) {
    var stored = await env.SkyXing.get('captcha:' + id);
    if (!stored) return { valid: false, reason: 'Captcha expired' };
    await env.SkyXing.delete('captcha:' + id);
    if (String(userAnswer).trim() === stored) return { valid: true };
    return { valid: false, reason: 'Incorrect captcha' };
}
