import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVehicleColor, type ColorConfirmation } from '../../src/lib/vehicleColor';
const vehicle = { id: '1', marca: 'VW', modelo: 'Nivus Highline', year: 2024, anoFabricacao: 2023, motor: '1.0', cambio: 'AT', combustivel: 'FLEX', cor: 'PRETA', physicalIdentityKey: 'a'.repeat(64) };
const record = { id: 'color-1', status: 'confirmed', vehicle: { id: '1', brand: 'VW', model: 'Nivus Highline', modelYear: 2024, manufactureYear: 2023, engine: '1.0', transmission: 'AT', fuel: 'FLEX', genericColor: 'PRETA', physicalIdentityKey: 'a'.repeat(64) }, officialName: 'Preto Ninja', evidence: { kind: 'paint-code', publicReference: 'synthetic-fixture', verifiedAt: '2026-11-15', verifiedBy: 'document-review' }, publication: { approved: true, publicReference: 'synthetic-approval' } };
const registry = () => ({ schemaVersion: 1, records: [structuredClone(record)] });
const catalogRegistry = () => {
 const confirmed: ColorConfirmation = {
  ...structuredClone(record),
  status: 'confirmed',
  evidence: {
   kind: 'catalog-unique-match', verifiedBy: 'catalog-review',
   publicReference: 'synthetic-catalog', verifiedAt: '2026-11-16',
   catalog: {
    market: 'BR', brand: 'VW', model: 'Nivus Highline', modelYear: 2024,
    engine: '1.0', transmission: 'AT', fuel: 'FLEX', complete: true,
    palette: [
     {officialName: 'Preto Ninja', genericColor: 'PRETA'},
     {officialName: 'Branco Cristal', genericColor: 'BRANCA'},
    ],
    sourceUrls: ['https://www.vw.com.br/synthetic-fixture'],
   },
  },
  publication: {approved: true, publicReference: 'synthetic-continuous-approval'},
 };
 return {schemaVersion: 1, records: [confirmed]};
};
test('unique exact catalog correspondence is labeled as lookup, not unit evidence', () => {
 const before = structuredClone(vehicle);
 const resolved = resolveVehicleColor(vehicle, catalogRegistry());
 assert.equal(resolved.display, 'Preto Ninja');
 assert.equal(resolved.genericColor, 'PRETA');
 assert.equal(resolved.verificationBasis, 'catalog-match');
 assert.deepEqual(vehicle, before);
});
test('ambiguous or incomplete palettes cannot override the XML color', () => {
 const mutations = [
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.palette.push({officialName:'Preto Metálico',genericColor:'PRETA'}); },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.palette.push({officialName:'Preto Ninja',genericColor:'PRETA'}); },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.palette=[]; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.sourceUrls=[]; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.sourceUrls=['http://example.com']; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.sourceUrls=['https://user:secret@example.com']; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.modelYear=2025; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.model='Nivus Comfortline'; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.engine='1.6'; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.transmission='MT'; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.catalog!.fuel='DIESEL'; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].evidence.verifiedBy='owner'; },
  (r: ReturnType<typeof catalogRegistry>) => { r.records[0].officialName='Preto Outro'; },
 ];
 for (const mutate of mutations) {
  const r=catalogRegistry();mutate(r);
  assert.equal(resolveVehicleColor(vehicle,r).display,'PRETA');
 }
 for (const catalog of [null, {}, {complete:false}, {complete:true,palette:[null]}]) {
  const r = catalogRegistry();
  const malformed = {...r, records:[{...r.records[0],evidence:{...r.records[0].evidence,catalog}}]};
  assert.equal(resolveVehicleColor(vehicle,malformed).display,'PRETA');
 }
});
test('catalog confirmations remain bound to the unit and publication authorization', () => {
 const r=catalogRegistry();
 assert.equal(resolveVehicleColor({...vehicle, physicalIdentityKey:'b'.repeat(64)},r).display,'PRETA');
 assert.equal(resolveVehicleColor({...vehicle, cor:'BRANCA'},r).display,'BRANCA');
 assert.equal(resolveVehicleColor(vehicle,{...r,records:[...r.records,...r.records]}).display,'PRETA');
 const revoked={...r,records:[{...r.records[0],publication:{approved:false,publicReference:'revoked'}}]};
 assert.equal(resolveVehicleColor(vehicle,revoked).display,'PRETA');
});
test('unregistered unit preserves original string and does not mutate input', () => {
 const original = structuredClone(vehicle);
 assert.equal(resolveVehicleColor(vehicle).display, 'PRETA');
 assert.equal(resolveVehicleColor(vehicle).status, 'pending');
 assert.deepEqual(vehicle, original);
});
test('confirmed exact unit replaces display only; repeat import is idempotent', () => {
 assert.equal(resolveVehicleColor(vehicle, registry()).display, 'Preto Ninja');
 assert.equal(resolveVehicleColor(vehicle, registry()).genericColor, 'PRETA');
 assert.equal(resolveVehicleColor(vehicle, registry()).verificationBasis, 'unit-evidence');
 assert.deepEqual(resolveVehicleColor(vehicle, registry()), resolveVehicleColor(structuredClone(vehicle), registry()));
});
test('each identity or source color change invalidates confirmation', () => {
 for(const [key,value] of Object.entries({id:'2', marca:'Other',modelo:'Other',year:2025,anoFabricacao:2022,motor:'2.0',cambio:'MT',combustivel:'DIESEL',cor:'AZUL',physicalIdentityKey:'b'.repeat(64)})) {
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
 for (const key of ['id','marca','modelo','year','anoFabricacao','motor','cambio','combustivel','physicalIdentityKey']) {
  assert.equal(resolveVehicleColor({...vehicle,[key]:{toString:0}},registry()).display,'PRETA',key);
 }
 const invalidFuel = registry();
 delete (invalidFuel.records[0].vehicle as {fuel?: string}).fuel;
 assert.equal(resolveVehicleColor(vehicle,invalidFuel).display,'PRETA');
 const malformed = registry();
 Object.assign(malformed.records[0].evidence,{verifiedAt:{toString:0}});
 assert.equal(resolveVehicleColor(vehicle,malformed).display,'PRETA');
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
