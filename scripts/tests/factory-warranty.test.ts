import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  factoryWarrantyReviewFingerprint,
  resolveFactoryWarranty,
  type FactoryWarrantyRecord,
  type FactoryWarrantyMatrix,
  type WarrantyCatalogVehicle,
  type WarrantyCommonPolicy,
  type WarrantySource,
} from "../../src/lib/factoryWarranty";

const TODAY = "2026-10-03";
const vehicle: WarrantyCatalogVehicle = {
  id: "test-unit",
  marca: "Example",
  modelo: "Exact Version",
  anoFabricacao: 2025,
  year: 2026,
  km: 6700,
  price: 129900,
  diferenciais: [{ tag: "garantia_fabrica", descricao: "Garantia de fábrica" }],
};
function review(
  patch: Partial<FactoryWarrantyRecord> = {},
): FactoryWarrantyRecord {
  const entry: FactoryWarrantyRecord = {
    recordId: "unit-review-v2",
    status: "approved",
    reviewedAt: TODAY,
    approvedFingerprint: "",
    vehicle: {
      vehicleId: "test-unit",
      brand: "EXAMPLE",
      modelVersion: "Exact Version",
      manufactureYear: 2025,
      modelYear: 2026,
    },
    optionalId: 108,
    optionalConfirmed: true,
    conditionsConfirmed: true,
    scope: "basic-vehicle",
    termYears: 3,
    usage: "private",
    reviewedMileageKm: 6700,
    mileage: { kind: "limited", limitKm: 100000 },
    sources: [
      {
        sourceId: "example-manual",
        url: "https://manufacturer.example/manual.pdf",
        locator: "Model-year manual, warranty p10",
        revision: "DOC-MY2026; edition 1",
        verification: {
          status: "verified",
          documentCode: "DOC-MY2026",
          modelYear: 2026,
          reviewId: "example-coverage-review",
          reviewedAt: TODAY,
        },
      },
    ],
    ...patch,
  };
  entry.approvedFingerprint = factoryWarrantyReviewFingerprint(entry);
  return entry;
}
const matrix = (
  ...records: FactoryWarrantyRecord[]
): FactoryWarrantyMatrix => ({ schemaVersion: 2, enabled: true, records });
const resolve = (v = vehicle, r = review()) =>
  resolveFactoryWarranty(v, matrix(r), TODAY);

test("only the exact reviewed unit gets one circular stamp with an estimated year", () => {
  assert.deepEqual(resolve(), {
    estimatedEndYear: 2028,
    manufacturer: "EXAMPLE",
    mode: "verified",
    design: "round",
  });
});
test("new XML units have no automatic brand or year fallback", () => {
  assert.equal(resolve({ ...vehicle, id: "new-xml-unit" }), undefined);
  assert.equal(resolveFactoryWarranty(vehicle, matrix(), TODAY), undefined);
});
test("a disabled registry never enables the approved records", () => {
  assert.equal(
    resolveFactoryWarranty(
      vehicle,
      { ...matrix(review()), enabled: false },
      TODAY,
    ),
    undefined,
  );
});
for (const [field, value] of Object.entries({
  marca: "Different Brand",
  modelo: "Other Version",
  anoFabricacao: 2024,
  year: 2027,
})) {
  test(`changed ${field} invalidates the unit approval`, () =>
    assert.equal(resolve({ ...vehicle, [field]: value }), undefined));
}
test("missing fabrication year is not replaced by model year", () =>
  assert.equal(resolve({ ...vehicle, anoFabricacao: undefined }), undefined));
test("removing the live warranty tag or optional108 confirmation removes the stamp", () => {
  assert.equal(resolve({ ...vehicle, diferenciais: [] }), undefined);
  assert.equal(
    resolve(vehicle, review({ optionalConfirmed: false })),
    undefined,
  );
  assert.equal(resolve(vehicle, review({ optionalId: 109 })), undefined);
});
for (const status of ["pending", "revoked", "ineligible"] as const)
  test(`${status} records never display`, () =>
    assert.equal(resolve(vehicle, review({ status })), undefined));
