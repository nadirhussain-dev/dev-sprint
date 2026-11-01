// Generates PWA icons from an inline SVG: `npm run icons`
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (size, pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0a0a0a"/>
  <text x="256" y="${pad ? 300 : 318}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700"
    font-size="${pad ? 170 : 230}" fill="#fafafa" letter-spacing="-8">60</text>
  <rect x="${pad ? 176 : 146}" y="${pad ? 340 : 368}" width="${pad ? 160 : 220}" height="${pad ? 14 : 20}" rx="7" fill="#fafafa" opacity="0.5"/>
</svg>`);

mkdirSync("public/icons", { recursive: true });
await sharp(svg(512, false)).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(svg(512, false)).png().toFile("public/icons/icon-512.png");
await sharp(svg(512, true)).png().toFile("public/icons/maskable-512.png");
await sharp(svg(512, true)).resize(180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(svg(512, false)).resize(32).png().toFile("public/favicon.png");
console.log("icons written");
