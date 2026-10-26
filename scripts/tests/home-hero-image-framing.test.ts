import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fitHeroImage,
  getAlphaBounds,
  type HeroImageBounds,
  type HeroImageSize,
} from "../../src/lib/homeHeroImageFraming";

const full = { x: 0, y: 0, width: 1, height: 1 };

function thumbnail(
  width: number,
  height: number,
  rect: { x: number; y: number; width: number; height: number },
  alpha = 255,
  backgroundAlpha = 0,
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside =
        x >= rect.x &&
        x < rect.x + rect.width &&
        y >= rect.y &&
        y < rect.y + rect.height;
      data[(y * width + x) * 4 + 3] = inside ? alpha : backgroundAlpha;
    }
  }
  return data;
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ≠ ${expected}`);
}

function assertFramed(
  bounds: HeroImageBounds,
  natural: HeroImageSize,
  frame: HeroImageSize,
) {
  const fit = fitHeroImage(bounds, natural, frame);
  const visibleWidth = fit.width * bounds.width;
  const visibleHeight = fit.height * bounds.height;
  assert.ok(fit.width > 0 && fit.height > 0);
  for (const value of Object.values(fit)) assert.ok(Number.isFinite(value));
  close(fit.width / fit.height, natural.width / natural.height);
  close(fit.left + fit.width * bounds.x + visibleWidth / 2, frame.width / 2);
  close(fit.top + fit.height * bounds.y + visibleHeight / 2, frame.height / 2);
  assert.ok(visibleWidth <= frame.width + 0.000001);
  assert.ok(visibleHeight <= frame.height + 0.000001);
  assert.ok(
    Math.abs(visibleWidth - frame.width) < 0.000001 ||
      Math.abs(visibleHeight - frame.height) < 0.000001,
  );
  return fit;
}

test("alpha bounds retain one thumbnail pixel around the foreground", () => {
  const data = thumbnail(10, 10, { x: 4, y: 3, width: 2, height: 3 });
  assert.deepEqual(getAlphaBounds(data, 10, 10), {
    x: 0.3,
    y: 0.2,
    width: 0.4,
    height: 0.5,
  });
});

test("alpha threshold ignores faint shadows but keeps semi-transparent foreground", () => {
  const data = thumbnail(20, 20, { x: 5, y: 4, width: 10, height: 12 }, 33, 32);
  assert.deepEqual(getAlphaBounds(data, 20, 20), {
    x: 0.2,
    y: 0.15,
    width: 0.6,
    height: 0.7,
  });
});

test("padding clamps to image edges", () => {
  const data = thumbnail(10, 10, { x: 0, y: 6, width: 5, height: 4 });
  assert.deepEqual(getAlphaBounds(data, 10, 10), {
    x: 0,
    y: 0.5,
    width: 0.6,
    height: 0.5,
  });
});

test("opaque and empty alpha images retain their full frame", () => {
  assert.deepEqual(
    getAlphaBounds(
      thumbnail(32, 20, { x: 0, y: 0, width: 32, height: 20 }),
      32,
      20,
    ),
    full,
  );
  assert.deepEqual(
    getAlphaBounds(new Uint8ClampedArray(32 * 20 * 4), 32, 20),
    full,
  );
});

test("tiny artefacts and one-pixel lines are never enlarged", () => {
  for (const rect of [
    { x: 64, y: 64, width: 1, height: 1 },
    { x: 64, y: 64, width: 4, height: 4 },
    { x: 0, y: 64, width: 128, height: 1 },
  ])
    assert.deepEqual(getAlphaBounds(thumbnail(128, 128, rect), 128, 128), full);
});

test("invalid thumbnail dimensions or truncated data fall back safely", () => {
  for (const [width, height] of [
    [0, 10],
    [-1, 10],
    [10, 0],
    [2.5, 2],
    [Infinity, 2],
    [NaN, 2],
  ]) {
    assert.deepEqual(
      getAlphaBounds(new Uint8ClampedArray(400), width, height),
      full,
    );
  }
  assert.deepEqual(getAlphaBounds(new Uint8ClampedArray(399), 10, 10), full);
});

test("different Tera/Kicks-style transparent margins yield the same visible width", () => {
  const natural = { width: 200, height: 140 };
  const frame = { width: 720, height: 500 };
  const tera = getAlphaBounds(
    thumbnail(200, 140, { x: 39, y: 35, width: 122, height: 70 }),
    200,
    140,
  );
  const kicks = getAlphaBounds(
    thumbnail(200, 140, { x: 14, y: 15, width: 172, height: 98 }),
    200,
    140,
  );
  const teraFit = assertFramed(tera, natural, frame);
  const kicksFit = assertFramed(kicks, natural, frame);
  close(teraFit.width * tera.width, 720);
  close(kicksFit.width * kicks.width, 720);
  assert.ok(
    teraFit.width > kicksFit.width,
    "the canvas with more empty margin needs more compensation",
  );
});

test("landscape and portrait images fit without distortion in narrow and wide frames", () => {
  for (const natural of [
    { width: 900, height: 500 },
    { width: 400, height: 900 },
    { width: 800, height: 800 },
  ]) {
    for (const frame of [
      { width: 320, height: 240 },
      { width: 800, height: 400 },
    ]) {
      for (const bounds of [
        full,
        { x: 0.2, y: 0.1, width: 0.6, height: 0.8 },
      ]) {
        assertFramed(bounds, natural, frame);
      }
    }
  }
});

test("asymmetric transparent margins are centered by the visible content", () => {
  const fit = assertFramed(
    { x: 0.3, y: 0.2, width: 0.5, height: 0.6 },
    { width: 1000, height: 500 },
    { width: 600, height: 400 },
  );
  assert.ok(
    fit.left < 0,
    "negative canvas offsets compensate transparent padding",
  );
});

test("invalid bounds preserve the full image instead of producing a crop", () => {
  const expected = { width: 600, height: 300, left: 0, top: 50 };
  for (const bounds of [
    { x: -0.1, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: 0, y: 0, width: 1, height: NaN },
    { x: 0.8, y: 0, width: 0.4, height: 1 },
    { x: 0, y: Infinity, width: 1, height: 1 },
  ])
    assert.deepEqual(
      fitHeroImage(
        bounds,
        { width: 400, height: 200 },
        { width: 600, height: 400 },
      ),
      expected,
    );
});

test("invalid or missing dimensions produce finite safe CSS values", () => {
  for (const frame of [
    { width: 0, height: 200 },
    { width: 200, height: -1 },
    { width: Infinity, height: 200 },
  ]) {
    assert.deepEqual(fitHeroImage(full, { width: 800, height: 500 }, frame), {
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    });
  }
  for (const natural of [
    { width: 0, height: 200 },
    { width: 200, height: NaN },
  ]) {
    assert.deepEqual(fitHeroImage(full, natural, { width: 400, height: 300 }), {
      width: 400,
      height: 300,
      left: 0,
      top: 0,
    });
  }
  assert.deepEqual(
    fitHeroImage(
      { x: 0, y: 0, width: Number.MIN_VALUE, height: Number.MIN_VALUE },
      { width: 2, height: 2 },
      { width: 400, height: 300 },
    ),
    { width: 400, height: 300, left: 0, top: 0 },
  );
});
