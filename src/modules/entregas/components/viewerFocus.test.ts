import assert from "node:assert/strict";
import test from "node:test";
import { focusPhotoCrop, type ImageSize, type PhotoArea } from "./viewerFocus";

const viewport = { width: 390, height: 844 };
const area = { x: 12, y: 74, width: 366, height: 666 };

function assertGroupFits(
  crop: readonly number[],
  image: ImageSize,
  frame: ImageSize = viewport,
  usable: PhotoArea = area,
) {
  const result = focusPhotoCrop(crop, image, frame, usable);
  assert.ok(result);
  const fit = Math.min(frame.width / image.width, frame.height / image.height);
  const width = image.width * fit * result.scale;
  const height = image.height * fit * result.scale;
  const left = frame.width / 2 + result.x + (crop[0] - 0.5) * width;
  const top = frame.height / 2 + result.y + (crop[1] - 0.5) * height;
  assert.ok(left >= usable.x - 0.001, `left ${left} outside ${usable.x}`);
  assert.ok(top >= usable.y - 0.001, `top ${top} outside ${usable.y}`);
  assert.ok(
    left + crop[2] * width <= usable.x + usable.width + 0.001,
    "right side of group cut",
  );
  assert.ok(
    top + crop[3] * height <= usable.y + usable.height + 0.001,
    "feet below action bar",
  );
  assert.ok(result.scale >= 1 && result.scale <= 4);
  return result;
}

test("portrait Story keeps a group on the left and their heads between controls", () => {
  const result = assertGroupFits([0.03, 0.2, 0.72, 0.58], {
    width: 1179,
    height: 2096,
  });
  assert.ok(result.x > 0, "the crop should move toward the visible center");
  assert.ok(
    result.scale < 2.25,
    "a whole group needs less magnification than the old fixed zoom",
  );
});

test("wide and square photos retain people near either image edge", () => {
  assertGroupFits([0, 0.08, 0.4, 0.8], { width: 1600, height: 1000 });
  assertGroupFits([0.55, 0.02, 0.4, 0.9], { width: 1080, height: 1080 });
  assertGroupFits([0.02, 0.01, 0.85, 0.97], { width: 900, height: 1200 });
});

test("short mobile screens reserve the actual header and action heights", () => {
  assertGroupFits(
    [0.05, 0.21, 0.75, 0.52],
    { width: 1080, height: 1920 },
    { width: 320, height: 568 },
    { x: 12, y: 74, width: 296, height: 386 },
  );
});

test("focus caps at four and never shrinks below the initial image", () => {
  const tiny = assertGroupFits([0.45, 0.45, 0.1, 0.1], {
    width: 1080,
    height: 1920,
  });
  assert.equal(tiny.scale, 4);
  const full = focusPhotoCrop(
    [0, 0, 1, 1],
    { width: 1080, height: 1920 },
    viewport,
    area,
  );
  assert.equal(full?.scale, 1);
});

test("missing or invalid rectangles leave the button's normal zoom fallback available", () => {
  for (const crop of [
    undefined,
    [],
    [0, 0, 0, 1],
    [0, 0, 2, 1],
    [0, Number.NaN, 1, 1],
  ]) {
    assert.equal(
      focusPhotoCrop(crop, { width: 1080, height: 1920 }, viewport, area),
      null,
    );
  }
});
