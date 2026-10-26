import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import {
  HERO_PHOTO_FADE_MS,
  HERO_PHOTO_LOAD_TIMEOUT_MS,
  useHomeHeroCarousel,
} from "../../src/design-system/components/patterns/useHomeHeroCarousel";

const cars = [
  { id: "a", image: "/a.webp", price: 100 },
  { id: "b", image: "/b.webp", price: 200 },
  { id: "c", image: "/c.webp", price: 300 },
];
type Car = (typeof cars)[number];
type Carousel = ReturnType<typeof useHomeHeroCarousel<Car>>;

function mountCarousel(t: TestContext, initial = cars, reducedMotion = false) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = new Map<number, { due: number; callback: () => void }>();
  let now = 0;
  let nextTimer = 0;
  let state: Carousel;
  let mounted = true;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout(callback: () => void, delay: number) {
        const id = ++nextTimer;
        timers.set(id, { callback, due: now + delay });
        return id;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
      matchMedia(query: string) {
        return {
          matches:
            reducedMotion && query === "(prefers-reduced-motion: reduce)",
        };
      },
    },
  });
  function Probe({ vehicles }: { vehicles: Car[] }) {
    state = useHomeHeroCarousel(vehicles);
    return null;
  }
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe vehicles={initial} />);
  });
  const unmount = () => {
    if (!mounted) return;
    act(() => renderer.unmount());
    mounted = false;
  };
  t.after(() => {
    unmount();
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  return {
    get state() {
      return state!;
    },
    get timerCount() {
      return timers.size;
    },
    step(direction = 1) {
      act(() => state!.step(direction));
    },
    ready(request: number) {
      act(() => state!.ready(request));
    },
    failed(request: number) {
      act(() => state!.failed(request));
    },
    update(vehicles: Car[]) {
      act(() => renderer.update(<Probe vehicles={vehicles} />));
    },
    unmount,
    advance(ms: number) {
      const end = now + ms;
      while (timers.size > 0) {
        const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        now = next[1].due;
        timers.delete(next[0]);
        act(next[1].callback);
      }
      now = end;
    },
  };
}

function pendingRequest(carousel: ReturnType<typeof mountCarousel>) {
  const request = carousel.state.slides.find(
    (slide) => slide.state === "pending",
  )?.request;
  assert.notEqual(request, undefined, "a requested photo should be staged");
  return request!;
}

test("initial photo is immediately active with one slot and no prepared stock", (t) => {
  const carousel = mountCarousel(t);
  assert.equal(carousel.state.active, cars[0]);
  assert.equal(carousel.state.hasSwitched, false);
  assert.deepEqual(carousel.state.slides, [
    { vehicle: cars[0], state: "active" },
  ]);
  carousel.advance(11999);
  assert.equal(carousel.state.slides.length, 1);
  carousel.advance(1);
  assert.equal(carousel.state.slides.length, 2);
  assert.equal(carousel.state.active, cars[0]);
  assert.equal(carousel.state.slides[1].vehicle, cars[1]);
});

test("pending load retains current vehicle and price until ready, then removes old slot", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  assert.equal(carousel.state.active?.price, 100);
  assert.deepEqual(
    carousel.state.slides.map((slide) => slide.state),
    ["active", "pending"],
  );
  carousel.advance(HERO_PHOTO_LOAD_TIMEOUT_MS - 1);
  assert.equal(
    pendingRequest(carousel),
    request,
    "autoplay must not accumulate requests while loading",
  );
  assert.equal(
    carousel.timerCount,
    1,
    "only the load deadline remains while loading",
  );
  carousel.ready(request);
  assert.equal(carousel.state.active?.price, 200);
  assert.equal(carousel.state.hasSwitched, true);
  assert.deepEqual(
    carousel.state.slides.map((slide) => [slide.vehicle.id, slide.state]),
    [
      ["a", "outgoing"],
      ["b", "active"],
    ],
  );
  carousel.advance(HERO_PHOTO_FADE_MS - 1);
  assert.equal(carousel.state.slides.length, 2);
  carousel.advance(1);
  assert.deepEqual(carousel.state.slides, [
    { vehicle: cars[1], state: "active" },
  ]);
  carousel.advance(11999);
  assert.equal(carousel.state.slides.length, 1);
  carousel.advance(1);
  assert.equal(
    carousel.state.slides[1].vehicle.id,
    "c",
    "autoplay restarts after the fade settles",
  );
});

test("image failure keeps current vehicle and unlocks the next request", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const failedRequest = pendingRequest(carousel);
  carousel.failed(failedRequest);
  assert.equal(carousel.state.active, cars[0]);
  assert.equal(carousel.state.hasSwitched, false);
  assert.equal(carousel.state.slides.length, 1);
  carousel.step(-1);
  assert.equal(carousel.state.slides[1].vehicle.id, "c");
  assert.notEqual(pendingRequest(carousel), failedRequest);
});

test("stalled photo times out without changing the car and late readiness is ignored", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  carousel.advance(HERO_PHOTO_LOAD_TIMEOUT_MS - 1);
  assert.equal(pendingRequest(carousel), request);
  carousel.advance(1);
  assert.equal(carousel.state.active, cars[0]);
  assert.equal(carousel.state.slides.length, 1);
  carousel.ready(request);
  assert.equal(carousel.state.active, cars[0]);
  carousel.step(-1);
  assert.equal(carousel.state.slides[1].vehicle.id, "c");
});