test("duplicate approval or approval plus revocation cannot preserve a stale claim", () => {
  const r = review();
  assert.equal(resolveFactoryWarranty(vehicle, matrix(r, r), TODAY), undefined);
  assert.equal(
    resolveFactoryWarranty(
      vehicle,
      matrix(r, review({ status: "revoked" })),
      TODAY,
    ),
    undefined,
  );
});
for (const scope of ["battery", "powertrain", "extension", "unknown"] as const)
  test(`${scope} is never promoted to whole-vehicle warranty`, () =>
    assert.equal(
      resolve(vehicle, review({ scope, termYears: 10 })),
      undefined,
    ));
test("unknown usage, mileage rule or unconfirmed conditions return no stamp", () => {
  for (const r of [
    review({ usage: "unknown" }),
    review({ mileage: { kind: "unknown" } }),
    review({ conditionsConfirmed: false }),
  ])
    assert.equal(resolve(vehicle, r), undefined);
});
test("live mileage reaching/exceeding the cap suppresses the stamp without a rebuild", () => {
  assert.equal(resolve({ ...vehicle, km: 100000 }), undefined);
  assert.equal(resolve({ ...vehicle, km: 100001 }), undefined);
  assert.equal(resolve({ ...vehicle, km: 99999 })?.estimatedEndYear, 2028);
});
test("unknown, invalid or regressed live mileage fails closed", () => {
  for (const km of [NaN, -1, 0, 6699])
    assert.equal(resolve({ ...vehicle, km }), undefined);
});
test("changing cap, term or source without a new approval fingerprint invalidates the record", () => {
  const r = review();
  for (const changed of [
    { ...r, mileage: { kind: "limited" as const, limitKm: 200000 } },
    { ...r, termYears: 10 },
    { ...r, sources: [{ ...r.sources[0], revision: "DOC-MY2026; edition 2" }] },
  ])
    assert.equal(resolve(vehicle, changed), undefined);
});
test("unlimited mileage must be explicit and reviewed", () =>
  assert.equal(
    resolve(
      { ...vehicle, km: 250000 },
      review({ mileage: { kind: "unlimited" } }),
    )?.estimatedEndYear,
    2028,
  ));
test("estimated final year needs confirmed unexpired date, not December31 guessed from FAB", () => {
  assert.equal(resolve(vehicle, review({ termYears: 1 })), undefined);
  assert.equal(
    resolve(
      vehicle,
      review({ termYears: 1, confirmedExpiryDate: "2026-12-10" }),
    )?.estimatedEndYear,
    2026,
  );
  assert.equal(
    resolve(
      vehicle,
      review({ termYears: 1, confirmedExpiryDate: "2026-09-01" }),
    ),
    undefined,
  );
});
test("expired or future-dated reviews, missing sources and sold vehicles cannot show a stamp", () => {
  assert.equal(
    resolve(vehicle, review({ confirmedExpiryDate: "2026-09-01" })),
    undefined,
  );
  assert.equal(
    resolve(vehicle, review({ reviewedAt: "2026-10-04" })),
    undefined,
  );
  assert.equal(resolve(vehicle, review({ sources: [] })), undefined);
  assert.equal(resolve({ ...vehicle, price: 0 }), undefined);
});
test("an incomplete external record safely hides rather than throwing", () => {
  const r = {
    ...review(),
    sources: undefined,
  } as unknown as FactoryWarrantyRecord;
  assert.equal(resolve(vehicle, r), undefined);
  assert.equal(
    resolveFactoryWarranty(
      vehicle,
      {
        schemaVersion: 2,
        enabled: true,
        records: [null],
      } as unknown as FactoryWarrantyMatrix,
      TODAY,
    ),
    undefined,
  );
});

test("unsupported or incomplete registry schemas fail closed", () => {
  for (const input of [
    null,
    {},
    { schemaVersion: 1, enabled: true, records: [review()] },
    { schemaVersion: 3, enabled: true, records: [review()] },
    { schemaVersion: 2, enabled: true, records: null },
  ]) {
    assert.equal(
      resolveFactoryWarranty(
        vehicle,
        input as unknown as FactoryWarrantyMatrix,
        TODAY,
      ),
      undefined,
    );
  }
});

