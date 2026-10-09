export const REVIEW_NOTE_LIMIT = 2000;
export const REVIEW_SOURCE_LIMIT = 2048;

export function isEquipmentJobActive(job) {
  return job?.status === 'queued' || job?.status === 'running';
}

export function hasEquipmentAlerts(vehicle) {
  return vehicle.findings?.some(({ severity }) => severity === 'high' || severity === 'medium') || false;
}

export function equipmentReviewCounts(vehicles, reviews = {}) {
  const reviewed = vehicles.filter((vehicle) => reviews[vehicle.reviewKey]?.status === 'reviewed').length;
  return {
    vehicles: vehicles.length,
    pending: vehicles.length - reviewed,
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
    if (filter === 'pending' && reviewed) return false;
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

export const EQUIPMENT_RESEARCH_STATES = {
  pending: 'Descoberto / aguardando conferência',
  presence_confirmed: 'Presença confirmada',
  authorized: 'Inclusão autorizada',
  confirmed: 'Confirmação legada — revisar texto',
  published: 'Publicado e verificado',
  excluded: 'Não incluir', rejected: 'Não confirmado', deferred: 'Preciso conferir',
};

export function equipmentResearchDecisionError(decision) {
  if (!decision.note?.trim() || decision.note.length > 2000) return 'Registre uma nota de até 2.000 caracteres.';
  if (decision.status === 'presence_confirmed' && !decision.present) return 'Confirme a presença nesta unidade.';
  if (decision.status === 'authorized') {
    if (!decision.present || !decision.marketConfirmed || !decision.authorizePublication) return 'Confirme presença, mercado brasileiro e autorização do texto nos campos separados.';
    if (!decision.confirmationReference?.trim()) return 'Registre a referência da confirmação do responsável.';
    if (!decision.approvedText?.name?.trim() || !decision.approvedText?.description?.trim()) return 'Informe nome e descrição exatos para publicação.';
  }
  if (decision.status !== 'authorized' && decision.authorizePublication) return 'Esta decisão não autoriza publicação.';
  return '';
}

export function filterEquipmentResearch(revisions, query = '', status = 'all') {
  const search = normalizeSearch(query.trim());
  return revisions.filter((revision) => {
    if (status !== 'all' && revision.status !== status) return false;
    const { identity, item } = revision.candidate;
    return !search || normalizeSearch([identity.id, identity.brand, identity.model, identity.modelYear, item.label].join(' ')).includes(search);
  });
}
