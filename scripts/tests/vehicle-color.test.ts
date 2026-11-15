import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVehicleColor } from '../../src/lib/vehicleColor';
const vehicle = { id: '1', marca: 'VW', modelo: 'Nivus Highline', year: 2024, anoFabricacao: 2023, motor: '1.0', cambio: 'AT', cor: 'PRETA', physicalIdentityKey: 'a'.repeat(64) };
const record = { id: 'color-1', status: 'confirmed', vehicle: { id: '1', brand: 'VW', model: 'Nivus Highline', modelYear: 2024, manufactureYear: 2023, engine: '1.0', transmission: 'AT', genericColor: 'PRETA', physicalIdentityKey: 'a'.repeat(64) }, officialName: 'Preto Ninja', evidence: { kind: 'paint-code', publicReference: 'synthetic-fixture', verifiedAt: '2026-11-15', verifiedBy: 'document-review' }, publication: { approved: true, publicReference: 'synthetic-approval' } };
const registry = () => ({ schemaVersion: 1, records: [structuredClone(record)] });
test('default empty registry preserves original string and does not mutate input', () => {
 const original = structuredClone(vehicle);
 assert.equal(resolveVehicleColor(vehicle).display, 'PRETA');
 assert.equal(resolveVehicleColor(vehicle).status, 'pending');
 assert.deepEqual(vehicle, original);
});
test('confirmed exact unit uses parentheses; repeat import is idempotent', () => {
 assert.equal(resolveVehicleColor(vehicle, registry()).display, 'PRETA (Preto Ninja)');
 assert.deepEqual(resolveVehicleColor(vehicle, registry()), resolveVehicleColor(structuredClone(vehicle), registry()));
});
test('each identity or source color change invalidates confirmation', () => {
 for(const [key,value] of Object.entries({id:'2', marca:'Other',modelo:'Other',year:2025,anoFabricacao:2022,motor:'2.0',cambio:'MT',cor:'AZUL',physicalIdentityKey:'b'.repeat(64)})) {
  const changed = {...vehicle,[key]:value};
  assert.equal(resolveVehicleColor(changed,registry()).officialName,null,key);
 }
});
test('catalogue, draft, unapproved, missing identity, wrong schema and duplicate fail closed', () => {
 const mutations = [
  (r: ReturnType<typeof registry>) => { r.records[0].evidence.kind='catalogue'; },
  (r: ReturnType<typeof registry>) => { r.records[0].status='candidate'; },
  (r: ReturnType<typeof registry>) => { r.records[0].publication.approved=false; },
  (r: ReturnType<typeof registry>) => { r.records[0].evidence.publicReference=''; },
  (r: ReturnType<typeof registry>) => { r.schemaVersion=99; },
  (r: ReturnType<typeof registry>) => { r.records.push(structuredClone(record)); },
 ];
 for(const mutate of mutations) {const r=registry();mutate(r);assert.equal(resolveVehicleColor(vehicle,r).display,'PRETA');}
 assert.equal(resolveVehicleColor({...vehicle,physicalIdentityKey:null},registry()).display,'PRETA');
 assert.equal(resolveVehicleColor({...vehicle,anoFabricacao:undefined},registry()).display,'PRETA');
});
test('missing or malformed data stays generic; no current year guessing', () => {
 for(const invalid of [null, {}, {schemaVersion:1,records:[null,{},'bad']}]) assert.equal(resolveVehicleColor(vehicle, invalid).display,'PRETA');
 assert.equal(resolveVehicleColor({}).display,'');
});
test('color changes use separate review state and preserve equipment review', async () => {
 const { buildEquipmentAudit, parseStockResponse } = await import('../audit-vehicle-equipment');
 const source = {id:'987654',marca:'VW',modelo:'Nivus Highline',ano:2024,ano_fabricacao:2023,motor:'1.0',cambio:'AT',cor:'PRETA',valor:100000,opcionais:[],placa:'ABC1D23',chassi:'private-do-not-persist',renavam:'private-do-not-persist'};
 const parsed = parseStockResponse({success:true,total_results:1,data:[source]});
 const first = buildEquipmentAudit(parsed,null,'2026-11-15T18:00:00Z');
 const changed = buildEquipmentAudit([{...parsed[0],cor:'AZUL'}],first,'2026-11-16T18:00:00Z');
 assert.equal(changed.vehicles[0].change,'unchanged');
 assert.equal(changed.vehicles[0].reviewKey,first.vehicles[0].reviewKey);
 assert.equal(changed.vehicles[0].colorChange,'changed');
 const repeated=buildEquipmentAudit([{...parsed[0],cor:'AZUL'}],changed,'2026-11-17T18:00:00Z');
 assert.equal(repeated.vehicles[0].colorChange,'unchanged');
 const encoded=JSON.stringify(changed);
 assert.ok(!encoded.includes(source.placa));
 assert.ok(!encoded.includes(source.chassi));
 assert.equal(changed.vehicles[0].color?.display,'AZUL');
});
