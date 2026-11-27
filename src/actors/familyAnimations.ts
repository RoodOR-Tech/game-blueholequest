import Phaser from 'phaser';
import type { TeamId } from '../content/teams';

// Phaser.Textures.FilterMode.LINEAR, kept numeric so this module loads in tests
// without a browser. Detailed illustrations are smoothed when drawn small.
const SMOOTH_FILTER = 0 as Phaser.Textures.FilterMode;

// Every sheet holds eight poses in 724-pixel-tall frames with feet on row 600:
// idle ×2, walk ×3, jump, attack ×2.
const SHEETS: Readonly<
  Record<TeamId, { key: string; path: string; scale: number }>
> = {
  dad_paula: {
    key: 'dad-sprites-v2',
    path: 'assets/sprites/dad-sprites-v2.png',
    scale: 0.16,
  },
  jen_omar: {
    key: 'jen-sprites-v1',
    path: 'assets/sprites/jen-sprites-v1.png',
    scale: 0.16,
  },
  joe_cia: {
    key: 'joe-sprites-v1',
    path: 'assets/sprites/joe-sprites-v1.png',
    scale: 0.16,
  },
  kris_lea: {
    key: 'kris-sprites-v1',
    path: 'assets/sprites/kris-sprites-v1.png',
    scale: 0.16,
  },
  jason_hilary: {
    key: 'jason-sprites-v1',
    path: 'assets/sprites/jason-sprites-v1.png',
    scale: 0.16,
  },
};

/** Width of the original pose cells on each cleaned sheet, by texture key. */
const poseSheetWidths = new Map<string, number>();

export function preloadFamilySprites(scene: Phaser.Scene): void {
  Object.values(SHEETS).forEach((sheet) =>
    scene.load.image(sheet.key, sheet.path),
  );
}

export function registerFamilyAnimations(scene: Phaser.Scene): void {
  (Object.keys(SHEETS) as TeamId[]).forEach((teamId) => {
    const sheet = SHEETS[teamId];
    const texture = cleanConnectedBackground(scene, sheet.key, 8, true);
    const image = texture.getSourceImage() as HTMLCanvasElement;
    const poseWidth = poseSheetWidths.get(texture.key) ?? image.width;
    const frames = Array.from(
      { length: 8 },
      (_, index) => `${teamId}-frame-${index}`,
    );
    frames.forEach((frame, index) => {
      const bounds = proportionalFrameBounds(poseWidth, 8, index);
      if (!texture.has(frame))
        texture.add(frame, 0, bounds.x, 0, bounds.width, image.height);
    });
    const passing = `${teamId}-frame-passing`;
    const hasPassing = image.width > poseWidth;
    if (hasPassing && !texture.has(passing))
      texture.add(
        passing,
        0,
        poseWidth,
        0,
        image.width - poseWidth,
        image.height,
      );
    createAnimation(
      scene,
      `${teamId}-idle`,
      sheet.key,
      frames.slice(0, 2),
      2,
      -1,
    );
    // The sheets only hold mid-stride poses, so the walk steps through a
    // built passing pose between strides; otherwise the legs never close.
    createAnimation(
      scene,
      `${teamId}-walk`,
      sheet.key,
      hasPassing
        ? [frames[2]!, passing, frames[4]!, passing]
        : frames.slice(2, 5),
      9,
      -1,
    );
    createAnimation(
      scene,
      `${teamId}-attack`,
      sheet.key,
      frames.slice(6, 8),
      10,
      0,
    );
  });
}

export function cleanConnectedBackground(
  scene: Phaser.Scene,
  sourceKey: string,
  frameCount = 8,
  buildWalkCycle = false,
): Phaser.Textures.Texture {
  const source = scene.textures
    .get(sourceKey)
    .getSourceImage() as HTMLImageElement;
  const cleanKey = `${sourceKey}-clean`;
  if (scene.textures.exists(cleanKey)) return scene.textures.get(cleanKey);
  const workCanvas = document.createElement('canvas');
  workCanvas.width = source.width;
  workCanvas.height = source.height;
  const context = workCanvas.getContext('2d');
  if (!context) return scene.textures.get(sourceKey);
  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const visited = new Uint8Array(source.width * source.height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number) => {
    const position = y * source.width + x;
    if (visited[position]) return;
    visited[position] = 1;
    const offset = position * 4;
    const red = pixels.data[offset] ?? 0;
    const green = pixels.data[offset + 1] ?? 0;
    const blue = pixels.data[offset + 2] ?? 0;
    const paleNeutral =
      red >= 218 &&
      green >= 218 &&
      blue >= 218 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) <= 18;
    if (paleNeutral) queue.push(position);
  };
  for (let x = 0; x < source.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, source.height - 1);
  }
  for (let y = 0; y < source.height; y += 1) {
    enqueue(0, y);
    enqueue(source.width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const position = queue[cursor]!;
    const x = position % source.width;
    const y = Math.floor(position / source.width);
    pixels.data[position * 4 + 3] = 0;
    if (x > 0) enqueue(x - 1, y);
    if (x + 1 < source.width) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y + 1 < source.height) enqueue(x, y + 1);
  }
  const packed = packOpaquePoses(
    pixels.data,
    source.width,
    source.height,
    frameCount,
  );
  const sheet = buildWalkCycle
    ? alignWalkPoses(packed.pixels, packed.width, source.height, frameCount)
    : { pixels: packed.pixels, width: packed.width };
  const canvasTexture = scene.textures.createCanvas(
    cleanKey,
    sheet.width,
    source.height,
  );
  if (!canvasTexture) return scene.textures.get(sourceKey);
  // The pose cells keep their original layout; a passing pose, if built,
  // sits in one extra cell past them.
  poseSheetWidths.set(cleanKey, packed.width);
  const packedImage = canvasTexture.context.createImageData(
    sheet.width,
    source.height,
  );
  packedImage.data.set(sheet.pixels);
  canvasTexture.context.putImageData(packedImage, 0, 0);
  canvasTexture.refresh();
  // The sheets are detailed illustrations drawn well below full size.
  canvasTexture.setFilter(SMOOTH_FILTER);
  scene.textures.remove(sourceKey);
  return canvasTexture;
}

