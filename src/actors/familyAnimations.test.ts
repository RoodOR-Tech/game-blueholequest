import { describe, expect, it } from 'vitest';
import { proportionalFrameBounds, removeSmallOpaqueComponents } from './familyAnimations';

describe('illustrated sprite cleanup', () => {
  it('removes isolated fragments while preserving the connected character', () => {
    const width = 40;
    const height = 40;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const paint = (x: number, y: number) => { pixels[(y * width + x) * 4 + 3] = 255; };
    for (let y = 5; y < 25; y += 1)
      for (let x = 4; x < 19; x += 1) paint(x, y);
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
    expect(bounds.slice(1).every((frame, index) => frame.x === bounds[index]!.x + bounds[index]!.width)).toBe(true);
    expect(bounds.map((frame) => frame.width)).toContain(263);
  });
});

