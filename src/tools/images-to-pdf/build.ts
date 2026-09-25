/** Builds the PDF with pdf-lib from already-encoded images. Loaded dynamically by the tool. */
import { PDFDocument } from 'pdf-lib'
import { pageSize, placeImage, type Fit, type Orientation, type PageSize } from './layout'

export interface Prepared {
  /** Encoded image, already cropped for cover mode. */
  bytes: Uint8Array
  kind: 'jpg' | 'png'
  /** Original (uncropped) pixel size, used for the layout. */
  srcW: number
  srcH: number
}

export interface BuildOptions {
  size: PageSize
  orientation: Orientation
  margin: number
  fit: Fit
  title?: string
}

export async function buildPdf(images: Prepared[], o: BuildOptions, onProgress?: (done: number) => void): Promise<Uint8Array> {
  if (!images.length) throw new Error('Add at least one image.')
  const doc = await PDFDocument.create()
  if (o.title) doc.setTitle(o.title)
  doc.setCreator('4llTools Images to PDF')
  for (let i = 0; i < images.length; i++) {
    const im = images[i]
    const embedded = im.kind === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes)
    const [pw, ph] = pageSize(im.srcW, im.srcH, o.size, o.orientation, o.margin)
    const page = doc.addPage([pw, ph])
    const p = placeImage(im.srcW, im.srcH, pw, ph, o.margin, o.fit)
    page.drawImage(embedded, { x: p.x, y: p.y, width: p.w, height: p.h })
    onProgress?.(i + 1)
  }
  return doc.save()
}
