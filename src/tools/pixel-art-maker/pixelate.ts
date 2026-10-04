export type RGB = [number, number, number]

/** Small, recognisable colour ramps; every entry is a 0…255 RGB triple. */
export const DEFAULT_PALETTES: Record<string, RGB[]> = {
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],
  nes: [
    [0, 0, 0],
    [252, 252, 252],
    [248, 56, 0],
    [0, 120, 248],
    [248, 184, 0],
    [0, 168, 0],
  ],
  c64: [
    [0, 0, 0],
    [255, 255, 255],
    [136, 0, 0],
    [170, 255, 238],
    [204, 68, 204],
    [0, 204, 85],
  ],
  grayscale: [
    [0, 0, 0],
    [85, 85, 85],
    [170, 170, 170],
    [255, 255, 255],
  ],
  sunset: [
    [42, 20, 66],
    [112, 42, 110],
    [209, 84, 94],
    [246, 155, 84],
    [255, 214, 138],
  ],
  ocean: [
    [5, 30, 58],
    [13, 71, 112],
    [32, 128, 155],
    [126, 200, 190],
    [238, 246, 229],
  ],
}

/** The pixel-grid size of the picture once each block of `pixelSize` is one pixel. */
export function targetSize(w: number, h: number, pixelSize: number): { w: number; h: number } {
  const block = Math.max(1, Math.round(pixelSize) || 1)
  return {
    w: Math.max(1, Math.round(w / block) || 1),
    h: Math.max(1, Math.round(h / block) || 1),
  }
}

/** The palette entry closest to a colour by squared RGB distance. */
export function nearestColor(palette: RGB[], r: number, g: number, b: number): RGB {
  if (palette.length === 0) return [0, 0, 0]
  let best = palette[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (const color of palette) {
    const d = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2
    if (d < bestDistance) {
      bestDistance = d
      best = color
    }
  }
  return best
}

/**
 * Snaps every RGBA pixel to the palette in place — alpha is left alone so cut
 * outs stay cut out. An empty palette leaves the data untouched.
 */
export function quantize(data: Uint8ClampedArray, palette: RGB[]): Uint8ClampedArray {
  if (palette.length === 0) return data
  for (let i = 0; i + 3 < data.length; i += 4) {
    const color = nearestColor(palette, data[i], data[i + 1], data[i + 2])
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
  }
  return data
}
