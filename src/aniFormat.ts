export interface CursorFrame {
  width: number
  height: number
  hotspotX: number
  hotspotY: number
  pixels: Uint8Array
  andMask: Uint8Array
}

export interface AniHeader {
  cbSize: number
  nFrames: number
  nSteps: number
  iWidth: number
  iHeight: number
  iBitCount: number
  nSpeed: number
  dwFlags: number
}

export const AF_ICON = 0x01
export const AF_SEQUENCE = 0x02

export interface AniFile {
  header: AniHeader
  frames: CursorFrame[]
  rates: number[] | null
  seq: number[] | null
}

function readU32LE(d: DataView, o: number): number {
  return d.getUint32(o, true)
}

function readU16LE(d: DataView, o: number): number {
  return d.getUint16(o, true)
}

function writeU32LE(d: DataView, o: number, v: number) {
  d.setUint32(o, v, true)
}

function writeU16LE(d: DataView, o: number, v: number) {
  d.setUint16(o, v, true)
}

function fourCC(d: DataView, o: number): string {
  return String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3))
}

function writeFourCC(d: DataView, o: number, s: string) {
  for (let i = 0; i < 4; i++) d.setUint8(o + i, s.charCodeAt(i))
}

function parseIconFrame(buf: ArrayBuffer, isCursor: boolean): CursorFrame | null {
  const d = new DataView(buf)
  if (d.byteLength < 22) return null

  const count = readU16LE(d, 4)
  if (count < 1) return null

  let hotspotX = 0
  let hotspotY = 0
  if (isCursor) {
    hotspotX = readU16LE(d, 10)
    hotspotY = readU16LE(d, 12)
  }

  const dataSize = readU32LE(d, 14)
  const dataOffset = readU32LE(d, 18)
  if (dataOffset + dataSize > buf.byteLength) return null

  const imgView = new DataView(buf, dataOffset, dataSize)
  if (imgView.byteLength < 40) return null

  const bmpWidth = imgView.getInt32(4, true)
  const bmpHeight = imgView.getInt32(8, true)
  const bitCount = imgView.getUint16(14, true)

  const realWidth = bmpWidth > 0 ? bmpWidth : (d.getUint8(6) || 256)
  const realHeight = Math.abs(bmpHeight) / 2
  const flipRows = bmpHeight > 0

  const xorStride = Math.ceil(realWidth * bitCount / 8 / 4) * 4
  const andStride = Math.ceil(realWidth / 8 / 4) * 4
  const paletteCount = bitCount <= 8 ? (imgView.getUint32(32, true) || (1 << bitCount)) : 0
  const paletteOffset = 40
  const xorOffset = paletteOffset + paletteCount * 4
  const andOffset = xorOffset + xorStride * realHeight

  const raw = new Uint8Array(buf, dataOffset, dataSize)
  const pixels = new Uint8Array(realWidth * realHeight * 4)
  const andMask = new Uint8Array(Math.ceil(realWidth / 8) * realHeight)

  for (let y = 0; y < realHeight; y++) {
    const srcY = flipRows ? y : (realHeight - 1 - y)
    const xorRow = xorOffset + srcY * xorStride
    for (let x = 0; x < realWidth; x++) {
      const dstIdx = (y * realWidth + x) * 4
      let r = 0, g = 0, b = 0, a = 255

      if (bitCount === 32) {
        const off = xorRow + x * 4
        if (off + 3 < raw.length) {
          b = raw[off]; g = raw[off + 1]; r = raw[off + 2]; a = raw[off + 3]
        }
      } else if (bitCount === 24) {
        const off = xorRow + x * 3
        if (off + 2 < raw.length) {
          b = raw[off]; g = raw[off + 1]; r = raw[off + 2]
        }
      } else if (bitCount === 8) {
        const off = xorRow + x
        if (off < raw.length) {
          const idx = raw[off]
          const pOff = paletteOffset + idx * 4
          if (pOff + 2 < raw.length) {
            b = raw[pOff]; g = raw[pOff + 1]; r = raw[pOff + 2]
          }
        }
      } else if (bitCount === 4) {
        const off = xorRow + (x >> 1)
        if (off < raw.length) {
          const nibble = (x & 1) ? (raw[off] & 0x0F) : (raw[off] >> 4)
          const pOff = paletteOffset + nibble * 4
          if (pOff + 2 < raw.length) {
            b = raw[pOff]; g = raw[pOff + 1]; r = raw[pOff + 2]
          }
        }
      } else if (bitCount === 1) {
        const off = xorRow + (x >> 3)
        if (off < raw.length) {
          const bit = 7 - (x & 7)
          const val = (raw[off] >> bit) & 1
          r = g = b = val * 255
        }
      }

      const andRow = andOffset + srcY * andStride
      const andByteOff = andRow + (x >> 3)
      let transparent = false
      if (andByteOff < raw.length) {
        transparent = !!((raw[andByteOff] >> (7 - (x & 7))) & 1)
      }
      if (transparent) a = 0

      pixels[dstIdx] = r
      pixels[dstIdx + 1] = g
      pixels[dstIdx + 2] = b
      pixels[dstIdx + 3] = a

      const mOff = y * Math.ceil(realWidth / 8) + (x >> 3)
      if (transparent) andMask[mOff] |= (1 << (7 - (x & 7)))
    }
  }

  return { width: realWidth, height: realHeight, hotspotX, hotspotY, pixels, andMask }
}

