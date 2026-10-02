import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StoreGallery } from "../../src/modules/sobre/components/StoreGallery";
import {
  buildStoreGallery,
  storePhotoSource,
  storePhotoSrcSet,
  type StorePhoto,
} from "../../src/modules/sobre/storeGallery";
import { buildLojaMapsUrl } from "../../src/lib/formatters";

const origin = "https://www.netcarmultimarcas.com.br";

test("banner resizing opts into EXIF orientation at every gallery and thumbnail width", () => {
  const widths = [200, 320, 480, 640, 960, 1280];
  for (const source of [
    "/imagens/banner/652_photo.jpg",
    `${origin}/imagens/banner/652_photo.jpg`,
  ]) {
    const expected = widths.map(
      (width) =>
        `${origin}/img.php?src=%2Fimagens%2Fbanner%2F652_photo.jpg&w=${width}&orient=1`,
    );
    assert.deepEqual(
      widths.map((width) => storePhotoSource(source, width)),
      expected,
    );
    assert.equal(
      storePhotoSrcSet(source, widths),
      expected.map((url, index) => `${url} ${widths[index]}w`).join(", "),
    );
  }
});

test("local facades and images outside the banner directory retain ordinary resize URLs", () => {
  const widths = [200, 320, 480, 640, 960, 1280];
  for (const source of [
    "/images/loja1.webp",
    "/images/loja2.webp",
    "/imagens/veiculos/car.jpg",
  ]) {
    const expected = widths.map(
      (width) =>
        `${origin}/img.php?src=${encodeURIComponent(source)}&w=${width}`,
    );
    assert.deepEqual(
      widths.map((width) => storePhotoSource(source, width)),
      expected,
    );
    assert.equal(
      storePhotoSrcSet(source, widths),
      expected.map((url, index) => `${url} ${widths[index]}w`).join(", "),
    );
  }
});

test("AVIF photos preserve their original source and do not advertise fake responsive widths", () => {
  const widths = [200, 320, 480, 640, 960, 1280];
  for (const source of [
    "/imagens/banner/showroom.avif",
    `${origin}/imagens/banner/showroom.avif?v=2`,
  ]) {
    assert.ok(
      widths.every((width) => storePhotoSource(source, width) === source),
    );
    assert.equal(storePhotoSrcSet(source, widths), undefined);
  }
});

test("each store Maps URL identifies its own branch and coordinates", () => {
  assert.equal(
    buildLojaMapsUrl("Loja1"),
    "https://www.google.com/maps/search/Netcar%20Loja%201/@-29.8380385,-51.1702399,18z",
  );
  assert.equal(
    buildLojaMapsUrl("Loja2"),
    "https://www.google.com/maps/search/Netcar%20Loja%202/@-29.8411446,-51.1721442,18z",
  );
});

test("each store starts with its own local cover and retains only its API photo group", () => {
  const banners = [
    { imagem: "/imagens/banner/loja1.jpg", tipo: "Loja1" },
    { imagem: "/imagens/banner/loja2.jpg", tipo: "Loja2" },
    { imagem: "/imagens/banner/loja1-extra.png", tipo: " Loja 1 " },
    { imagem: "/imagens/banner/loja2-extra.webp", tipo: "LOJA2" },
    { imagem: "/imagens/banner/campaign.jpg", tipo: "Home" },
  ];
  for (const number of [1, 2] as const) {
    const photos = buildStoreGallery(`Loja${number}`, banners);
    assert.equal(photos[0].src, `/images/loja${number}.webp`);
    assert.equal(photos[0].alt, `Fachada da Loja ${number}`);
    assert.deepEqual(
      photos.slice(1).map((photo) => photo.src),
      [
        `${origin}/imagens/banner/loja${number}.jpg`,
        `${origin}/imagens/banner/loja${number}-extra.${number === 1 ? "png" : "webp"}`,
      ],
    );
    assert.ok(photos.every((photo) => photo.alt.includes(`Loja ${number}`)));
  }
});

