import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  homeHeroRotationDay,
  isHomeHeroCandidate,
  selectHomeHeroVehicles,
} from "../../src/lib/homeHeroSelection.mjs";

const phpHelper = fileURLToPath(new URL("../../public/home-hero.php", import.meta.url));

function vehicle(id, overrides = {}) {
  return {
    id: String(id),
    marca: "VOLKSWAGEN",
    modelo: "T-CROSS",
    price: 120000,
    year: 2023,
    km: 12000,
    imagens_site: { tem_fotos: 1, capa: `/imagens/${id}CAPA.png` },
    ...overrides,
  };
}

const ids = (vehicles) => vehicles.map((item) => String(item.id));
const pool = Array.from({ length: 9 }, (_, index) => vehicle(index + 1));

const rejectedCases = [
  ["a sold unit", { price: 0 }],
  ["price at the exclusive threshold", { price: 100000 }],
  ["price below the threshold", { price: 99999.99 }],
  ["missing price", { price: null }],
  ["an older model year", { year: 2020 }],
  ["a fractional model year", { year: 2021.5 }],
  ["missing model year", { year: null }],
  ["unknown mileage", { km: null }],
  ["zero mileage", { km: 0 }],
  ["blank mileage", { km: "" }],
  ["whitespace mileage", { km: " " }],
  ["negative mileage", { km: -1 }],
  ["fractional mileage above the inclusive threshold", { km: 70000.01 }],
  ["mileage above the inclusive threshold", { km: 70001 }],
  ["an invalid mileage string", { km: "12.000 km" }],
  ["a blank ID", { id: "" }],
  ["a whitespace ID", { id: "  " }],
  ["a nonnumeric ID", { id: "123junk" }],
  ["a zero ID", { id: 0 }],
  ["a negative ID", { id: -1 }],
  ["missing brand", { marca: null }],
  ["blank brand", { marca: " " }],
  ["missing model", { modelo: null }],
  ["blank model", { modelo: " " }],
  ["no image data", { imagens_site: null }],
  ["no photo flag", { imagens_site: { capa: "/car.png" } }],
  ["a disabled photo flag", { imagens_site: { tem_fotos: 0, capa: "/car.png" } }],
  ["a negative photo flag", { imagens_site: { tem_fotos: -1, capa: "/car.png" } }],
  ["an invalid photo flag", { imagens_site: { tem_fotos: "yes", capa: "/car.png" } }],
  ["a missing cutout", { imagens_site: { tem_fotos: 1, capa: null } }],
  ["a photographic JPEG", { imagens_site: { tem_fotos: 1, capa: "/car.jpg" } }],
  ["a PNG-looking directory", { imagens_site: { tem_fotos: 1, capa: "/car.png/photo.jpg" } }],
  ["a PNG string inside a JPEG filename", { imagens_site: { tem_fotos: 1, capa: "/car.png.jpg" } }],
];

test("hero eligibility enforces every boundary and required catalog field", () => {
  assert.equal(isHomeHeroCandidate(vehicle(1)), true);
  assert.equal(isHomeHeroCandidate(vehicle(1, { price: 100000.01, year: 2021, km: 69999 })), true);
  assert.equal(isHomeHeroCandidate(vehicle(1, { km: 70000 })), true);
  assert.equal(isHomeHeroCandidate(vehicle(1, { km: 1 })), true);
  for (const [label, overrides] of rejectedCases) {
    assert.equal(isHomeHeroCandidate(vehicle(1, overrides)), false, label);
  }
  for (const value of [null, undefined, {}, "", 1]) {
    assert.equal(isHomeHeroCandidate(value), false);
  }
  for (const field of ["price", "year", "km"]) {
    for (const value of [NaN, Infinity, -Infinity, undefined]) {
      assert.equal(isHomeHeroCandidate(vehicle(1, { [field]: value })), false, `${field}: ${value}`);
    }
  }
});

test("numeric API strings and PNG URL suffixes retain eligible cutouts", () => {
  for (const capa of ["/car.png", "/car.PNG", "/car.png?v=2", "/car.PnG#preview"]) {
    assert.equal(isHomeHeroCandidate(vehicle(1, {
      price: "100001", year: "2021", km: "70000",
      imagens_site: { tem_fotos: "1", capa },
    })), true, capa);
  }
});