function commonReview(): FactoryWarrantyRecord {
  return review({
    usage: "unknown",
    commonPolicy: {
      kind: "documented-regime-intersection",
      reviewId: "example-coverage-review",
      basis: "Both documented regimes have the same basic vehicle term.",
      branches: [
        {
          category: "non-commercial",
          condition: "Non-commercial use stated in the manual",
          scope: "basic-vehicle",
          termYears: 3,
          mileage: { kind: "unlimited" },
          sourceIds: ["example-manual"],
        },
        {
          category: "commercial",
          condition: "Commercial use stated in the manual",
          scope: "basic-vehicle",
          termYears: 3,
          mileage: { kind: "limited", limitKm: 100000 },
          sourceIds: ["example-manual"],
        },
      ],
    },
  });
}

// These snapshots are synthetic test fixtures. Refresh their fingerprint when
// testing a semantic gate, so an old fingerprint cannot mask the actual failure.
function reviewedChange(
  original: FactoryWarrantyRecord,
  change: (record: FactoryWarrantyRecord) => void,
): FactoryWarrantyRecord {
  const changed = structuredClone(original);
  change(changed);
  changed.approvedFingerprint = factoryWarrantyReviewFingerprint(changed);
  return changed;
}

test("a documented common policy shows a stamp without inventing actual usage", () => {
  const record = commonReview();
  assert.equal(record.usage, "unknown");
  assert.equal(resolve(vehicle, record)?.estimatedEndYear, 2028);
  assert.equal(resolve(vehicle, review({ usage: "unknown" })), undefined);
});

test("CPF/CNPJ remains a distinct documented pair with the same conservative cap", () => {
  const record = reviewedChange(commonReview(), (r) => {
    const branches = r.commonPolicy!.branches;
    branches[0].category = "cpf";
    branches[0].condition = "CPF as specified by the manual";
    branches[1].category = "cnpj";
    branches[1].condition = "CNPJ as specified by the manual";
  });
  assert.equal(resolve(vehicle, record)?.estimatedEndYear, 2028);
  assert.equal(record.usage, "unknown");
  assert.equal(resolve({ ...vehicle, km: 100000 }, record), undefined);
});

test("a documented general rule does not require invented private/commercial branches", () => {
  const record = reviewedChange(commonReview(), (r) => {
    r.mileage = { kind: "unlimited" };
    r.commonPolicy!.kind = "documented-general-rule";
    r.commonPolicy!.branches = [
      {
        ...r.commonPolicy!.branches[0],
        category: "general",
        condition: "General basic vehicle warranty under the documented conditions",
        mileage: { kind: "unlimited" },
      },
    ];
  });
  assert.equal(resolve({ ...vehicle, km: 250000 }, record)?.estimatedEndYear, 2028);
  assert.equal(record.usage, "unknown");
});

test("the common cap is the exact minimum of the documented finite caps", () => {
  const base = reviewedChange(commonReview(), (r) => {
    r.commonPolicy!.branches[0].mileage = { kind: "limited", limitKm: 150000 };
  });
  assert.equal(resolve({ ...vehicle, km: 99999 }, base)?.estimatedEndYear, 2028);
  for (const mileage of [
    { kind: "limited", limitKm: 150000 },
    { kind: "limited", limitKm: 80000 },
    { kind: "unlimited" },
  ] as const) {
    const changed = reviewedChange(base, (r) => {
      r.mileage = mileage;
    });
    assert.equal(resolve(vehicle, changed), undefined, JSON.stringify(mileage));
  }
});

test("six-year/two-year branches cannot become one common warranty term", () => {
  const record = reviewedChange(commonReview(), (r) => {
    r.termYears = 6;
    r.commonPolicy!.branches[0].termYears = 6;
    r.commonPolicy!.branches[1].termYears = 2;
  });
  assert.equal(resolve(vehicle, record), undefined);
});

for (const scope of ["battery", "powertrain", "extension"] as const) {
  test(scope + " coverage in a branch cannot substantiate a basic-vehicle stamp", () => {
    const record = reviewedChange(commonReview(), (r) => {
      r.commonPolicy!.branches[1] = {
        ...r.commonPolicy!.branches[1],
        scope,
      } as unknown as WarrantyCommonPolicy["branches"][number];
    });
    assert.equal(resolve(vehicle, record), undefined);
  });
}

