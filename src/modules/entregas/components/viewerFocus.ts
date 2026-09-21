export type ImageSize = { width: number; height: number };
export type PhotoTransform = { scale: number; x: number; y: number };
export type PhotoArea = ImageSize & { x: number; y: number };

export function clampFocusedPhoto(
  next: PhotoTransform,
  image: ImageSize,
  viewport: ImageSize,
  area: PhotoArea,
): PhotoTransform {
  const scale = Math.min(4, Math.max(1, next.scale));
  const fit = Math.min(
    viewport.width / image.width,
    viewport.height / image.height,
  );
  const clampAxis = (
    value: number,
    length: number,
    viewportLength: number,
    start: number,
    available: number,
  ) => {
    const first = start - viewportLength / 2 + length / 2;
    const last = start + available - viewportLength / 2 - length / 2;
    // Allow the image to use space behind the controls, but never require the
    // group to sit there. A smaller image stays entirely in the useful area.
    return Math.max(
      Math.min(first, last),
      Math.min(Math.max(first, last), value),
    );
  };
  return {
    scale,
    x: clampAxis(
      next.x,
      image.width * fit * scale,
      viewport.width,
      area.x,
      area.width,
    ),
    y: clampAxis(
      next.y,
      image.height * fit * scale,
      viewport.height,
      area.y,
      area.height,
    ),
  };
}

/** Fit a reviewed group rectangle; never infer the position of people. */
export function focusPhotoCrop(
  crop: readonly number[] | undefined,
  image: ImageSize,
  viewport: ImageSize,
  area: PhotoArea,
): PhotoTransform | null {
  if (!crop || crop.length !== 4 || !crop.every(Number.isFinite)) return null;
  const [x, y, width, height] = crop;
  if (
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > 1.000001 ||
    y + height > 1.000001 ||
    image.width <= 0 ||
    image.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    area.width <= 0 ||
    area.height <= 0
  )
    return null;
  const fit = Math.min(
    viewport.width / image.width,
    viewport.height / image.height,
  );
  const fittedWidth = image.width * fit;
  const fittedHeight = image.height * fit;
  const scale = Math.max(
    1,
    Math.min(
      4,
      area.width / (width * fittedWidth),
      area.height / (height * fittedHeight),
    ),
  );
  return clampFocusedPhoto(
    {
      scale,
      x:
        area.x +
        area.width / 2 -
        viewport.width / 2 -
        (x + width / 2 - 0.5) * fittedWidth * scale,
      y:
        area.y +
        area.height / 2 -
        viewport.height / 2 -
        (y + height / 2 - 0.5) * fittedHeight * scale,
    },
    image,
    viewport,
    area,
  );
}