test("selection excludes ineligible stock without relaxing filters to fill four slots", () => {
  const invalid = rejectedCases.map(([, overrides], index) => vehicle(index + 100, overrides));
  assert.deepEqual(selectHomeHeroVehicles(invalid, { day: 0 }), []);
  assert.deepEqual(ids(selectHomeHeroVehicles([...invalid, vehicle(1)], { day: 0 })), ["1"]);
  assert.deepEqual(selectHomeHeroVehicles([], { day: 0 }), []);
});

test("daily selection sorts numeric IDs before rotating four cars", () => {
  const input = [vehicle(2), vehicle(100), vehicle(9), vehicle(50), vehicle(30), vehicle(11)];
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 0 })), ["100", "50", "30", "11"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 1 })), ["9", "2", "100", "50"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 2 })), ["30", "11", "9", "2"]);
  assert.deepEqual(ids(selectHomeHeroVehicles([...input].reverse(), { day: 1 })), ["9", "2", "100", "50"]);
});

test("rotation reaches the entire pool across days and wraps without duplicate slides", () => {
  const seen = new Set();
  for (let day = 0; day < pool.length; day += 1) {
    const selected = ids(selectHomeHeroVehicles(pool, { day }));
    assert.equal(selected.length, 4);
    assert.equal(new Set(selected).size, 4);
    for (const id of selected) seen.add(id);
  }
  assert.deepEqual([...seen].sort(), ids(pool).sort());
  assert.deepEqual(ids(selectHomeHeroVehicles(pool, { day: 2 })), ["1", "9", "8", "7"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool, { day: 9 })), ["9", "8", "7", "6"]);
});

test("a pool of up to four rotates its lead by one car each day", () => {
  assert.deepEqual(ids(selectHomeHeroVehicles(pool.slice(0, 4), { day: 0 })), ["4", "3", "2", "1"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool.slice(0, 4), { day: 1 })), ["3", "2", "1", "4"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool.slice(0, 3), { day: 2 })), ["1", "3", "2"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool.slice(0, 1), { day: 30 })), ["1"]);
});

test("duplicate IDs count once before calculating the rotation", () => {
  const input = [vehicle(1), vehicle(2), vehicle(3), vehicle(4), vehicle(4, { id: 4 })];
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 1 })), ["3", "2", "1", "4"]);
  assert.deepEqual(ids(selectHomeHeroVehicles([
    vehicle(4, { price: 0 }), vehicle(4), vehicle(3), vehicle(2), vehicle(1),
  ], { day: 0 })), ["4", "3", "2", "1"]);
});

test("featured flags and manual merchandising do not override daily rotation", () => {
  const input = pool.map((item) => ({
    ...item, destaque: item.id === "1" ? 1 : 0,
    promocao: item.id === "2" ? 1 : 0,
    priority: item.id === "3" ? 1000000 : 0,
  }));
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 0 })), ["9", "8", "7", "6"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 1 })), ["5", "4", "3", "2"]);
});

test("an eligible preload ID stays first even when outside today's four slides", () => {
  assert.deepEqual(ids(selectHomeHeroVehicles(pool, { day: 0, preferredId: "1" })), ["1", "9", "8", "7"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool, { day: 0, preferredId: 8 })), ["8", "9", "7", "6"]);
  assert.deepEqual(ids(selectHomeHeroVehicles(pool.slice(0, 3), { day: 0, preferredId: "1" })), ["1", "3", "2"]);
});

test("a sold, missing or ineligible preload ID never revives stale stock", () => {
  const input = [...pool, vehicle(100, { price: 0 }), vehicle(101, { km: 70001 })];
  for (const preferredId of ["100", "101", "999", "", null]) {
    assert.deepEqual(ids(selectHomeHeroVehicles(input, { day: 0, preferredId })), ["9", "8", "7", "6"]);
  }
});

