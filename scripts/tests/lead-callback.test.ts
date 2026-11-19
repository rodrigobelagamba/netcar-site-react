import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrmCallbackPayload,
  normalizeBrazilCallbackPhone,
  submitVehicleCallbackLead,
} from "../../src/lib/leadCallback";

test("normalizeBrazilCallbackPhone accepts valid BR mobile/landline and rejects fake inputs", () => {
  assert.equal(normalizeBrazilCallbackPhone("(51) 99999-1234"), "5551999991234");
  assert.equal(normalizeBrazilCallbackPhone("55 51 99999-1234"), "5551999991234");
  assert.equal(normalizeBrazilCallbackPhone("(51) 3473-1234"), "555134731234");
  assert.equal(normalizeBrazilCallbackPhone("(51) 89999-1234"), null); // 11 dígitos sem 9 inicial
  assert.equal(normalizeBrazilCallbackPhone("(00) 99999-1234"), null); // DDD inválido
  assert.equal(normalizeBrazilCallbackPhone("99999999999"), null); // dígitos repetidos
  assert.equal(normalizeBrazilCallbackPhone("51999"), null);
});

test("buildCrmCallbackPayload matches crmleads contract (SITE / Site / Lead Site)", () => {
  const payload = buildCrmCallbackPayload(
    {
      phone: "(51) 99888-7766",
      vehicleId: 20068,
      vehicleName: "PEUGEOT 2008 ACTIVE T200 TURBO 2025",
      intentSummary: "Financiar · Entrada R$ 25.000 em 48x",
      pageUrl: "https://www.netcarmultimarcas.com.br/veiculo/2008-active-t200-turbo-2025-jdn-xx85-20068",
      waRef: "M7KQ4X9P",
      clickId: "nc_1234567890abcdef1234567890abcdef",
      traffic: {
        src: "META",
        campaign: "suv-esteio",
        fbclid: "fb.1.test",
      },
    },
    "2026-11-19T15:55:00-03:00",
  );

  assert.ok(payload);
  assert.equal(payload.event, "lead_created");
  assert.equal(payload.timestamp, "2026-11-19T15:55:00-03:00");
  assert.deepEqual(
    {
      phone: payload.data.phone,
      name: payload.data.name,
      interest: payload.data.interest,
      origem: payload.data.origem,
      canal: payload.data.canal,
      id_carro: payload.data.id_carro,
    },
    {
      phone: "5551998887766",
      name: "Lead Site",
      interest: "PEUGEOT 2008 ACTIVE T200 TURBO 2025 (ID 20068)",
      origem: "SITE",
      canal: "Site",
      id_carro: "20068",
    },
  );
  assert.match(payload.data.summary, /Intenção: Financiar · Entrada R\$ 25\.000 em 48x\./);
  assert.match(payload.data.summary, /Fonte=META/);
  assert.match(payload.data.summary, /wa_ref=M7KQ4X9P/);
});

test("submitVehicleCallbackLead handles dry_run without marking crmConfirmed", async () => {
  const mockFetch = (async () =>
    new Response(
      JSON.stringify({
        ok: true,
        dry_run: true,
        crm_confirmed: false,
        payload: {
          event: "lead_created",
          timestamp: "2026-11-19T15:55:00-03:00",
          data: {
            phone: "5551998887766",
            name: "Lead Site",
            interest: "PEUGEOT 2008 ACTIVE T200 TURBO 2025 (ID 20068)",
            origem: "SITE",
            canal: "Site",
            id_carro: "20068",
            summary: "Pedido de retorno no site (Me chamar).",
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;

  const res = await submitVehicleCallbackLead(
    {
      phone: "(51) 99888-7766",
      vehicleId: 20068,
      vehicleName: "PEUGEOT 2008 ACTIVE T200 TURBO 2025",
    },
    mockFetch,
  );

  assert.equal(res.ok, true);
  assert.equal(res.dryRun, true);
  assert.equal(res.crmConfirmed, false);
  assert.equal(res.payload?.data.origem, "SITE");
  assert.equal(res.payload?.data.canal, "Site");
  assert.equal(res.payload?.data.name, "Lead Site");
});

test("submitVehicleCallbackLead surfaces backend error so UI falls back to WhatsApp", async () => {
  const mockFetch = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: "Não foi possível confirmar o pedido agora. Chame direto no WhatsApp.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;

  const res = await submitVehicleCallbackLead(
    {
      phone: "(51) 99888-7766",
      vehicleId: 20068,
      vehicleName: "PEUGEOT 2008 ACTIVE T200 TURBO 2025",
    },
    mockFetch,
  );

  assert.equal(res.ok, false);
  assert.equal(res.crmConfirmed, false);
  assert.match(res.error || "", /WhatsApp/);
});
