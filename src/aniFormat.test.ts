import { describe, it, expect } from 'vitest'
import { parseAni, writeAni, createEmptyFrame, AF_ICON, AF_SEQUENCE } from './aniFormat'
import type { AniFile, CursorFrame } from './aniFormat'

function makeTestFrame(w: number, h: number, r: number, g: number, b: number): CursorFrame {
  const frame = createEmptyFrame(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const off = (y * w + x) * 4
      frame.pixels[off] = r
      frame.pixels[off + 1] = g
      frame.pixels[off + 2] = b
      frame.pixels[off + 3] = 255
    }
  }
  frame.hotspotX = 1
  frame.hotspotY = 2
  return frame
}

describe('aniFormat', () => {
  it('createEmptyFrame produces all-transparent pixels', () => {
    const f = createEmptyFrame(32, 32)
    expect(f.width).toBe(32)
    expect(f.height).toBe(32)
    expect(f.pixels.length).toBe(32 * 32 * 4)
    expect(f.pixels.every(b => b === 0)).toBe(true)
    expect(f.hotspotX).toBe(0)
    expect(f.hotspotY).toBe(0)
  })

  it('round-trips a single-frame 32x32 ANI', () => {
    const frame = makeTestFrame(32, 32, 255, 0, 0)
    const ani: AniFile = {
      header: {
        cbSize: 36,
        nFrames: 1,
        nSteps: 1,
        iWidth: 32,
        iHeight: 32,
        iBitCount: 32,
        nSpeed: 10,
        dwFlags: AF_ICON,
      },
      frames: [frame],
      rates: null,
      seq: null,
    }
    const buf = writeAni(ani)
    const parsed = parseAni(buf)

    expect(parsed.header.nFrames).toBe(1)
    expect(parsed.header.nSteps).toBe(1)
    expect(parsed.header.nSpeed).toBe(10)
    expect(parsed.header.dwFlags).toBe(AF_ICON)
    expect(parsed.frames.length).toBe(1)
    expect(parsed.frames[0].width).toBe(32)
    expect(parsed.frames[0].height).toBe(32)
    expect(parsed.frames[0].hotspotX).toBe(1)
    expect(parsed.frames[0].hotspotY).toBe(2)

    const px = parsed.frames[0].pixels
    expect(px[0]).toBe(255)
    expect(px[1]).toBe(0)
    expect(px[2]).toBe(0)
    expect(px[3]).toBe(255)
  })

  it('round-trips multi-frame ANI with rates and seq', () => {
    const f1 = makeTestFrame(32, 32, 255, 0, 0)
    const f2 = makeTestFrame(32, 32, 0, 255, 0)
    const f3 = makeTestFrame(32, 32, 0, 0, 255)
    const ani: AniFile = {
      header: {
        cbSize: 36,
        nFrames: 3,
        nSteps: 5,
        iWidth: 32,
        iHeight: 32,
        iBitCount: 32,
        nSpeed: 6,
        dwFlags: AF_ICON | AF_SEQUENCE,
      },
      frames: [f1, f2, f3],
      rates: [8, 8, 8],
      seq: [0, 1, 0, 2, 1],
    }
    const buf = writeAni(ani)
    const parsed = parseAni(buf)

    expect(parsed.frames.length).toBe(3)
    expect(parsed.header.nFrames).toBe(3)
    expect(parsed.header.nSteps).toBe(5)
    expect(parsed.rates).toEqual([8, 8, 8])
    expect(parsed.seq).toEqual([0, 1, 0, 2, 1])

    expect(parsed.frames[0].pixels[0]).toBe(255)
    expect(parsed.frames[1].pixels[1]).toBe(255)
    expect(parsed.frames[2].pixels[2]).toBe(255)
  })

  it('round-trips a 16x16 frame', () => {
    const frame = makeTestFrame(16, 16, 128, 64, 200)
    const ani: AniFile = {
      header: {
        cbSize: 36, nFrames: 1, nSteps: 1,
        iWidth: 16, iHeight: 16, iBitCount: 32,
        nSpeed: 4, dwFlags: AF_ICON,
      },
      frames: [frame],
      rates: null,
      seq: null,
    }
    const buf = writeAni(ani)
    const parsed = parseAni(buf)

    expect(parsed.frames[0].width).toBe(16)
    expect(parsed.frames[0].height).toBe(16)
    expect(parsed.frames[0].pixels[0]).toBe(128)
    expect(parsed.frames[0].pixels[1]).toBe(64)
    expect(parsed.frames[0].pixels[2]).toBe(200)
  })

  it('throws on non-RIFF input', () => {
    expect(() => parseAni(new ArrayBuffer(12))).toThrow('Not a RIFF file')
  })

  it('throws on non-ACON RIFF', () => {
    const buf = new ArrayBuffer(12)
    const d = new DataView(buf)
    d.setUint8(0, 0x52); d.setUint8(1, 0x49); d.setUint8(2, 0x46); d.setUint8(3, 0x46)
    d.setUint32(4, 4, true)
    d.setUint8(8, 0x58); d.setUint8(9, 0x58); d.setUint8(10, 0x58); d.setUint8(11, 0x58)
    expect(() => parseAni(buf)).toThrow('Not an ANI file')
  })

  it('preserves transparency (alpha=0)', () => {
    const frame = createEmptyFrame(8, 8)
    expect(frame.pixels[3]).toBe(0)
    const ani: AniFile = {
      header: {
        cbSize: 36, nFrames: 1, nSteps: 1,
        iWidth: 8, iHeight: 8, iBitCount: 32,
        nSpeed: 6, dwFlags: AF_ICON,
      },
      frames: [frame],
      rates: null, seq: null,
    }
    const buf = writeAni(ani)
    const parsed = parseAni(buf)
    expect(parsed.frames[0].pixels[3]).toBe(0)
  })
})
