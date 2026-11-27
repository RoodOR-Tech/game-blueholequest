import { describe, expect, it } from 'vitest';
import {
  alignWalkPoses,
  packOpaquePoses,
  proportionalFrameBounds,
  removeSmallOpaqueComponents,
} from './familyAnimations';

describe('illustrated sprite cleanup', () => {
  it('removes isolated fragments while preserving the connected character', () => {
    const width = 40;
    const height = 40;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number) => {
      pixels[(y * width + x) * 4 + 3] = 255;
    };
    for (let y = 5; y < 25; y += 1) for (let x = 4; x < 19; x += 1) paint(x, y);
    paint(1, 1);

    removeSmallOpaqueComponents(pixels, width, height, 1);

    expect(pixels[(10 * width + 10) * 4 + 3]).toBe(255);
    expect(pixels[(1 * width + 1) * 4 + 3]).toBe(0);
  });

  it('distributes uneven sheet widths without cumulative frame drift', () => {
    const bounds = Array.from({ length: 8 }, (_, index) =>
      proportionalFrameBounds(2103, 8, index),
    );

    expect(bounds[7]!.x + bounds[7]!.width).toBe(2103);
    expect(
      bounds
        .slice(1)
        .every(
          (frame, index) => frame.x === bounds[index]!.x + bounds[index]!.width,
        ),
    ).toBe(true);
    expect(bounds.map((frame) => frame.width)).toContain(263);
  });

  it('packs crossing poses into isolated cells', () => {
    const width = 20;
    const height = 6;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number) => {
      pixels[(y * width + x) * 4 + 3] = 255;
    };
    for (let x = 1; x <= 7; x += 1) paint(x, 1);
    for (let x = 6; x <= 17; x += 1) paint(x, 4);

    const packed = packOpaquePoses(pixels, width, height, 2);
    const cellWidth = packed.width / 2;

    expect(cellWidth).toBe(24);
    expect(
      Array.from(packed.pixels).filter(
        (_, index) => index % 4 === 3 && (packed.pixels[index] ?? 0) > 0,
      ),
    ).toHaveLength(19);
  });

  it('lines poses up on the idle torso and builds a passing pose', () => {
    const cell = 20;
    const frames = 8;
    const width = cell * frames;
    const height = 40;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number, red: number) => {
      const offset = (y * width + x) * 4;
      pixels[offset] = red;
      pixels[offset + 3] = 255;
    };
    // Each pose: a 4-wide torso over a pair of legs, drawn at its own x and
    // baseline. The red channel marks which frame a pixel came from.
    for (let frame = 0; frame < frames; frame += 1) {
      const left = frame * cell + 6 + (frame % 3);
      const feet = 35 - (frame === 3 ? 2 : 0);
      for (let y = 5; y <= feet; y += 1)
        for (let x = 0; x < 4; x += 1) paint(left + x, y, 10 + frame);
    }

    const aligned = alignWalkPoses(pixels, width, height, frames);
    const opaqueColumns = (cellIndex: number, y: number) =>
      Array.from({ length: cell }, (_, x) => x).filter(
        (x) =>
          (aligned.pixels[(y * aligned.width + cellIndex * cell + x) * 4 + 3] ??
            0) > 0,
      );
    const lowestRow = (cellIndex: number) => {
      for (let y = height - 1; y >= 0; y -= 1)
        if (opaqueColumns(cellIndex, y).length) return y;
      return -1;
    };
    const redAt = (cellIndex: number, y: number) => {
      const x = opaqueColumns(cellIndex, y)[0] ?? 0;
      return aligned.pixels[(y * aligned.width + cellIndex * cell + x) * 4];
    };

    expect(aligned.width).toBe(width + cell);
    // Walk frames sit on the idle torso and the idle baseline.
    [2, 3, 4].forEach((frame) => {
      expect(opaqueColumns(frame, 10)).toEqual(opaqueColumns(0, 10));
      expect(lowestRow(frame)).toBe(lowestRow(0));
    });
    // The passing pose: stride upper body, idle legs.
    expect(redAt(frames, 8)).toBe(13);
    expect(redAt(frames, 34)).toBe(10);
  });

  it('never pushes a far-reaching pose out of its cell', () => {
    const cell = 20;
    const frames = 8;
    const width = cell * frames;
    const height = 30;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number) => {
      pixels[(y * width + x) * 4 + 3] = 255;
    };
    for (let frame = 0; frame < frames; frame += 1) {
      const left = frame * cell;
      // Torsos sit at x 14 in the idle cell but x 2 in the last cell, whose
      // pose also reaches to the cell's right edge.
      const torso = frame === 7 ? 2 : 14;
      for (let y = 4; y < 26; y += 1) paint(left + torso, y);
      if (frame === 7) for (let x = 2; x < cell; x += 1) paint(left + x, 20);
    }
    const before = Array.from(pixels).filter(
      (value, index) => index % 4 === 3 && value > 0,
    ).length;

    const aligned = alignWalkPoses(pixels, width, height, frames);
    const lastCell = Array.from(aligned.pixels).filter(
      (value, index) =>
        index % 4 === 3 &&
        value > 0 &&
        Math.floor(index / 4) % aligned.width >= 7 * cell &&
        Math.floor(index / 4) % aligned.width < 8 * cell,
    ).length;

    expect(lastCell).toBe(22 + 18 - 1);
    expect(before).toBeGreaterThan(0);
  });
});
