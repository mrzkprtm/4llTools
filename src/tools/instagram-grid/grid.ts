export const GRID = 3

export interface Slot {
  img: HTMLImageElement | null
}

export const emptyGrid = (): Slot[] => Array.from({ length: GRID * GRID }, () => ({ img: null }))

/** Number of slots that hold an image. */
export function filledCount(slots: Slot[]): number {
  return slots.filter((s) => s.img).length
}

/** Pure immutable move: lift the item at `from` and insert it at `to`. */
export function moveSlot(slots: Slot[], from: number, to: number): Slot[] {
  if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return slots
  const next = slots.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Largest centered square inside the image (cover-square source rect). */
export function squareRect(imgW: number, imgH: number): { sx: number; sy: number; side: number } {
  const side = Math.min(imgW, imgH)
  return { sx: (imgW - side) / 2, sy: (imgH - side) / 2, side }
}

/** Source rect of grid cell `i` (row-major) inside the cover-square, for slicing. */
export function cellRect(imgW: number, imgH: number, i: number): { sx: number; sy: number; side: number } {
  const { sx, sy, side } = squareRect(imgW, imgH)
  const cell = side / GRID
  const col = i % GRID
  const row = Math.floor(i / GRID)
  return { sx: sx + col * cell, sy: sy + row * cell, side: cell }
}

/** Display order note: post order = reverse row-major so the feed reads top-to-bottom. */
export function postOrder(): number[] {
  return Array.from({ length: GRID * GRID }, (_, i) => GRID * GRID - 1 - i)
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image file.'))
    }
    img.src = url
  })
}

/** Draw `img` cover-fitted (center crop) into the dx/dy/dw/dh box. */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h)
}

/** Render one sliced cell (cover-square crop) to its own canvas at `out` px. */
export function renderCell(img: HTMLImageElement, i: number, out: number): HTMLCanvasElement {
  const { sx, sy, side } = cellRect(img.naturalWidth, img.naturalHeight, i)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)
  return canvas
}

/** Stitch up to 9 slot images into one square grid canvas at `out` px. */
export function renderStitch(slots: Slot[], out: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  const cell = out / GRID
  slots.forEach((slot, i) => {
    const dx = (i % GRID) * cell
    const dy = Math.floor(i / GRID) * cell
    if (slot.img) {
      drawCover(ctx, slot.img, dx, dy, cell, cell)
    } else {
      ctx.fillStyle = '#d8d2c3'
      ctx.fillRect(dx, dy, cell, cell)
    }
  })
  return canvas
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
}
