// Generates public/icons/icon-192.png and icon-512.png from the target ring
// SVG used as the app wordmark.  Run with: node scripts/generate-icons.js
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

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

for (const size of [192, 512]) {
  const svg = Buffer.from(svgTemplate(size))
  const dest = join(outDir, `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(dest)
  console.log(`✓  icon-${size}.png`)
}