test("gallery removes facade entries and duplicates across relative, absolute and query URLs", () => {
  const photos = buildStoreGallery("Loja1", [
    { imagem: "/imagens/banner/fachada.jpg", titulo: "FACHADA da loja" },
    { imagem: "/images/loja1.webp?version=2" },
    { imagem: `${origin}/images/loja1.webp` },
    { imagem: "/imagens/banner/interior.jpg?version=1" },
    { imagem: `${origin}/imagens/banner/interior.jpg?version=2#photo` },
    { imagem: " /imagens/banner/segunda.PNG " },
    { imagem: "\\imagens\\banner\\terceira.webp" },
  ]);
  assert.deepEqual(
    photos.map((photo) => new URL(photo.src, origin).pathname),
    [
      "/images/loja1.webp",
      "/imagens/banner/interior.jpg",
      "/imagens/banner/segunda.PNG",
      "/imagens/banner/terceira.webp",
    ],
  );
});

test("gallery accepts supported same-origin images and rejects external or non-image URLs", () => {
  const valid = ["jpg", "jpeg", "png", "webp", "avif"];
  const invalid = [
    "",
    "https://[invalid",
    "/imagens/banner/photo.heic",
    "/imagens/banner/photo.svg",
    "/imagens/banner/photo.pdf",
    "/imagens/banner/photo.jpg.exe",
    "/download.php?file=photo.jpg",
    "https://other.example/photo.jpg",
    "//other.example/photo.jpg",
    "http://www.netcarmultimarcas.com.br/photo.jpg",
    "data:image/jpeg;base64,ZmFrZQ==",
    "javascript:photo.jpg",
  ];
  const photos = buildStoreGallery("Loja2", [
    ...invalid.map((imagem) => ({ imagem })),
    ...valid.map((extension) => ({
      imagem: `${origin}/imagens/banner/photo.${extension}?v=1`,
    })),
  ]);
  assert.deepEqual(
    photos.slice(1).map((photo) => photo.src),
    valid.map((extension) => `${origin}/imagens/banner/photo.${extension}?v=1`),
  );
  assert.equal(buildStoreGallery("Loja1").length, 1);
  assert.equal(buildStoreGallery("Loja2", []).length, 1);
});

const samplePhotos: StorePhoto[] = [
  { src: "/images/loja1.webp", alt: "Fachada da Loja 1" },
  { src: "/imagens/banner/interior.jpg", alt: "Interior da Loja 1" },
  { src: "/imagens/banner/showroom.jpg", alt: "Showroom da Loja 1" },
];

function sourcePath(image: TestRenderer.ReactTestInstance): string {
  const url = new URL(image.props.src, origin);
  return url.searchParams.get("src") ?? url.pathname;
}

