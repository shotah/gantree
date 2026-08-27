import { encode } from "jpeg-js";

const EDGE = 256;
const BG: [number, number, number] = [12, 13, 16];

const PALETTE: [number, number, number][] = [
  [245, 158, 11],
  [52, 211, 153],
  [56, 189, 248],
  [167, 139, 250],
  [251, 113, 133],
  [250, 204, 21],
];

function hashOf(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function hueOf(seed: string): [number, number, number] {
  return PALETTE[hashOf(seed) % PALETTE.length] ?? PALETTE[0];
}

function plot(data: Uint8Array, x: number, y: number, rgb: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= EDGE || y >= EDGE) {
    return;
  }
  const i = (y * EDGE + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function fillRect(
  data: Uint8Array,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rgb: [number, number, number],
): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      plot(data, x, y, rgb);
    }
  }
}

/**
 * Board/operator avatar: dark tile, GitHub-style 5×5 mirrored identicon.
 * Real JPEG bytes the avatar gate will take.
 */
export function tileJpeg(label: string): Uint8Array {
  const data = new Uint8Array(EDGE * EDGE * 4);
  fillRect(data, 0, 0, EDGE, EDGE, BG);
  const ink = hueOf(label);
  const h = hashOf(label);
  const gap = 8;
  const cell = Math.floor((EDGE - gap * 6) / 5);
  const grid = cell * 5 + gap * 4;
  const ox = Math.round((EDGE - grid) / 2);
  const oy = ox;
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      if (((h >>> (gy * 3 + gx)) & 1) === 0) {
        continue;
      }
      const xs = gx === 2 ? [2] : [gx, 4 - gx];
      for (const cx of xs) {
        fillRect(data, ox + cx * (cell + gap), oy + gy * (cell + gap), cell, cell, ink);
      }
    }
  }
  const out = encode({ data, width: EDGE, height: EDGE }, 86);
  return new Uint8Array(out.data);
}