const invalidPolicyCases: Array<[
  string,
  (policy: WarrantyCommonPolicy) => void,
]> = [
  ["missing branch", (p) => { p.branches.pop(); }],
  ["empty branch list", (p) => { p.branches = []; }],
  ["duplicate category", (p) => {
    p.branches[1].category = p.branches[0].category;
  }],
  ["mixed CPF/commercial categories", (p) => { p.branches[0].category = "cpf"; }],
  ["unknown category", (p) => {
    p.branches[0].category = "unknown" as WarrantyCommonPolicy["branches"][number]["category"];
  }],
  ["extra third branch", (p) => { p.branches.push(structuredClone(p.branches[0])); }],
  ["unknown branch mileage", (p) => { p.branches[1].mileage = { kind: "unknown" }; }],
  ["empty branch condition", (p) => { p.branches[1].condition = " "; }],
  ["missing referenced evidence", (p) => { p.branches[1].sourceIds = []; }],
  ["unrecognized source reference", (p) => { p.branches[1].sourceIds = ["unreviewed-manual"]; }],
  ["policy tied to another review", (p) => { p.reviewId = "other-review"; }],
  ["general rule with regime branches", (p) => { p.kind = "documented-general-rule"; }],
  ["unknown policy kind", (p) => {
    p.kind = "automatic-brand-default" as WarrantyCommonPolicy["kind"];
  }],
];
for (const [label, change] of invalidPolicyCases) {
  test("common policy rejects " + label + " even with a refreshed fingerprint", () => {
    const record = reviewedChange(commonReview(), (r) => change(r.commonPolicy!));
    assert.equal(resolve(vehicle, record), undefined);
  });
}

test("a common policy cannot masquerade as confirmed actual private or commercial use", () => {
  for (const usage of ["private", "commercial"] as const) {
    const record = reviewedChange(commonReview(), (r) => { r.usage = usage; });
    assert.equal(resolve(vehicle, record), undefined);
  }
});

test("duplicate source identifiers do not satisfy branch evidence requirements", () => {
  const record = reviewedChange(commonReview(), (r) => {
    r.sources.push(structuredClone(r.sources[0]));
  });
  assert.equal(resolve(vehicle, record), undefined);
});

test("every referenced source must belong to the policy review", () => {
  const record = reviewedChange(commonReview(), (r) => {
    const other = structuredClone(r.sources[0]);
    other.sourceId = "other-manual";
    other.verification.reviewId = "other-coverage-review";
    r.sources.push(other);
    r.commonPolicy!.branches[1].sourceIds.push(other.sourceId);
  });
  assert.equal(resolve(vehicle, record), undefined);
});

for (const field of ["revision", "locator"] as const) {
  test("source " + field + " cannot contain revisão pendente after fingerprint refresh", () => {
    const record = reviewedChange(commonReview(), (r) => {
      r.sources[0][field] += "; revisão pendente";
    });
    assert.equal(resolve(vehicle, record), undefined);
  });
}

const invalidSourceCases: Array<[string, (source: WarrantySource) => void]> = [
  ["pending verification", (s) => { s.verification.status = "pending"; }],
  ["arbitrary verification status", (s) => {
    s.verification.status = "looks-good" as WarrantySource["verification"]["status"];
  }],
  ["missing verification evidence", (s) => {
    delete (s as Partial<WarrantySource>).verification;
  }],
  ["missing document code", (s) => { s.verification.documentCode = ""; }],
  ["document code absent from the stated revision", (s) => {
    s.verification.documentCode = "OTHER-DOC";
  }],
  ["wrong model-year evidence", (s) => { s.verification.modelYear = 2025; }],
  ["missing review identifier", (s) => { s.verification.reviewId = ""; }],
  ["future evidence review", (s) => { s.verification.reviewedAt = "2026-10-04"; }],
  ["invalid evidence review date", (s) => { s.verification.reviewedAt = "2026-02-30"; }],
  ["missing source identifier", (s) => { s.sourceId = ""; }],
  ["missing clause locator", (s) => { s.locator = ""; }],
  ["missing edition", (s) => { s.revision = ""; }],
  ["non-HTTPS document URL", (s) => { s.url = "http://manufacturer.example/manual.pdf"; }],
];
for (const [label, change] of invalidSourceCases) {
  test("structured source rejects " + label + " even with a refreshed fingerprint", () => {
    const record = reviewedChange(commonReview(), (r) => change(r.sources[0]));
    assert.equal(resolve(vehicle, record), undefined);
  });
}