// Only window timers are replaced; the Node test runner keeps its real clock.
// TestRenderer never requests images: load/error events are delivered explicitly.
function mountGallery(photos = samplePhotos, reducedMotion = false) {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const replaceGlobal = (key: string, value: unknown) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  const timers = new Map<
    number,
    { at: number; delay: number; callback: () => void }
  >();
  const visibilityListeners = new Set<() => void>();
  const motionListeners = new Set<() => void>();
  let time = 0;
  let timerId = 0;
  let intersectionCallback:
    | ((entries: { isIntersecting: boolean }[]) => void)
    | undefined;
  let disconnected = false;
  const media = {
    matches: reducedMotion,
    addEventListener: (event: string, callback: () => void) => {
      assert.equal(event, "change");
      motionListeners.add(callback);
    },
    removeEventListener: (_event: string, callback: () => void) =>
      motionListeners.delete(callback),
  };
  const documentMock = {
    hidden: false,
    addEventListener: (event: string, callback: () => void) => {
      assert.equal(event, "visibilitychange");
      visibilityListeners.add(callback);
    },
    removeEventListener: (_event: string, callback: () => void) =>
      visibilityListeners.delete(callback),
  };
  replaceGlobal("window", {
    matchMedia: (query: string) => {
      assert.equal(query, "(prefers-reduced-motion: reduce)");
      return media;
    },
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++timerId;
      timers.set(id, { at: time + delay, delay, callback });
      return id;
    },
    clearTimeout: (id: number) => timers.delete(id),
  });
  replaceGlobal("document", documentMock);
  replaceGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersectionCallback) {
        intersectionCallback = callback;
      }
      observe(node: unknown) {
        assert.ok(node);
      }
      disconnect() {
        disconnected = true;
      }
    },
  );
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <StoreGallery name="Loja 1" photos={photos} />,
      {
        createNodeMock: () => ({
          contains: (target: unknown) => target === "inside",
        }),
      },
    );
  });
  const root = () => renderer.root;
  const largePhotos = () =>
    root()
      .findAllByType("img")
      .filter((image) => typeof image.props.onLoad === "function");
  const current = () =>
    largePhotos().find((image) => image.props["aria-hidden"] === false);
  const nextButton = () =>
    root()
      .findAllByType("button")
      .find((button) => /Mostrar próxima/.test(button.props["aria-label"]));
  const pauseButton = () =>
    root()
      .findAllByType("button")
      .find((button) => /troca automática/.test(button.props["aria-label"]));
  const region = () => root().findByProps({ role: "region" });
  const imageAt = (path: string) => {
    const image = largePhotos().find(
      (candidate) => sourcePath(candidate) === path,
    );
    assert.ok(image, `Expected mounted photo ${path}`);
    return image;
  };
  return {
    root,
    current,
    nextButton,
    pauseButton,
    largePhotos,
    region,
    timers,
    autoplayTimerCount: () =>
      [...timers.values()].filter((timer) => timer.delay === 6000).length,
    visible(value: boolean) {
      assert.ok(intersectionCallback);
      act(() => intersectionCallback!([{ isIntersecting: value }]));
    },
    hidden(value: boolean) {
      act(() => {
        documentMock.hidden = value;
        visibilityListeners.forEach((callback) => callback());
      });
    },
    reducedMotion(value: boolean) {
      act(() => {
        media.matches = value;
        motionListeners.forEach((callback) => callback());
      });
    },
    load(path: string) {
      act(() => imageAt(path).props.onLoad());
    },
    fail(path: string) {
      act(() => imageAt(path).props.onError());
    },
    clickNext() {
      const button = nextButton();
      assert.ok(
        button && !button.props.disabled,
        "Next photo must be ready before interaction",
      );
      act(() => button.props.onClick());
    },
    advance(milliseconds: number) {
      const end = time + milliseconds;
      for (;;) {
        const due = [...timers]
          .filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at;
        timers.delete(due[0]);
        act(() => due[1].callback());
      }
      time = end;
    },
    close() {
      try {
        act(() => renderer.unmount());
        assert.equal(
          timers.size,
          0,
          "Unmount clears autoplay and transition cleanup",
        );
        assert.equal(
          visibilityListeners.size,
          0,
          "Unmount removes visibility listener",
        );
        assert.equal(
          motionListeners.size,
          0,
          "Unmount removes motion listener",
        );
        assert.ok(disconnected, "Unmount disconnects the observer");
      } finally {
        for (const [key, original] of originals) {
          if (original) Object.defineProperty(globalThis, key, original);
          else Reflect.deleteProperty(globalThis, key);
        }
      }
    },
  };
}

test("rendered banner images apply orientation to both thumbnail and large-image variants", () => {
  const gallery = mountGallery();
  try {
    for (const image of gallery.root().findAllByType("img")) {
      const expectedOrientation = sourcePath(image).startsWith(
        "/imagens/banner/",
      )
        ? "1"
        : null;
      const urls = [
        image.props.src,
        ...image.props.srcSet
          .split(", ")
          .map((entry: string) => entry.replace(/ \d+w$/, "")),
      ];
      assert.ok(urls.length > 1, "Raster images expose responsive sizes");
      for (const url of urls)
        assert.equal(
          new URL(url).searchParams.get("orient"),
          expectedOrientation,
        );
    }
  } finally {
    gallery.close();
  }
});

test("rendered AVIF photo and thumbnail use the original file without srcset", () => {
  const photo = {
    src: `${origin}/imagens/banner/showroom.avif`,
    alt: "Loja 1 — showroom",
  };
  const gallery = mountGallery([samplePhotos[0], photo]);
  try {
    const avifImages = gallery
      .root()
      .findAllByType("img")
      .filter((image) => image.props.src === photo.src);
    assert.equal(avifImages.length, 2);
    assert.ok(avifImages.every((image) => image.props.srcSet === undefined));
    gallery.load(new URL(photo.src).pathname);
    gallery.clickNext();
    assert.equal(gallery.current()!.props.src, photo.src);
    assert.equal(gallery.current()!.props.srcSet, undefined);
  } finally {
    gallery.close();
  }
});

