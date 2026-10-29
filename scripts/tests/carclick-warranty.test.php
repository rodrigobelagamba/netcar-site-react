<?php
require_once __DIR__ . '/../../public/feeds/carclick-warranty.php';
$checks = 0;
function verify_carclick_warranty($condition, $name) {
    global $checks;
    $checks++;
    if (!$condition) { fwrite(STDERR, "FAIL: " . $name . "\n"); exit(1); }
}
function warranty_fixture() {
    $raw = array('codigo_anuncio_revenda'=>'999000','marca'=>'TEST','modelo'=>'VERSION','ano_fabricacao'=>'2025','ano_modelo'=>'2026','motor'=>'1.0','cambio'=>'AUTOMATICO','placa'=>'ABC1234','quilometragem'=>'10000','preco'=>'100000');
    $live = array('id'=>'999000','marca'=>'TEST','modelo'=>'VERSION TURBO','ano_fabricacao'=>2025,'ano'=>2026,'motor'=>'1.0','cambio'=>'AUTOMATICO','placa'=>'ABC1234','km'=>10000,'valor'=>100000,'diferenciais'=>array(array('tag'=>'garantia_fabrica')));
    $coverage = array('scope'=>'basic-vehicle','validBefore'=>'2028-01-01','minimumMileageKm'=>10000,'mileage'=>array('kind'=>'limited','limitKm'=>100000));
    $claim = array('id'=>'999000','brand'=>'TEST','canonicalModel'=>'VERSION TURBO','rawModel'=>'VERSION','manufactureYear'=>2025,'modelYear'=>2026,'engine'=>'1.0','transmission'=>'AUTOMATICO','unitKey'=>'plate-sha256:'.hash('sha256','ABC1234'),'requiresWarrantyFlag'=>true,'coverages'=>array($coverage));
    $hash = hash('sha256', 'reviewed authority fixture');
    return array($raw, array('schemaVersion'=>1,'authoritySha256'=>$hash,'generatedForDay'=>'2026-10-29','claims'=>array($claim)), $hash, $live);
}
function evaluate_warranty_fixture($fixture, $day='2026-10-29') {
    return netcar_carclick_warranty_claim($fixture[0], $fixture[1], $fixture[2], $fixture[3], $day);
}
$base = warranty_fixture();
$text = evaluate_warranty_fixture($base);
verify_carclick_warranty(strpos($text, 'tem garantia de fábrica vigente') === 0, 'valid general claim');
verify_carclick_warranty(!preg_match('/999000|10000|100000|2028|ABC1234/', $text), 'no IDs km prices or estimated dates in copy');
foreach (array('marca'=>'OTHER','modelo'=>'VERSION OTHER','ano_modelo'=>'2025','motor'=>'2.0','cambio'=>'MANUAL','placa'=>'XYZ1234','codigo_anuncio_revenda'=>'999001','quilometragem'=>'9999','preco'=>'0') as $key=>$value) {
    $fixture = warranty_fixture(); $fixture[0][$key] = $value;
    verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'raw mismatch '.$key);
}
foreach (array('marca'=>'OTHER','modelo'=>'VERSION OTHER','ano'=>2025,'motor'=>'2.0','cambio'=>'MANUAL','placa'=>'XYZ1234','id'=>'999001','km'=>9999,'valor'=>0,'diferenciais'=>array()) as $key=>$value) {
    $fixture = warranty_fixture(); $fixture[3][$key] = $value;
    verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'live mismatch '.$key);
}
$fixture = warranty_fixture(); $fixture[2] = hash('sha256','revoked registry');
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'registry authority changed');
$fixture = warranty_fixture(); $fixture[3] = null;
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'API unavailable');
$fixture = warranty_fixture(); $fixture[3]['chassi'] = 'INVALID';
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'invalid API VIN cannot fall back to plate');
$fixture = warranty_fixture(); $fixture[3]['factoryWarrantyVehicle'] = array();
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'embedded cache is not current raw evidence');
$fixture = warranty_fixture(); $fixture[1]['claims'][] = $fixture[1]['claims'][0];
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'duplicate unit claims');
verify_carclick_warranty(evaluate_warranty_fixture(warranty_fixture(),'2028-01-01') === '', 'estimated final year cutoff');
verify_carclick_warranty(evaluate_warranty_fixture(warranty_fixture(),'2026-02-30') === '', 'invalid clock');
verify_carclick_warranty(evaluate_warranty_fixture(warranty_fixture(),'2026-10-28') === '', 'future approval snapshot');
$fixture = warranty_fixture(); $fixture[0]['quilometragem']='100000'; $fixture[3]['km']=100000;
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'limit reached');
$fixture = warranty_fixture(); $fixture[0]['quilometragem']='11000'; $fixture[3]['km']=11000;
verify_carclick_warranty(evaluate_warranty_fixture($fixture) !== '', 'normal increase remains below cap');
$fixture = warranty_fixture(); $fixture[1]['claims'][0]['coverages'][0]['scope']='powertrain';
$fixture[1]['claims'][0]['coverages'][0]['mileage']=array('kind'=>'unknown');
$fixture[1]['claims'][0]['coverages'][0]['exactMileageKm']=10000;
verify_carclick_warranty(strpos(evaluate_warranty_fixture($fixture),'para motor e câmbio') !== false, 'powertrain restricted scope');
$fixture[0]['quilometragem']='10001'; $fixture[3]['km']=10001;
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'current unit confirmation cannot follow changed km');
$fixture = warranty_fixture(); $fixture[1]['claims'][0]['coverages'][0]['scope']='traction-battery';
verify_carclick_warranty(strpos(evaluate_warranty_fixture($fixture),'para a bateria de tração') !== false, 'battery restricted scope');
$fixture = warranty_fixture(); $fixture[1]['claims'][0]['coverages'][0]['scope']='extension';
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'unsupported scope');
$fixture = warranty_fixture(); $fixture[3]['diferenciais']=array(); $fixture[1]['claims'][0]['requiresWarrantyFlag']=false;
verify_carclick_warranty(evaluate_warranty_fixture($fixture) !== '', 'canonical explicit catalog confirmation');
$fixture = warranty_fixture(); $fixture[1]['claims'][0]['coverages'][0]['advertisedExpiryMonth']='2027-06';
$fixture[1]['claims'][0]['coverages'][0]['validBefore']='2027-06-15';
verify_carclick_warranty(strpos(evaluate_warranty_fixture($fixture),'até 06/2027') !== false, 'actual expiry month is advertised');
verify_carclick_warranty(evaluate_warranty_fixture($fixture,'2027-06-15') === '', 'actual expiry day respected');
$fixture[1]['claims'][0]['coverages'][0]['advertisedExpiryMonth']='2027-13';
verify_carclick_warranty(evaluate_warranty_fixture($fixture) === '', 'malformed advertised month excluded');
echo 'carclick warranty runtime: '.$checks." checks passed\n";