test("rapid navigation cannot add a third slot or replace a pending request", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  carousel.step();
  carousel.step(-1);
  assert.equal(pendingRequest(carousel), request);
  assert.equal(carousel.state.slides.length, 2);
  carousel.ready(request);
  carousel.step();
  carousel.step(-1);
  assert.equal(carousel.state.active?.id, "b");
  assert.equal(carousel.state.slides.length, 2);
  carousel.advance(HERO_PHOTO_FADE_MS);
  carousel.step();
  assert.equal(carousel.state.slides[1].vehicle.id, "c");
});

test("reordered stock keeps IDs stable and commits fresh target metadata", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  const updatedB = { ...cars[1], price: 250 };
  carousel.update([cars[2], updatedB, cars[0]]);
  assert.equal(carousel.state.active?.id, "a");
  assert.equal(pendingRequest(carousel), request);
  carousel.ready(request);
  assert.equal(carousel.state.active, updatedB);
  carousel.advance(HERO_PHOTO_FADE_MS);
  carousel.step();
  assert.equal(carousel.state.slides[1].vehicle.id, "a");
});

test("removing a requested vehicle cancels its callback and preserves the current car", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  carousel.update([cars[0], cars[2]]);
  assert.equal(carousel.state.slides.length, 1);
  carousel.ready(request);
  assert.equal(carousel.state.active?.id, "a");
  carousel.step();
  assert.equal(carousel.state.slides[1].vehicle.id, "c");
});

test("removing current vehicle or replacing requested image invalidates the old swap", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  carousel.update([cars[1], cars[2]]);
  assert.equal(carousel.state.active?.id, "b");
  assert.equal(carousel.state.slides.length, 1);
  carousel.ready(request);
  assert.equal(carousel.state.slides.length, 1);
  carousel.step();
  const replacedRequest = pendingRequest(carousel);
  carousel.update([cars[1], { ...cars[2], image: "/c-new.webp" }]);
  carousel.ready(replacedRequest);
  assert.equal(carousel.state.active?.id, "b");
  assert.equal(carousel.state.slides.length, 1);
});

test("stale decode and error callbacks cannot cancel or commit a newer request", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const stale = pendingRequest(carousel);
  carousel.failed(stale);
  carousel.step(-1);
  const current = pendingRequest(carousel);
  carousel.ready(stale);
  carousel.failed(stale);
  assert.equal(pendingRequest(carousel), current);
  assert.equal(carousel.state.active?.id, "a");
  carousel.ready(current);
  assert.equal(carousel.state.active?.id, "c");
});

test("unmount clears timers and ignores deferred image callbacks", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  carousel.ready(request);
  const beforeUnmount = carousel.state;
  assert.ok(carousel.timerCount > 0);
  carousel.unmount();
  assert.equal(carousel.timerCount, 0);
  carousel.ready(request);
  carousel.failed(request);
  carousel.step();
  carousel.advance(60000);
  assert.equal(carousel.state, beforeUnmount);
  assert.equal(carousel.timerCount, 0);
});

test("pending decode completion after unmount cannot mutate the carousel", (t) => {
  const carousel = mountCarousel(t);
  carousel.step();
  const request = pendingRequest(carousel);
  const beforeUnmount = carousel.state;
  carousel.unmount();
  carousel.ready(request);
  carousel.failed(request);
  carousel.advance(HERO_PHOTO_LOAD_TIMEOUT_MS);
  assert.equal(carousel.state, beforeUnmount);
  assert.equal(carousel.timerCount, 0);
});

test("reduced motion still waits for ready, then swaps without retaining an outgoing photo", (t) => {
  const carousel = mountCarousel(t, cars, true);
  carousel.step();
  const request = pendingRequest(carousel);
  assert.equal(carousel.state.active?.id, "a");
  carousel.ready(request);
  assert.equal(carousel.state.active?.id, "b");
  assert.deepEqual(carousel.state.slides, [
    { vehicle: cars[1], state: "active" },
  ]);
  assert.equal(carousel.state.hasSwitched, true);
  carousel.step();
  assert.equal(carousel.state.slides[1].vehicle.id, "c");
});

test("empty and single-item stock do not schedule speculative transitions", (t) => {
  const carousel = mountCarousel(t, []);
  assert.equal(carousel.state.active, undefined);
  assert.deepEqual(carousel.state.slides, []);
  assert.equal(carousel.timerCount, 0);
  carousel.step();
  carousel.update([cars[0]]);
  carousel.advance(60000);
  carousel.step(-1);
  assert.deepEqual(carousel.state.slides, [
    { vehicle: cars[0], state: "active" },
  ]);
  assert.equal(carousel.timerCount, 0);
});

test("stock arriving after empty state preserves the selected ID across reordering", (t) => {
  const carousel = mountCarousel(t, []);
  carousel.update(cars);
  assert.equal(carousel.state.active?.id, "a");
  carousel.update([cars[1], cars[0], cars[2]]);
  assert.equal(carousel.state.active?.id, "a");
  carousel.update([cars[1], cars[2]]);
  assert.equal(carousel.state.active?.id, "b");
  carousel.update(cars);
  assert.equal(
    carousel.state.active?.id,
    "b",
    "reintroducing an old ID should not change the fallback selection",
  );
});
