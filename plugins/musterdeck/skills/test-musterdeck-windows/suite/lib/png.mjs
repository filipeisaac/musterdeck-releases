/**
 * png.mjs -- read the pixels of a PNG with nothing but Node's zlib, for the colour check.
 *
 * Handles what Chromium's `Page.captureScreenshot` writes: 8-bit, non-interlaced, truecolour
 * (colour type 2) or truecolour with alpha (6). Anything else is refused with a clear error
 * rather than misread.
 */
import zlib from 'node:zlib'

export function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!sig.every((b, i) => buf[i] === b)) throw new Error('not a PNG')
  let off = 8
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0
  const idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('latin1', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      bitDepth = data[8]; colorType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    off += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${bitDepth}, colour type ${colorType}, interlace ${interlace})`)
  }
  const channels = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    const cur = out.subarray(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      cur[x] = v & 0xff
    }
  }
  return { width, height, channels, data: out }
}

/** How many pixels are within `tolerance` (per channel) of `rgb`, and the nearest one seen. */
export function countNear(img, rgb, tolerance = 8) {
  let count = 0
  let best = null
  let bestD = Infinity
  for (let i = 0; i < img.data.length; i += img.channels) {
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2]
    const d = Math.max(Math.abs(r - rgb[0]), Math.abs(g - rgb[1]), Math.abs(b - rgb[2]))
    if (d <= tolerance) count++
    if (d < bestD) { bestD = d; best = [r, g, b] }
  }
  return { count, nearest: best, distance: bestD }
}
