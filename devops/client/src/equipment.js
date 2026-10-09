export const REVIEW_NOTE_LIMIT = 2000;
export const REVIEW_SOURCE_LIMIT = 2048;

export function isEquipmentJobActive(job) {
  return job?.status === 'queued' || job?.status === 'running';
}

export function hasEquipmentAlerts(vehicle) {
  return vehicle.findings?.some(({ severity }) => severity === 'high' || severity === 'medium') || false;
}

function isReviewPending(vehicle, reviews) {
  // An equipment note cannot resolve the separate warranty approval gate.
  // Use actionable findings so an eligible restricted coverage is not treated
  // as pending merely because general vehicle coverage is out of scope.
  return reviews[vehicle.reviewKey]?.status !== 'reviewed' ||
    (vehicle.findings?.some(({ code, severity }) => code?.startsWith('factory-warranty-') &&
      (severity === 'high' || severity === 'medium')) || false);
}

export function equipmentReviewCounts(vehicles, reviews = {}) {
  const reviewed = vehicles.filter((vehicle) => reviews[vehicle.reviewKey]?.status === 'reviewed').length;
  return {
    vehicles: vehicles.length,
    pending: vehicles.filter((vehicle) => isReviewPending(vehicle, reviews)).length,
    reviewed,
    withAlerts: vehicles.filter(hasEquipmentAlerts).length,
  };
}

function normalizeSearch(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function filterEquipmentVehicles(vehicles, reviews = {}, filter = 'all', query = '') {
  const search = normalizeSearch(query.trim());
  return vehicles.filter((vehicle) => {
    const reviewed = reviews[vehicle.reviewKey]?.status === 'reviewed';
    if (filter === 'pending' && !isReviewPending(vehicle, reviews)) return false;
    if (filter === 'reviewed' && !reviewed) return false;
    if (filter === 'alerts' && !hasEquipmentAlerts(vehicle)) return false;
    if ((filter === 'new' || filter === 'changed') && vehicle.change !== filter) return false;
    return !search || normalizeSearch([
      vehicle.id, vehicle.brand, vehicle.model, vehicle.modelYear, vehicle.engine, vehicle.transmission,
    ].join(' ')).includes(search);
  });
}

export function equipmentResearchUrl(vehicle) {
  const query = vehicle.researchQuery || [
    vehicle.brand, vehicle.model, vehicle.modelYear, vehicle.engine, 'Brasil catálogo oficial equipamentos',
  ].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function safeEquipmentSourceUrl(value) {
  if (typeof value !== 'string' || value.length > REVIEW_SOURCE_LIMIT) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function equipmentReviewError(status, note, sourceUrl) {
  if (status === 'reviewed' && !note.trim()) return 'Registre uma nota antes de marcar como revisado.';
  if (note.length > REVIEW_NOTE_LIMIT) return `A nota deve ter até ${REVIEW_NOTE_LIMIT} caracteres.`;
  if (sourceUrl.trim() && !safeEquipmentSourceUrl(sourceUrl)) {
    return 'Use uma URL HTTPS válida, sem usuário ou senha, com até 2.048 caracteres.';
  }
  return '';
}