test("preview shows the next photo and manual navigation waits for its large image", () => {
  const gallery = mountGallery();
  try {
    assert.equal(gallery.region().props["aria-label"], "Fotos da Loja 1");
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
    assert.deepEqual(
      gallery.largePhotos().map(sourcePath),
      samplePhotos.slice(0, 2).map((photo) => photo.src),
    );
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[1].src,
    );
    assert.equal(gallery.nextButton()!.props.disabled, true);
    gallery.load(samplePhotos[0].src);
    assert.equal(gallery.nextButton()!.props.disabled, true);
    gallery.load(samplePhotos[1].src);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    assert.equal(gallery.current()!.props.alt, samplePhotos[1].alt);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[2].src,
    );
    gallery.load(samplePhotos[2].src);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[2].src);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[0].src,
    );
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
  } finally {
    gallery.close();
  }
});

test("a transition retains the loaded previous frame until the fade finishes", () => {
  const gallery = mountGallery();
  try {
    gallery.visible(true);
    gallery.load(samplePhotos[0].src);
    gallery.load(samplePhotos[1].src);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    assert.deepEqual(gallery.largePhotos().map(sourcePath), [
      samplePhotos[1].src,
      samplePhotos[2].src,
      samplePhotos[0].src,
    ]);
    const previous = gallery
      .largePhotos()
      .find((image) => sourcePath(image) === samplePhotos[0].src)!;
    assert.equal(previous.props["aria-hidden"], true);
    assert.equal(previous.props.alt, "");
    assert.match(previous.props.className, /\bopacity-0\b/);
    assert.equal(
      gallery.autoplayTimerCount(),
      0,
      "Unloaded next image cannot start autoplay",
    );
    gallery.advance(549);
    assert.equal(gallery.largePhotos().length, 3);
    gallery.advance(1);
    assert.deepEqual(gallery.largePhotos().map(sourcePath), [
      samplePhotos[1].src,
      samplePhotos[2].src,
    ]);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
  } finally {
    gallery.close();
  }
});

test("photo counter announces manual interaction only while the gallery has focus", () => {
  const gallery = mountGallery();
  const counter = () =>
    gallery
      .root()
      .findAllByType("span")
      .find((node) => node.props["aria-live"] !== undefined)!;
  try {
    assert.equal(counter().props["aria-live"], "off");
    act(() => gallery.region().props.onFocusCapture());
    assert.equal(counter().props["aria-live"], "polite");
    gallery.load(samplePhotos[1].src);
    gallery.clickNext();
    assert.equal(counter().children.join(""), "2 / 3");
    assert.equal(counter().props["aria-live"], "polite");
    act(() =>
      gallery.region().props.onBlurCapture({
        currentTarget: { contains: () => false },
        relatedTarget: null,
      }),
    );
    assert.equal(counter().props["aria-live"], "off");
  } finally {
    gallery.close();
  }
});

test("autoplay waits for visibility and a loaded next image, then changes exactly at six seconds", () => {
  const gallery = mountGallery();
  try {
    gallery.load(samplePhotos[0].src);
    gallery.visible(true);
    assert.equal(gallery.timers.size, 0);
    gallery.load(samplePhotos[1].src);
    assert.equal(gallery.timers.size, 1);
    gallery.advance(5999);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
    gallery.advance(1);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    assert.equal(
      gallery.autoplayTimerCount(),
      0,
      "Third image is not yet ready",
    );
    gallery.advance(12000);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    gallery.load(samplePhotos[2].src);
    gallery.advance(6000);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[2].src);
  } finally {
    gallery.close();
  }
});

for (const blocker of [
  "viewport",
  "tab",
  "hover",
  "focus",
  "pause",
  "reduced motion",
] as const) {
  test(`autoplay stops for ${blocker} and resumes with a full interval`, () => {
    const gallery = mountGallery();
    const setBlocked = (value: boolean) => {
      if (blocker === "viewport") gallery.visible(!value);
      if (blocker === "tab") gallery.hidden(value);
      if (blocker === "reduced motion") gallery.reducedMotion(value);
      if (blocker === "hover")
        act(() =>
          gallery.region().props[value ? "onMouseEnter" : "onMouseLeave"](),
        );
      if (blocker === "focus")
        act(() =>
          value
            ? gallery.region().props.onFocusCapture()
            : gallery.region().props.onBlurCapture({
                currentTarget: { contains: () => false },
                relatedTarget: null,
              }),
        );
      if (blocker === "pause")
        act(() => gallery.pauseButton()!.props.onClick());
    };
    try {
      gallery.load(samplePhotos[1].src);
      assert.equal(
        gallery.timers.size,
        0,
        "Offscreen galleries do not autoplay",
      );
      gallery.visible(true);
      gallery.advance(2000);
      setBlocked(true);
      assert.equal(gallery.timers.size, 0);
      gallery.advance(20000);
      assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
      setBlocked(false);
      gallery.advance(5999);
      assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
      gallery.advance(1);
      assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    } finally {
      gallery.close();
    }
  });
}