export function packOpaquePoses(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frameCount: number,
): { pixels: Uint8ClampedArray; width: number } {
  const visited = new Uint8Array(width * height);
  const components: number[][] = [];
  for (let position = 0; position < width * height; position += 1) {
    if (visited[position] || pixels[position * 4 + 3] === 0) continue;
    const component: number[] = [];
    const pending = [position];
    visited[position] = 1;
    for (let cursor = 0; cursor < pending.length; cursor += 1) {
      const current = pending[cursor]!;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) continue;
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height)
            continue;
          const next = nextY * width + nextX;
          if (visited[next]) continue;
          visited[next] = 1;
          if (pixels[next * 4 + 3] !== 0) pending.push(next);
        }
      }
    }
    components.push(component);
  }
  const poses = components
    .sort((a, b) => b.length - a.length)
    .slice(0, frameCount)
    .map((component) => ({
      component,
      minimumX: Math.min(...component.map((position) => position % width)),
      maximumX: Math.max(...component.map((position) => position % width)),
    }))
    .sort((a, b) => a.minimumX - b.minimumX);
  if (poses.length !== frameCount) return { pixels, width };
  const cellWidth =
    Math.max(...poses.map((pose) => pose.maximumX - pose.minimumX + 1)) + 12;
  const packedWidth = cellWidth * frameCount;
  const packed = new Uint8ClampedArray(packedWidth * height * 4);
  poses.forEach((pose, frame) => {
    const poseWidth = pose.maximumX - pose.minimumX + 1;
    const destinationX =
      frame * cellWidth + Math.floor((cellWidth - poseWidth) / 2);
    pose.component.forEach((position) => {
      const sourceX = position % width;
      const y = Math.floor(position / width);
      const destination =
        (y * packedWidth + destinationX + sourceX - pose.minimumX) * 4;
      const sourceOffset = position * 4;
      packed.set(pixels.subarray(sourceOffset, sourceOffset + 4), destination);
    });
  });
  return { pixels: packed, width: packedWidth };
}

interface PoseMeasure {
  readonly top: number;
  readonly bottom: number;
  /** Mean x of the head and chest, relative to the cell. */
  readonly torsoX: number;
}

function measurePose(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  cellX: number,
  cellWidth: number,
): PoseMeasure | null {
  const opaque = (x: number, y: number) =>
    (pixels[(y * width + cellX + x) * 4 + 3] ?? 0) > 10;
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height && top < 0; y += 1)
    for (let x = 0; x < cellWidth; x += 1)
      if (opaque(x, y)) {
        top = y;
        break;
      }
  for (let y = height - 1; y >= 0 && bottom < 0; y -= 1)
    for (let x = 0; x < cellWidth; x += 1)
      if (opaque(x, y)) {
        bottom = y;
        break;
      }
  if (top < 0 || bottom <= top) return null;
  const span = bottom - top;
  let sum = 0;
  let count = 0;
  for (let y = top + Math.floor(span * 0.08); y < top + span * 0.4; y += 1)
    for (let x = 0; x < cellWidth; x += 1)
      if (opaque(x, y)) {
        sum += x;
        count += 1;
      }
  return count ? { top, bottom, torsoX: sum / count } : null;
}

/**
 * Lines every pose up on the idle pose's torso so the body does not slide
 * between frames, and stands the idle and walk poses on one baseline. Then
 * appends a passing pose (legs together) built from the second walk frame's
 * upper body over the idle legs, since the sheets only draw wide strides.
 */
