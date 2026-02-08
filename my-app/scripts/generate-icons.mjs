/**
 * Generate all PWA icon sizes from a single source image.
 * 
 * Usage: node scripts/generate-icons.mjs
 * 
 * Place your source icon as public/app-icon.png (ideally 512x512 or larger),
 * then run this script to generate all required sizes.
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const SOURCE = resolve(PROJECT_ROOT, 'public', 'app-icon.png');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'public', 'icons');

const SIZES = [32, 72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  if (!existsSync(SOURCE)) {
    console.error('❌ Source icon not found at public/app-icon.png');
    console.error('   Please save your icon image there first.');
    process.exit(1);
  }

  // Ensure output directory exists
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('🎨 Generating PWA icons from public/app-icon.png...\n');

  for (const size of SIZES) {
    const filename = `icon-${size}.png`;
    await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(resolve(OUTPUT_DIR, filename));
    console.log(`  ✅ ${filename}  (${size}x${size})`);
  }

  // Apple Touch Icon (180x180)
  await sharp(SOURCE)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(OUTPUT_DIR, 'apple-touch-icon.png'));
  console.log('  ✅ apple-touch-icon.png  (180x180)');

  // Maskable icon: padded with safe zone (512x512 with ~10% padding)
  const maskableSize = 512;
  const innerSize = Math.round(maskableSize * 0.8);
  const padding = Math.round((maskableSize - innerSize) / 2);

  const resizedInner = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      // Emerald-tinted background for the maskable icon safe zone
      background: { r: 16, g: 185, b: 129, alpha: 255 },
    },
  })
    .composite([{ input: resizedInner, top: padding, left: padding }])
    .png()
    .toFile(resolve(OUTPUT_DIR, 'icon-512-maskable.png'));
  console.log('  ✅ icon-512-maskable.png  (512x512 maskable)');

  // Also generate a favicon.ico replacement (32x32 PNG)
  await sharp(SOURCE)
    .resize(32, 32)
    .png()
    .toFile(resolve(OUTPUT_DIR, 'favicon-32.png'));

  // Generate ICO-compatible 16x16
  await sharp(SOURCE)
    .resize(16, 16)
    .png()
    .toFile(resolve(OUTPUT_DIR, 'favicon-16.png'));
  console.log('  ✅ favicon PNGs  (16x16, 32x32)');

  console.log('\n🎉 All icons generated in public/icons/');
  console.log('   Your app icon is now ready for PWA installation!');
}

generateIcons().catch(console.error);
