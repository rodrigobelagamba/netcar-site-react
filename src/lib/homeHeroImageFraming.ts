export interface HeroImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeroImageSize {
  width: number;
  height: number;
}

export interface HeroImageFit extends HeroImageSize {
  left: number;
  top: number;
}

const fullFrame = (): HeroImageBounds => ({ x: 0, y: 0, width: 1, height: 1 });
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** Measure a small RGBA thumbnail; faint shadows do not determine car size. */
export function getAlphaBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): HeroImageBounds {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length < width * height * 4
  )
    return fullFrame();

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let foregroundPixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= 32) continue;
      foregroundPixels++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  // Empty/near-empty images and single-pixel noise must never be magnified.
  if (
    foregroundPixels < Math.max(4, width * height * 0.005) ||
    right - left < 1 ||
    bottom - top < 1
  )
    return fullFrame();

  const paddedLeft = Math.max(0, left - 1);
  const paddedTop = Math.max(0, top - 1);
  const paddedRight = Math.min(width, right + 2);
  const paddedBottom = Math.min(height, bottom + 2);
  return {
    x: paddedLeft / width,
    y: paddedTop / height,
    width: (paddedRight - paddedLeft) / width,
    height: (paddedBottom - paddedTop) / height,
  };
}

function validBounds(bounds: HeroImageBounds): boolean {
  return (
    Number.isFinite(bounds.x) &&
    bounds.x >= 0 &&
    Number.isFinite(bounds.y) &&
    bounds.y >= 0 &&
    positive(bounds.width) &&
    positive(bounds.height) &&
    bounds.x + bounds.width <= 1 + Number.EPSILON &&
    bounds.y + bounds.height <= 1 + Number.EPSILON
  );
}

/** Fit the visible car into a shared frame without changing its aspect ratio. */
export function fitHeroImage(
  bounds: HeroImageBounds,
  natural: HeroImageSize,
  frame: HeroImageSize,
): HeroImageFit {
  if (!positive(frame.width) || !positive(frame.height)) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  if (!positive(natural.width) || !positive(natural.height)) {
    return { width: frame.width, height: frame.height, left: 0, top: 0 };
  }

  const crop = validBounds(bounds) ? bounds : fullFrame();
  const scale = Math.min(
    frame.width / (natural.width * crop.width),
    frame.height / (natural.height * crop.height),
  );
  const width = natural.width * scale;
  const height = natural.height * scale;
  const fit = {
    width,
    height,
    left: (frame.width - width * crop.width) / 2 - width * crop.x,
    top: (frame.height - height * crop.height) / 2 - height * crop.y,
  };
  if (
    positive(width) &&
    positive(height) &&
    Number.isFinite(fit.left) &&
    Number.isFinite(fit.top)
  )
    return fit;

  // Guard arithmetic overflow from malformed metadata; never emit invalid CSS.
  return { width: frame.width, height: frame.height, left: 0, top: 0 };
}