test("selection preserves its source array and nested inventory records", () => {
  const input = structuredClone(pool);
  const before = structuredClone(input);
  for (const item of input) {
    Object.freeze(item.imagens_site);
    Object.freeze(item);
  }
  Object.freeze(input);
  selectHomeHeroVehicles(input, { day: 1, preferredId: "1" });
  assert.deepEqual(input, before);
});

const calendarCases = [
  ["2026-10-01T02:59:59.999Z", "2026-09-30"],
  ["2026-10-01T03:00:00.000Z", "2026-10-01"],
  ["2026-10-01T23:59:59.999Z", "2026-10-01"],
  ["2024-03-01T02:59:59.999Z", "2024-02-29"],
  ["2024-03-01T03:00:00.000Z", "2024-03-01"],
];

test("the rotation day changes at São Paulo civil midnight, including leap day", () => {
  for (const [instant, localDate] of calendarCases) {
    const expectedOrdinal = Date.parse(`${localDate}T00:00:00.000Z`) / 86400000;
    assert.equal(homeHeroRotationDay(new Date(instant)), expectedOrdinal, instant);
  }
});

test("omitting day uses today's São Paulo rotation", () => {
  const before = homeHeroRotationDay();
  const selected = ids(selectHomeHeroVehicles(pool));
  const after = homeHeroRotationDay();
  assert.ok([before, after].some((day) => (
    JSON.stringify(ids(selectHomeHeroVehicles(pool, { day }))) === JSON.stringify(selected)
  )));
});

const php = process.env.NETCAR_PHP_BINARY || "php";
const hasPhp = spawnSync(php, ["-v"], { encoding: "utf8" }).status === 0;

test("PHP preserves the positive mileage and inclusive 70,000 km banner bounds", () => {
  const source = readFileSync(phpHelper, "utf8");
  assert.match(source, /\$km\s*>\s*0\s*&&\s*\$km\s*<=\s*70000\b/);
});

test("CI has PHP available for server/browser hero parity", () => {
  if (process.env.CI) assert.ok(hasPhp, "Install PHP or set NETCAR_PHP_BINARY before running CI");
});

test("PHP and JavaScript agree on eligibility and the exact daily slide order", {
  skip: hasPhp ? false : "PHP CLI unavailable; set NETCAR_PHP_BINARY to run server parity locally",
}, () => {
  const fixtures = [
    vehicle(1), vehicle(2, { id: 2 }),
    vehicle(3, { price: "100001", year: "2021", km: "70000", imagens_site: { tem_fotos: "1", capa: "/car.PNG?v=2" } }),
    vehicle(4, { km: 69999 }), vehicle(5, { km: 70000 }),
    ...rejectedCases.map(([, overrides], index) => vehicle(index + 100, overrides)),
  ];
  const selections = [
    ...[0, 1, 2, 3, 30, 20727].map((day) => ({ vehicles: pool, day })),
    { vehicles: pool.slice(0, 4), day: 1 },
    { vehicles: pool.slice(0, 3), day: 2 },
    { vehicles: [], day: 0 },
    { vehicles: fixtures, day: 0 },
    { vehicles: [vehicle(4), vehicle(4, { id: 4 }), vehicle(3), vehicle(2), vehicle(1)], day: 1 },
  ];
  const harness = `require $argv[1];
    $input = json_decode(stream_get_contents(STDIN), true);
    $result = [
      'eligible' => array_map('netcar_is_home_hero_candidate', $input['fixtures']),
      'selected' => array_map(function ($entry) {
        return netcar_select_home_hero_vehicles($entry['vehicles'], $entry['day']);
      }, $input['selections']),
      'day' => netcar_home_rotation_day(),
    ];
    echo json_encode($result, JSON_UNESCAPED_SLASHES);`;
  const before = homeHeroRotationDay();
  const result = spawnSync(php, ["-r", harness, phpHelper], {
    input: JSON.stringify({ fixtures, selections }), encoding: "utf8",
  });
  const after = homeHeroRotationDay();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual.eligible, fixtures.map(isHomeHeroCandidate));
  assert.deepEqual(actual.selected, selections.map(({ vehicles, day }) => selectHomeHeroVehicles(vehicles, { day })));
  assert.ok([before, after].includes(actual.day), "PHP and browser must use the same São Paulo calendar day");
});