test("moving focus within the gallery stays paused and reduced motion preserves manual controls", () => {
  const gallery = mountGallery(samplePhotos, true);
  try {
    gallery.visible(true);
    gallery.load(samplePhotos[1].src);
    assert.equal(gallery.timers.size, 0);
    assert.equal(gallery.pauseButton(), undefined);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    gallery.load(samplePhotos[2].src);
    gallery.reducedMotion(false);
    act(() => gallery.region().props.onFocusCapture());
    act(() =>
      gallery.region().props.onBlurCapture({
        currentTarget: { contains: () => true },
        relatedTarget: "inside",
      }),
    );
    gallery.advance(6000);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    assert.equal(gallery.timers.size, 0);
  } finally {
    gallery.close();
  }
});

test("failed upcoming or current photos are removed without duplicating the cover", () => {
  const gallery = mountGallery();
  try {
    gallery.visible(true);
    gallery.load(samplePhotos[0].src);
    gallery.fail(samplePhotos[1].src);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[2].src,
    );
    assert.equal(gallery.nextButton()!.props.disabled, true);
    assert.equal(gallery.timers.size, 0);
    assert.ok(
      gallery
        .root()
        .findAllByType("img")
        .every((image) => sourcePath(image) !== samplePhotos[1].src),
    );
    gallery.load(samplePhotos[2].src);
    gallery.advance(6000);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[2].src);
    gallery.fail(samplePhotos[2].src);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
    assert.equal(gallery.root().findAllByType("img").length, 1);
    assert.equal(gallery.nextButton(), undefined);
    assert.equal(gallery.autoplayTimerCount(), 0);
    gallery.fail(samplePhotos[0].src);
    assert.equal(gallery.root().findAllByType("img").length, 0);
    assert.match(
      gallery.root().findByType("p").children.join(""),
      /Fotos indisponíveis/,
    );
  } finally {
    gallery.close();
  }
});

test("a failed local cover falls through to distinct valid photos", () => {
  const gallery = mountGallery();
  try {
    gallery.fail(samplePhotos[0].src);
    assert.equal(sourcePath(gallery.current()!), samplePhotos[1].src);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[2].src,
    );
    gallery.load(samplePhotos[2].src);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[2].src);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[1].src,
    );
  } finally {
    gallery.close();
  }
});

test("a failed thumbnail removes that photo from the preview and rotation", () => {
  const gallery = mountGallery();
  try {
    gallery.visible(true);
    gallery.load(samplePhotos[1].src);
    assert.equal(gallery.timers.size, 1);
    act(() => gallery.nextButton()!.findByType("img").props.onError());
    assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
    assert.equal(
      sourcePath(gallery.nextButton()!.findByType("img")),
      samplePhotos[2].src,
    );
    assert.equal(gallery.timers.size, 0);
    assert.ok(
      gallery
        .root()
        .findAllByType("img")
        .every((image) => sourcePath(image) !== samplePhotos[1].src),
    );
    gallery.load(samplePhotos[2].src);
    gallery.clickNext();
    assert.equal(sourcePath(gallery.current()!), samplePhotos[2].src);
  } finally {
    gallery.close();
  }
});

for (const count of [0, 1]) {
  test(`${count}-photo gallery has no duplicate preview or autoplay controls`, () => {
    const gallery = mountGallery(samplePhotos.slice(0, count));
    try {
      gallery.visible(true);
      if (count) gallery.load(samplePhotos[0].src);
      gallery.advance(18000);
      assert.equal(gallery.root().findAllByType("img").length, count);
      assert.equal(gallery.root().findAllByType("button").length, 0);
      assert.equal(gallery.timers.size, 0);
      if (count)
        assert.equal(sourcePath(gallery.current()!), samplePhotos[0].src);
      else
        assert.match(
          gallery.root().findByType("p").children.join(""),
          /Fotos indisponíveis/,
        );
    } finally {
      gallery.close();
    }
  });
}