export function parseAni(buf: ArrayBuffer): AniFile {
  const d = new DataView(buf)
  if (fourCC(d, 0) !== 'RIFF') throw new Error('Not a RIFF file')
  const riffSize = readU32LE(d, 4)
  if (fourCC(d, 8) !== 'ACON') throw new Error('Not an ANI file')

  const end = Math.min(12 + riffSize, buf.byteLength)
  let offset = 12

  let header: AniHeader | null = null
  let rates: number[] | null = null
  let seq: number[] | null = null
  const frames: CursorFrame[] = []

  while (offset + 8 <= end) {
    const chunkId = fourCC(d, offset)
    const chunkSize = readU32LE(d, offset + 4)
    const chunkData = offset + 8

    if (chunkId === 'anih' && chunkSize >= 36) {
      header = {
        cbSize: readU32LE(d, chunkData),
        nFrames: readU32LE(d, chunkData + 4),
        nSteps: readU32LE(d, chunkData + 8),
        iWidth: readU32LE(d, chunkData + 12),
        iHeight: readU32LE(d, chunkData + 16),
        iBitCount: readU32LE(d, chunkData + 20),
        nSpeed: readU32LE(d, chunkData + 28),
        dwFlags: readU32LE(d, chunkData + 32),
      }
    } else if (chunkId === 'rate' && chunkSize >= 4) {
      const count = chunkSize / 4
      rates = []
      for (let i = 0; i < count; i++) {
        rates.push(readU32LE(d, chunkData + i * 4))
      }
    } else if (chunkId === 'seq ' && chunkSize >= 4) {
      const count = chunkSize / 4
      seq = []
      for (let i = 0; i < count; i++) {
        seq.push(readU32LE(d, chunkData + i * 4))
      }
    } else if (chunkId === 'LIST') {
      const listType = fourCC(d, chunkData)
      if (listType === 'fram') {
        let fOff = chunkData + 4
        const fEnd = chunkData + chunkSize
        while (fOff + 8 <= fEnd) {
          const fId = fourCC(d, fOff)
          const fSize = readU32LE(d, fOff + 4)
          if (fId === 'icon') {
            const frameBuf = buf.slice(fOff + 8, fOff + 8 + fSize)
            const frame = parseIconFrame(frameBuf, true)
            if (frame) frames.push(frame)
          }
          fOff += 8 + fSize + (fSize % 2)
        }
      }
    }

    offset += 8 + chunkSize + (chunkSize % 2)
  }

  if (!header) {
    header = {
      cbSize: 36,
      nFrames: frames.length,
      nSteps: frames.length,
      iWidth: frames.length > 0 ? frames[0].width : 32,
      iHeight: frames.length > 0 ? frames[0].height : 32,
      iBitCount: 32,
      nSpeed: 6,
      dwFlags: AF_ICON,
    }
  }

  return { header, frames, rates, seq }
}