export function alignWalkPoses(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frameCount: number,
): { pixels: Uint8ClampedArray; width: number } {
  const cells = Array.from({ length: frameCount }, (_, index) =>
    proportionalFrameBounds(width, frameCount, index),
  );
  const measures = cells.map((cell) =>
    measurePose(pixels, width, height, cell.x, cell.width),
  );
  const reference = measures[0];
  const strideCell = cells[3];
  if (!reference || !strideCell || measures.some((pose) => !pose))
    return { pixels, width };
  const outputWidth = width + strideCell.width;
  const output = new Uint8ClampedArray(outputWidth * height * 4);
  const copy = (
    fromCell: { x: number; width: number },
    toX: number,
    dx: number,
    dy: number,
    rows: (y: number) => boolean,
  ) => {
    for (let y = 0; y < height; y += 1) {
      const targetY = y + dy;
      if (targetY < 0 || targetY >= height || !rows(targetY)) continue;
      for (let x = 0; x < fromCell.width; x += 1) {
        const targetX = x + dx;
        if (targetX < 0 || targetX >= fromCell.width) continue;
        const from = (y * width + fromCell.x + x) * 4;
        if ((pixels[from + 3] ?? 0) === 0) continue;
        const to = (targetY * outputWidth + toX + targetX) * 4;
        output.set(pixels.subarray(from, from + 4), to);
      }
    }
  };
  // Idle and walk poses share the idle baseline; jump and attack poses keep
  // their own height and are only lined up sideways.
  const offset = (index: number) => {
    const pose = measures[index]!;
    return {
      dx: Math.round(reference.torsoX - pose.torsoX),
      dy: index <= 4 ? reference.bottom - pose.bottom : 0,
    };
  };
  cells.forEach((cell, index) => {
    const { dx, dy } = offset(index);
    copy(cell, cell.x, dx, dy, () => true);
  });
  // Passing pose: the stride's upper body down to the hips, idle legs below.
  const stride = measures[3]!;
  const strideShift = offset(3);
  const hipY =
    stride.top +
    strideShift.dy +
    Math.round((stride.bottom - stride.top) * 0.6);
  const idleCell = cells[0]!;
  copy(idleCell, width, 0, 0, (y) => y >= hipY);
  copy(strideCell, width, strideShift.dx, strideShift.dy, (y) => y < hipY);
  return { pixels: output, width: outputWidth };
}

export function proportionalFrameBounds(
  sheetWidth: number,
  frameCount: number,
  frameIndex: number,
): { x: number; width: number } {
  const x = Math.round((frameIndex * sheetWidth) / frameCount);
  const end = Math.round(((frameIndex + 1) * sheetWidth) / frameCount);
  return { x, width: end - x };
}

/** Removes isolated generation debris without erasing any connected character detail. */
export function removeSmallOpaqueComponents(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  frameCount: number,
): void {
  const averageFrameWidth = width / frameCount;
  const minimumComponentPixels = Math.max(
    240,
    Math.floor(averageFrameWidth * height * 0.0015),
  );
  for (let frame = 0; frame < frameCount; frame += 1) {
    const bounds = proportionalFrameBounds(width, frameCount, frame);
    const startX = bounds.x;
    const endX = startX + bounds.width;
    const visited = new Uint8Array((endX - startX) * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const local = y * (endX - startX) + x - startX;
        if (visited[local] || pixels[(y * width + x) * 4 + 3] === 0) continue;
        const component: number[] = [];
        const pending = [y * width + x];
        visited[local] = 1;
        for (let cursor = 0; cursor < pending.length; cursor += 1) {
          const position = pending[cursor]!;
          component.push(position);
          const currentX = position % width;
          const currentY = Math.floor(position / width);
          for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
            for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
              if (offsetX === 0 && offsetY === 0) continue;
              const nextX = currentX + offsetX;
              const nextY = currentY + offsetY;
              if (
                nextX < startX ||
                nextX >= endX ||
                nextY < 0 ||
                nextY >= height
              )
                continue;
              const nextLocal = nextY * (endX - startX) + nextX - startX;
              if (visited[nextLocal]) continue;
              visited[nextLocal] = 1;
              const nextPosition = nextY * width + nextX;
              if (pixels[nextPosition * 4 + 3] !== 0)
                pending.push(nextPosition);
            }
          }
        }
        if (component.length < minimumComponentPixels)
          component.forEach((position) => {
            pixels[position * 4 + 3] = 0;
          });
      }
    }
  }
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  texture: string,
  frames: string[],
  frameRate: number,
  repeat: number,
): void {
  if (!scene.anims.exists(key))
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: `${texture}-clean`, frame })),
      frameRate,
      repeat,
    });
}

export function playerVisual(teamId: TeamId) {
  const sheet = SHEETS[teamId];
  return {
    texture: `${sheet.key}-clean`,
    frame: `${teamId}-frame-0`,
    scale: sheet.scale,
    idle: `${teamId}-idle`,
    walk: `${teamId}-walk`,
    attack: `${teamId}-attack`,
    jumpTexture: `${sheet.key}-clean`,
    jumpFrame: `${teamId}-frame-5`,
  };
}

export function configurePlayerBody(
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  teamId: TeamId,
): void {
  sprite.body
    .setSize(teamId === 'jason_hilary' ? 190 : 165, 420)
    .setOffset(teamId === 'jason_hilary' ? 35 : 48, 180);
}
