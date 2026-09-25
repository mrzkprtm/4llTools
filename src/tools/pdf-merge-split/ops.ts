/** PDF operations with pdf-lib. Imported dynamically by the tool so the library loads only when needed. */
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { normAngle } from './ranges'

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getPageCount()
}

/** Joins whole documents in the given order. */
export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return out.save()
}

/** Copies the given 1-based pages (in order, duplicates allowed) into a new document. */
export async function extractPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { updateMetadata: false })
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, pages.map((p) => p - 1))
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** One new document per group of pages. */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const out: Uint8Array[] = []
  for (const g of groups) out.push(await extractPages(bytes, g))
  return out
}

export interface PageEdit {
  /** Extra clockwise rotation in degrees (multiples of 90). */
  rotate: number
  deleted: boolean
}

/** Applies rotations and deletions; pages keep their order. */
export async function editPages(bytes: Uint8Array, edits: PageEdit[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const e = edits[i]
    if (e?.rotate) p.setRotation(degrees(normAngle(p.getRotation().angle + e.rotate)))
  })
  for (let i = pages.length - 1; i >= 0; i--) if (edits[i]?.deleted) doc.removePage(i)
  if (doc.getPageCount() === 0) throw new Error('Keep at least one page.')
  return doc.save()
}

/** Current rotation of every page (for showing tiles the right way round). */
export async function pageRotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getPages().map((p) => normAngle(p.getRotation().angle))
}

/** A small numbered sample document so people can try the tool without their own files. */
export async function samplePdf(title: string, pages: number, hue: [number, number, number]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const body = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([420, 595])
    page.drawRectangle({ x: 0, y: 515, width: 420, height: 80, color: rgb(...hue) })
    page.drawText(title, { x: 28, y: 548, size: 22, font, color: rgb(1, 1, 1) })
    page.drawText(`Page ${i} of ${pages}`, { x: 28, y: 470, size: 16, font: body, color: rgb(0.2, 0.2, 0.25) })
    page.drawText(String(i), { x: 150, y: 220, size: 160, font, color: rgb(hue[0] * 0.6 + 0.3, hue[1] * 0.6 + 0.3, hue[2] * 0.6 + 0.3) })
  }
  return doc.save()
}

/** Size (points) and rotation of every page, for drawing page tiles. */
export async function pageInfo(bytes: Uint8Array): Promise<{ w: number; h: number; rotation: number }[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  return doc.getPages().map((p) => {
    const { width, height } = p.getSize()
    return { w: width, h: height, rotation: normAngle(p.getRotation().angle) }
  })
}