function encodeIconFrame(frame: CursorFrame): ArrayBuffer {
  const { width, height, hotspotX, hotspotY, pixels, andMask } = frame
  const bitCount = 32
  const xorStride = Math.ceil(width * bitCount / 8 / 4) * 4
  const andStride = Math.ceil(width / 8 / 4) * 4
  const xorSize = xorStride * height
  const andSize = andStride * height
  const bmpHeaderSize = 40
  const imgSize = bmpHeaderSize + xorSize + andSize
  const dirHeaderSize = 6
  const dirEntrySize = 16
  const dirTotal = dirHeaderSize + dirEntrySize
  const totalSize = dirTotal + imgSize
  const buf = new ArrayBuffer(totalSize)
  const dv = new DataView(buf)
  const u = new Uint8Array(buf)

  writeU16LE(dv, 0, 0)
  writeU16LE(dv, 2, 2)
  writeU16LE(dv, 4, 1)

  dv.setUint8(6, width >= 256 ? 0 : width)
  dv.setUint8(7, height >= 256 ? 0 : height)
  u[8] = 0
  u[9] = 0
  writeU16LE(dv, 10, hotspotX)
  writeU16LE(dv, 12, hotspotY)
  writeU32LE(dv, 14, imgSize)
  writeU32LE(dv, 18, dirTotal)

  const bmpOff = dirTotal
  writeU32LE(dv, bmpOff, 40)
  dv.setInt32(bmpOff + 4, width, true)
  dv.setInt32(bmpOff + 8, height * 2, true)
  writeU16LE(dv, bmpOff + 12, 1)
  writeU16LE(dv, bmpOff + 14, bitCount)
  writeU32LE(dv, bmpOff + 16, 0)
  writeU32LE(dv, bmpOff + 20, xorSize + andSize)

  const xorOff = bmpOff + bmpHeaderSize
  for (let y = 0; y < height; y++) {
    const dstRow = xorOff + (height - 1 - y) * xorStride
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4
      const dstOff = dstRow + x * 4
      u[dstOff] = pixels[srcIdx + 2]
      u[dstOff + 1] = pixels[srcIdx + 1]
      u[dstOff + 2] = pixels[srcIdx]
      const mByte = y * Math.ceil(width / 8) + (x >> 3)
      const mBit = 7 - (x & 7)
      const isTransparent = !!((andMask[mByte] >> mBit) & 1)
      u[dstOff + 3] = isTransparent ? 0 : pixels[srcIdx + 3]
    }
  }

  const andOff = xorOff + xorSize
  for (let y = 0; y < height; y++) {
    const dstRow = andOff + (height - 1 - y) * andStride
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4
      const mByte = y * Math.ceil(width / 8) + (x >> 3)
      const mBit = 7 - (x & 7)
      const isTransparent = !!((andMask[mByte] >> mBit) & 1) || pixels[srcIdx + 3] === 0
      if (isTransparent) {
        u[dstRow + (x >> 3)] |= (1 << (7 - (x & 7)))
      }
    }
  }

  return buf
}

