// Generates public/icons/icon-192.png and icon-512.png from the target ring
// SVG used as the app wordmark.  Run with: node scripts/generate-icons.js
import sharp from 'sharp'
import { join, dirname } from 'path'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const outDir = join(publicDir, 'icons')

// Build an ICO file from one or more PNG buffers.
// ICO format: 6-byte header, 16-byte directory entry per image, then raw PNG data.
function buildIco(pngBuffers) {
  const count = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dataOffset = headerSize + dirEntrySize * count

  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)      // reserved
  header.writeUInt16LE(1, 2)      // type: 1 = ICO
  header.writeUInt16LE(count, 4)  // image count

  const dirEntries = []
  let offset = dataOffset
  for (const png of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize)
    // width/height: 0 means 256 in ICO spec; for <=255 use actual value
    const meta = sharp(png)
    // We already know the sizes we're passing in, but we encode from the PNG header
    // For simplicity, we set width/height to 0 (works for all sizes up to 256)
    entry.writeUInt8(0, 0)        // width  (0 = 256 or "read from data")
    entry.writeUInt8(0, 1)        // height
    entry.writeUInt8(0, 2)        // color palette
    entry.writeUInt8(0, 3)        // reserved
    entry.writeUInt16LE(1, 4)     // color planes
    entry.writeUInt16LE(32, 6)    // bits per pixel
    entry.writeUInt32LE(png.length, 8)   // data size
    entry.writeUInt32LE(offset, 12)      // data offset
    dirEntries.push(entry)
    offset += png.length
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers])
}

// Uses the same circle layout as the HomeView wordmark-icon, but with
// icon-specific explicit colours and stroke/opacity values for PNG output.
// Background matches theme_color / background_color from vite.config.js.
const svgTemplate = (size) => {
  const bg = '#0d0d1a'
  const fg = '#00e676'            // var(--accent)
  // Rounded-corner radius: ~22 % of size feels right for app icons
  const rx = Math.round(size * 0.22)
  // All circles are defined in a 32×32 coordinate space
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="${rx / (size / 32)}" fill="${bg}"/>
  <circle cx="16" cy="16" r="14" stroke="${fg}" stroke-width="1.2" opacity="0.35"/>
  <circle cx="16" cy="16" r="9"  stroke="${fg}" stroke-width="1.2" opacity="0.65"/>
  <circle cx="16" cy="16" r="4"  stroke="${fg}" stroke-width="1.2"/>
  <circle cx="16" cy="16" r="1.5" fill="${fg}"/>
</svg>`
}

// Maskable icons need a safe zone (inner 80% circle). Add extra padding
// by scaling the viewBox content down so the design sits within the safe area.
const maskableSvgTemplate = (size) => {
  const bg = '#0d0d1a'
  const fg = '#00e676'
  const rx = Math.round(size * 0.22)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="${rx / (size / 32)}" fill="${bg}"/>
  <g transform="translate(16,16) scale(0.75) translate(-16,-16)">
    <circle cx="16" cy="16" r="14" stroke="${fg}" stroke-width="1.2" opacity="0.35"/>
    <circle cx="16" cy="16" r="9"  stroke="${fg}" stroke-width="1.2" opacity="0.65"/>
    <circle cx="16" cy="16" r="4"  stroke="${fg}" stroke-width="1.2"/>
    <circle cx="16" cy="16" r="1.5" fill="${fg}"/>
  </g>
</svg>`
}

for (const size of [192, 512]) {
  const svg = Buffer.from(svgTemplate(size))
  const dest = join(outDir, `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(dest)
  console.log(`✓  icon-${size}.png`)
}

// Apple touch icon (180×180)
{
  const svg = Buffer.from(svgTemplate(180))
  const dest = join(outDir, `apple-touch-icon.png`)
  await sharp(svg).resize(180, 180).png().toFile(dest)
  console.log(`✓  apple-touch-icon.png`)
}

// Maskable icon (512×512) — design scaled to 75% to fit within the safe zone
{
  const svg = Buffer.from(maskableSvgTemplate(512))
  const dest = join(outDir, `icon-maskable-512.png`)
  await sharp(svg).resize(512, 512).png().toFile(dest)
  console.log(`✓  icon-maskable-512.png`)
}

// Favicon (ICO with 32×32 and 16×16)
{
  const sizes = [32, 16]
  const pngBuffers = await Promise.all(
    sizes.map(s => sharp(Buffer.from(svgTemplate(s))).resize(s, s).png().toBuffer())
  )
  const ico = buildIco(pngBuffers)
  writeFileSync(join(publicDir, 'favicon.ico'), ico)
  console.log(`✓  favicon.ico`)
}