test("valid common-policy changes still require a new approval fingerprint", () => {
  const original = commonReview();
  for (const change of [
    (r: FactoryWarrantyRecord) => { r.commonPolicy!.basis += " Revised explanation."; },
    (r: FactoryWarrantyRecord) => {
      r.commonPolicy!.branches[0].condition = "Updated documented condition";
    },
  ]) {
    const changed = structuredClone(original);
    change(changed);
    assert.equal(resolve(vehicle, changed), undefined);
    // Show that the changed content is structurally acceptable: only its old
    // approval snapshot, not a different validation gate, caused the rejection.
    assert.equal(resolve(vehicle, review(changed))?.estimatedEndYear, 2028);
  }
});

test("valid source changes still require a new approval fingerprint", () => {
  const original = commonReview();
  for (const change of [
    (s: WarrantySource) => { s.url = "https://manufacturer.example/manual-v2.pdf"; },
    (s: WarrantySource) => { s.locator = "Warranty section p11"; },
    (s: WarrantySource) => { s.revision = "DOC-MY2026; edition 2"; },
    (s: WarrantySource) => { s.verification.reviewedAt = "2026-10-02"; },
  ]) {
    const changed = structuredClone(original);
    change(changed.sources[0]);
    assert.equal(resolve(vehicle, changed), undefined);
    assert.equal(resolve(vehicle, review(changed))?.estimatedEndYear, 2028);
  }
});

interface WarrantyAudit {
  reviewedAt: string;
  publicationApproved: boolean;
  currentCatalogSnapshot: WarrantyCatalogVehicle[];
  approvedLocalContent: Array<{
    vehicleId: string;
    expectedYear: number;
    identity: FactoryWarrantyRecord["vehicle"];
    commonPolicy: WarrantyCommonPolicy;
    sources: WarrantySource[];
  }>;
  pendingUnits: Array<{ vehicleId: string }>;
}
const localRegistry = JSON.parse(
  readFileSync(new URL("../../src/data/factoryWarrantyMatrix.json", import.meta.url), "utf8"),
) as FactoryWarrantyMatrix;
const localAudit = JSON.parse(
  readFileSync(new URL("../../docs/audits/factory-warranty-2026-10-03.json", import.meta.url), "utf8"),
) as WarrantyAudit;
const EXPECTED_LOCAL_YEARS: Record<string, number> = {
  "20066": 2027,
  "19994": 2027,
  "20038": 2029,
  "19857": 2028,
  "19587": 2028,
};
const enabledLocalRegistry: FactoryWarrantyMatrix = {
  ...localRegistry,
  enabled: true,
};

function localVehicle(id: string): WarrantyCatalogVehicle {
  const result = localAudit.currentCatalogSnapshot.find((entry) => entry.id === id);
  assert.ok(result, "Reviewed catalog snapshot is missing unit " + id);
  return result;
}