export function writeAni(ani: AniFile): ArrayBuffer {
  const chunks: { id: string; data: ArrayBuffer }[] = []

  const headerData = new ArrayBuffer(36)
  const hd = new DataView(headerData)
    writeU32LE(hd, 0, 36)
    writeU32LE(hd, 4, ani.header.nFrames)
    writeU32LE(hd, 8, ani.header.nSteps)
    writeU32LE(hd, 12, ani.header.iWidth)
    writeU32LE(hd, 16, ani.header.iHeight)
    writeU32LE(hd, 20, ani.header.iBitCount)
    writeU32LE(hd, 24, 1) // cPlanes
    writeU32LE(hd, 28, ani.header.nSpeed)
    writeU32LE(hd, 32, ani.header.dwFlags)
  chunks.push({ id: 'anih', data: headerData })

  if (ani.rates && ani.rates.length > 0) {
    const rateData = new ArrayBuffer(ani.rates.length * 4)
    const rd = new DataView(rateData)
    for (let i = 0; i < ani.rates.length; i++) writeU32LE(rd, i * 4, ani.rates[i])
    chunks.push({ id: 'rate', data: rateData })
  }

  if (ani.seq && ani.seq.length > 0) {
    const seqData = new ArrayBuffer(ani.seq.length * 4)
    const sd = new DataView(seqData)
    for (let i = 0; i < ani.seq.length; i++) writeU32LE(sd, i * 4, ani.seq[i])
    chunks.push({ id: 'seq ', data: seqData })
  }

  const frameChunks: ArrayBuffer[] = []
  for (const frame of ani.frames) {
    const iconData = encodeIconFrame(frame)
    const fc = new ArrayBuffer(8 + iconData.byteLength)
    const fcd = new DataView(fc)
    writeFourCC(fcd, 0, 'icon')
    writeU32LE(fcd, 4, iconData.byteLength)
    new Uint8Array(fc).set(new Uint8Array(iconData), 8)
    frameChunks.push(fc)
  }

  const framPayload = new Uint8Array(4 + frameChunks.reduce((s, c) => s + c.byteLength, 0))
  framPayload[0] = 0x66; framPayload[1] = 0x72; framPayload[2] = 0x61; framPayload[3] = 0x6D
  let fOff = 4
  for (const fc of frameChunks) {
    framPayload.set(new Uint8Array(fc), fOff)
    fOff += fc.byteLength
  }

  let totalSize = 4
  for (const c of chunks) totalSize += 8 + c.data.byteLength
  totalSize += 8 + 4 + framPayload.length

  const riff = new ArrayBuffer(8 + totalSize)
  const rd = new DataView(riff)
  writeFourCC(rd, 0, 'RIFF')
  writeU32LE(rd, 4, totalSize)
  writeFourCC(rd, 8, 'ACON')

  let offset = 12
  for (const c of chunks) {
    writeFourCC(rd, offset, c.id)
    writeU32LE(rd, offset + 4, c.data.byteLength)
    new Uint8Array(riff).set(new Uint8Array(c.data), offset + 8)
    offset += 8 + c.data.byteLength
  }

  writeFourCC(rd, offset, 'LIST')
  writeU32LE(rd, offset + 4, 4 + framPayload.length)
  new Uint8Array(riff).set(framPayload, offset + 8)
  offset += 8 + 4 + framPayload.length

  return riff.slice(0, offset)
}

export function createEmptyFrame(width: number, height: number): CursorFrame {
  return {
    width,
    height,
    hotspotX: 0,
    hotspotY: 0,
    pixels: new Uint8Array(width * height * 4),
    andMask: new Uint8Array(Math.ceil(width / 8) * height),
  }
}

export function frameToCanvas(
  frame: CursorFrame,
  scale: number,
  canvas: HTMLCanvasElement,
  showGrid?: boolean,
) {
  const { width, height, pixels } = frame
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  const imgData = ctx.createImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    imgData.data[i * 4] = pixels[i * 4]
    imgData.data[i * 4 + 1] = pixels[i * 4 + 1]
    imgData.data[i * 4 + 2] = pixels[i * 4 + 2]
    imgData.data[i * 4 + 3] = pixels[i * 4 + 3]
  }

  const tmp = document.createElement('canvas')
  tmp.width = width
  tmp.height = height
  tmp.getContext('2d')!.putImageData(imgData, 0, 0)

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const sz = scale
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = '#cbd5e1'
        ctx.fillRect(x * sz, y * sz, sz, sz)
      }
    }
  }

  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)

  if (showGrid && scale >= 4) {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 0.5
    for (let x = 0; x <= width; x++) {
      ctx.beginPath()
      ctx.moveTo(x * scale, 0)
      ctx.lineTo(x * scale, height * scale)
      ctx.stroke()
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * scale)
      ctx.lineTo(width * scale, y * scale)
      ctx.stroke()
    }
  }
}
