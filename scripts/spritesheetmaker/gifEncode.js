// Shared animated-GIF encoding for the spritesheet texture pipeline (CJS,
// used by both the import script and the /api/v1/items/texture route).
//
// omggif wants palette entries as packed ints (r<<16|g<<8|b); disposal 2
// makes each full-canvas frame clear to transparency instead of
// accumulating over the previous one.
const { GifWriter } = require('omggif');

// Index an RGBA frame against a per-frame local palette (max 256 colors -
// sprite art is small so this always fits); alpha 0 pixels become the
// palette's transparent entry.
function indexFrame(rgba) {
    const colorIndex = new Map();
    const palette = [];
    let transparentIndex = null;
    const indices = Buffer.alloc(rgba.length / 4);
    for (let i = 0; i < rgba.length; i += 4) {
        const alpha = rgba[i + 3] > 127;
        const key = alpha ? `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}` : 'transparent';
        let idx = colorIndex.get(key);
        if (idx === undefined) {
            if (palette.length >= 256) {
                idx = 0; // defensive; should never trigger
            } else {
                idx = palette.length;
                colorIndex.set(key, idx);
                palette.push(alpha ? [rgba[i], rgba[i + 1], rgba[i + 2]] : [0, 0, 0]);
                if (!alpha && transparentIndex === null) transparentIndex = idx;
            }
        }
        indices[i / 4] = idx;
    }
    // omggif requires palette sizes to be a power of two; pad unused entries.
    const padded = Math.max(2, 1 << Math.ceil(Math.log2(palette.length)));
    while (palette.length < padded) palette.push([0, 0, 0]);
    return { palette, indices, transparentIndex };
}

// rgbaFrames: array of equal-size RGBA Buffers; delays: one centisecond
// value per frame. Returns the encoded GIF Buffer.
function encodeFrames(rgbaFrames, w, h, delays) {
    const out = Buffer.alloc(w * h * 3 * rgbaFrames.length + 1024);
    const writer = new GifWriter(out, w, h, { loop: 0 });
    for (let i = 0; i < rgbaFrames.length; i++) {
        const { palette, indices, transparentIndex } = indexFrame(rgbaFrames[i]);
        const packed = palette.map(([r, g, b]) => ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff));
        writer.addFrame(0, 0, w, h, indices, {
            palette: packed,
            transparent: transparentIndex !== null ? transparentIndex : undefined,
            disposal: 2,
            delay: delays[i],
        });
    }
    return out.slice(0, writer.end());
}

module.exports = { encodeFrames, indexFrame };