test("the authorized release keeps exactly five reviewed records and ten pending", () => {
  assert.equal(localRegistry.schemaVersion, 2);
  assert.equal(localRegistry.enabled, true);
  assert.equal(localAudit.publicationApproved, true);
  assert.equal(localRegistry.records.length, 15);
  assert.equal(new Set(localRegistry.records.map((r) => r.vehicle.vehicleId)).size, 15);
  const approved = localRegistry.records.filter((r) => r.status === "approved");
  const pending = localRegistry.records.filter((r) => r.status === "pending");
  assert.deepEqual(
    approved.map((r) => r.vehicle.vehicleId).sort(),
    Object.keys(EXPECTED_LOCAL_YEARS).sort(),
  );
  assert.equal(pending.length, 10);
  assert.deepEqual(
    pending.map((r) => r.vehicle.vehicleId).sort(),
    localAudit.pendingUnits.map((entry) => entry.vehicleId).sort(),
  );
  assert.deepEqual(
    Object.fromEntries(localAudit.approvedLocalContent.map((r) => [r.vehicleId, r.expectedYear])),
    EXPECTED_LOCAL_YEARS,
  );
  for (const record of approved) {
    const evidence = localAudit.approvedLocalContent.find(
      (entry) => entry.vehicleId === record.vehicle.vehicleId,
    );
    assert.ok(evidence);
    assert.equal(record.usage, "unknown");
    assert.deepEqual(record.vehicle, evidence.identity);
    assert.deepEqual(record.commonPolicy, evidence.commonPolicy);
    assert.deepEqual(record.sources, evidence.sources);
    assert.equal(record.approvedFingerprint, factoryWarrantyReviewFingerprint(record));
  }
});

test("the disabled local registry returns zero stamps for every current catalog snapshot", () => {
  assert.equal(localAudit.currentCatalogSnapshot.length, 13);
  for (const entry of localAudit.currentCatalogSnapshot) {
    assert.equal(resolveFactoryWarranty(entry, { ...localRegistry, enabled: false }, localAudit.reviewedAt), undefined, entry.id);
  }
});

test("the authorized registry yields exactly the five reviewed units and expected years", () => {
  const actual = Object.fromEntries(
    localAudit.currentCatalogSnapshot.flatMap((entry) => {
      const stamp = resolveFactoryWarranty(entry, enabledLocalRegistry, localAudit.reviewedAt);
      return stamp ? [[entry.id, stamp.estimatedEndYear]] : [];
    }),
  );
  assert.deepEqual(actual, EXPECTED_LOCAL_YEARS);
  assert.equal(localRegistry.enabled, true, "Only the specifically approved release is enabled");
});

for (const [id, expectedYear] of Object.entries(EXPECTED_LOCAL_YEARS)) {
  test("real unit " + id + " loses its stamp when the current flag, identity, or sale status changes", () => {
    const current = localVehicle(id);
    assert.equal(
      resolveFactoryWarranty(current, enabledLocalRegistry, localAudit.reviewedAt)?.estimatedEndYear,
      expectedYear,
    );
    for (const changed of [
      { ...current, diferenciais: current.diferenciais?.filter((d) => d.tag !== "garantia_fabrica") },
      { ...current, modelo: current.modelo + " OTHER VERSION" },
      { ...current, anoFabricacao: current.anoFabricacao! - 1 },
      { ...current, price: 0 },
    ]) {
      assert.equal(
        resolveFactoryWarranty(changed, enabledLocalRegistry, localAudit.reviewedAt),
        undefined,
      );
    }
  });
}

for (const id of ["20066", "19994", "20038", "19857"]) {
  test("real unit " + id + " respects the strict 100,000 km common-policy boundary", () => {
    const current = localVehicle(id);
    assert.equal(
      resolveFactoryWarranty({ ...current, km: 99999 }, enabledLocalRegistry, localAudit.reviewedAt)?.estimatedEndYear,
      EXPECTED_LOCAL_YEARS[id],
    );
    for (const km of [100000, 100001]) {
      assert.equal(
        resolveFactoryWarranty({ ...current, km }, enabledLocalRegistry, localAudit.reviewedAt),
        undefined,
      );
    }
  });
}

test("the reviewed Tera general rule stays unlimited without inventing a commercial branch", () => {
  const record = localRegistry.records.find((r) => r.vehicle.vehicleId === "19587")!;
  assert.ok(record.commonPolicy);
  assert.equal(record.commonPolicy.kind, "documented-general-rule");
  assert.deepEqual(record.commonPolicy.branches.map((b) => b.category), ["general"]);
  assert.equal(
    resolveFactoryWarranty(
      { ...localVehicle("19587"), km: 150000 },
      enabledLocalRegistry,
      localAudit.reviewedAt,
    )?.estimatedEndYear,
    2028,
  );
});
