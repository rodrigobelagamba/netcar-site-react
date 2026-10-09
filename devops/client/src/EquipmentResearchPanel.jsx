import { useMemo, useState } from 'react';
import { EQUIPMENT_RESEARCH_STATES, equipmentResearchDecisionError, filterEquipmentResearch, safeEquipmentSourceUrl } from './equipment.js';

const classifications = { standard: 'Série documentada', package: 'Pacote opcional', accessory: 'Acessório', inference: 'Inferência — não elegível' };
const seen = (value) => value === true ? 'Sim' : value === false ? 'Não' : 'Não verificado';
const blockers = {
  xml_api_model_mismatch: 'A descrição do modelo diverge entre XML e API; conferir a mesma unidade',
  xml_api_identity_mismatch: 'A identidade diverge entre XML e API',
  stock_identity_mismatch: 'O cadastro atual não corresponde à versão pesquisada',
  evidence_identity_mismatch: 'A fonte não corresponde à versão pesquisada',
  incomplete_identity: 'A identidade da unidade está incompleta',
  manufacture_year_required: 'A fabricação precisa ser confirmada',
  manufacture_year_mismatch: 'A fabricação difere da unidade pesquisada',
  vehicle_missing: 'A unidade não aparece no estoque atual',
  already_displayed: 'O equipamento já aparece na lista calculada',
  taxonomy_review_required: 'O novo equipamento precisa de classificação revisada',
  unit_reappearance_requires_new_review: 'O código saiu e voltou ao estoque; precisa de nova revisão',
};
const sourceStates = { not_researched: 'Ainda não pesquisado', 'no-compatible-source': 'Pesquisado sem fonte compatível', ambiguous: 'Fonte ambígua: conferir versão', 'source-found': 'Fonte localizada: revisar' };

function ResearchItem({ revision, comparison, disabled, onDecision }) {
  const { identity, item, evidence, classification } = revision.candidate;
  const [status, setStatus] = useState('presence_confirmed');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [name, setName] = useState(comparison?.suggestedSiteText?.name || item.label);
  const [description, setDescription] = useState(comparison?.suggestedSiteText?.description || item.label);
  const [present, setPresent] = useState(false);
  const [market, setMarket] = useState(false);
  const [authorize, setAuthorize] = useState(false);
  const [sourceIdentity, setSourceIdentity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const source = safeEquipmentSourceUrl(evidence.url);
  const locked = disabled || saving || !revision.active || Boolean(revision.invalidatedAt) || revision.status === 'published';
  const id = `research-${revision.key}`;

  async function submit(event) {
    event.preventDefault();
    const decision = { key: revision.key, vehicleId: identity.id, itemKey: item.key, status, note: note.trim(),
      present, marketConfirmed: market, authorizePublication: status === 'authorized' && authorize,
      sourceIdentityConfirmed: sourceIdentity,
      ...(reference.trim() ? { confirmationReference: reference.trim() } : {}),
      ...(status === 'authorized' ? { approvedText: { name: name.trim(), description: description.trim() } } : {}) };
    const validation = equipmentResearchDecisionError(decision);
    setError(validation);
    if (validation) return;
    setSaving(true);
    try { await onDecision(decision); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <details className="equipment-vehicle">
    <summary>
      <span className="equipment-vehicle-heading"><strong>{item.label}</strong><span className="equipment-muted">#{identity.id} · {identity.brand} {identity.model} · {identity.manufactureYear ?? '?'} / {identity.modelYear} · {identity.engine} · {identity.transmission}</span></span>
      <span className="equipment-badges"><span className={`pill ${revision.status === 'authorized' || revision.status === 'published' ? 'ok' : 'warn'}`}>{EQUIPMENT_RESEARCH_STATES[revision.status] || revision.status}</span><span className="equipment-expand" aria-hidden="true">⌄</span></span>
    </summary>
    <div className="equipment-vehicle-body">
      <p><strong>{classifications[classification]}</strong>{!item.tag || comparison?.comparison === 'new_taxonomy_candidate' ? ' · Equipamento novo: classificação e texto ainda precisam de revisão.' : ''}</p>
      <p><a href={`https://www.netcarmultimarcas.com.br/veiculo/${identity.id}`} target="_blank" rel="noopener noreferrer">Abrir ficha pública da unidade #{identity.id} ↗</a></p>
      <p>{source ? <a href={source} target="_blank" rel="noopener noreferrer">{evidence.title} ↗</a> : evidence.title} · {evidence.date} · {evidence.locator}</p>
      <p className="equipment-muted">{evidence.claim}</p>
      {comparison ? <p>XML: {seen(comparison.inXml)} · API: {seen(comparison.inApi)} · Ficha pública: {seen(comparison.inPublic)}.</p> : null}
      {revision.contextBlockers?.length ? <ul className="equipment-findings">{[...new Set(revision.contextBlockers.map((blocker) => blockers[blocker] || 'Conferência adicional da identidade e da evidência necessária'))].map((message) => <li key={message}><span className="pill warn">Conferir</span><span>{message}.</span></li>)}</ul> : null}
      {revision.invalidatedAt ? <p className="error-banner">Cadastro ou evidência alterados: esta decisão precisa de nova revisão. O registro publicado anterior permanece no histórico.</p> : null}
      {revision.decision ? <p className="equipment-muted">Última decisão: {revision.decision.note}{revision.decision.confirmationReference ? ` · Referência: ${revision.decision.confirmationReference}` : ''}{revision.decision.approvedText ? ` · Texto autorizado: ${revision.decision.approvedText.name} — ${revision.decision.approvedText.description}` : ''}</p> : null}
      {revision.publication ? <p className="equipment-muted">Publicação verificada: {revision.publication.commit}.</p> : null}
      {revision.status !== 'published' && revision.active && !revision.invalidatedAt ? <form className="equipment-review" onSubmit={submit}>
        <h4>Decisão específica para este equipamento e esta unidade</h4>
        <p className="equipment-muted">Você confirma que {item.label} está presente nesta unidade? A presença e a autorização do texto são registradas separadamente. Esta tela registra a decisão; a incorporação e a publicação passam pela revisão do delta e do site.</p>
        <label htmlFor={`${id}-status`}>Resposta</label>
        <select id={`${id}-status`} value={status} disabled={locked} onChange={(event) => { setStatus(event.target.value); setAuthorize(false); }}>
          <option value="presence_confirmed">Confirmar somente presença</option><option value="authorized">Autorizar inclusão do texto abaixo</option>
          <option value="excluded">Não incluir no site</option><option value="rejected">Não confirmo o equipamento</option><option value="deferred">Preciso conferir</option>
        </select>
        <label htmlFor={`${id}-note`}>Nota da resposta</label><textarea id={`${id}-note`} rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} required disabled={locked} />
        <label htmlFor={`${id}-reference`}>Referência da confirmação (conversa, documento ou conferência)</label><input id={`${id}-reference`} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={2000} disabled={locked} required={status === 'authorized'} />
        {(status === 'presence_confirmed' || status === 'authorized' || status === 'excluded') ? <label><input type="checkbox" checked={present} onChange={(event) => setPresent(event.target.checked)} disabled={locked} /> Confirmo que o item está presente nesta unidade.</label> : null}
        {status === 'authorized' ? <>
          <label htmlFor={`${id}-name`}>Nome exato aprovado</label><input id={`${id}-name`} value={name} onChange={(event) => setName(event.target.value)} maxLength={400} required disabled={locked} />
          <label htmlFor={`${id}-description`}>Descrição exata aprovada</label><textarea id={`${id}-description`} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} required disabled={locked} />
          <label><input type="checkbox" checked={market} onChange={(event) => setMarket(event.target.checked)} disabled={locked} /> Confirmo o mercado brasileiro desta unidade.</label>
          <label><input type="checkbox" checked={authorize} onChange={(event) => setAuthorize(event.target.checked)} disabled={locked} /> Autorizo incluir somente este nome e esta descrição para esta unidade.</label>
          {revision.contextBlockers?.includes('xml_api_model_mismatch') ? <label><input type="checkbox" checked={sourceIdentity} onChange={(event) => setSourceIdentity(event.target.checked)} disabled={locked} /> Conferi que as descrições divergentes do modelo no XML e na API se referem a esta mesma unidade.</label> : null}
        </> : null}
        {error ? <p className="error-banner" role="alert">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={locked}>{saving ? 'Registrando…' : 'Registrar decisão deste item'}</button>
      </form> : null}
    </div>
  </details>;
}

export default function EquipmentResearchPanel({ research, disabled, onDecision }) {
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('all'); const [page, setPage] = useState(1);
  const [sourceLimit, setSourceLimit] = useState(20);
  const discovery = research?.discovery;
  const revisions = research?.revisions || [];
  const filtered = useMemo(() => filterEquipmentResearch(revisions, query, status), [revisions, query, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12)); const current = Math.min(page, pages);
  const withoutSource = discovery?.vehicles.filter((vehicle) => vehicle.sourceStatus !== 'research_candidates_recorded') || [];
  const observed = discovery ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(discovery.observedAt)) : 'nenhuma rodada concluída';
  const sourceUpdates = discovery?.sourceUpdates;
  return <section aria-labelledby="equipment-research-title" className="equipment-research-queue">
    <h3 id="equipment-research-title">Descoberta e decisões por equipamento</h3>
    <p className="equipment-muted">Última conferência concluída: {observed} (Brasília). A agenda consulta XML/API e reavalia as fontes oficiais registradas. Novas combinações sem documentação compatível ficam pendentes de pesquisa.</p>
    {research?.error ? <p className="error-banner" role="alert">{research.error}</p> : null}
    {discovery ? <dl className="equipment-counts"><div><dt>Unidades comparadas</dt><dd>{discovery.counts.inventoryCompared}</dd></div><div><dt>Com candidatos</dt><dd>{discovery.counts.withResearchCandidates}</dd></div><div><dt>Ainda não pesquisadas</dt><dd>{discovery.counts.notResearched}</dd></div><div><dt>Pesquisadas sem fonte</dt><dd>{discovery.counts.researchedWithoutCompatibleSource}</dd></div><div><dt>Fonte ambígua</dt><dd>{discovery.counts.ambiguous}</dd></div><div><dt>Fichas públicas verificadas</dt><dd>{discovery.counts.publicRendered}</dd></div></dl> : null}
    {withoutSource.length ? <details className="equipment-vehicle"><summary>Unidades que aguardam pesquisa ou revisão de fonte ({withoutSource.length})</summary><ul>{withoutSource.map((vehicle) => <li key={vehicle.id}>#{vehicle.id} · {vehicle.identity.brand} {vehicle.identity.model} · {vehicle.identity.manufactureYear ?? '?'} / {vehicle.identity.modelYear} · {vehicle.identity.engine} · {vehicle.identity.transmission} · {sourceStates[vehicle.sourceStatus] || 'Conferir fonte'}</li>)}</ul></details> : null}
    {sourceUpdates ? <details className="equipment-vehicle"><summary>Conferência dos documentos oficiais · {sourceUpdates.checks?.length || 0} fontes · {sourceUpdates.updates?.length || 0} trechos para triagem</summary><div className="equipment-vehicle-body">
      <p className="equipment-muted">Trechos iniciais ou alterados exigem leitura humana. Não comprovam presença e não autorizam inclusão. PDFs continuam aguardando leitura manual.</p>
      {sourceUpdates.failure ? <p className="error-banner" role="alert">A consulta dos documentos oficiais não foi concluída. O histórico anterior foi preservado e precisa de conferência.</p> : null}
      <ul>{(sourceUpdates.checks || []).map((check) => <li key={check.sourceKey}>{safeEquipmentSourceUrl(check.url) ? <a href={safeEquipmentSourceUrl(check.url)} target="_blank" rel="noopener noreferrer">Abrir documento ↗</a> : 'Documento'} · {check.status === 'ok' ? 'Consulta concluída' : check.status === 'manual_pdf_review_required' ? 'PDF: leitura manual necessária' : 'Consulta falhou; evidência anterior preservada'}</li>)}</ul>
      {(sourceUpdates.updates || []).slice(0, sourceLimit).map((update, index) => <section className="equipment-descriptions" key={`${update.sourceKey}-${update.paragraphSha256 || index}`}><h4>{update.title}</h4><p className="equipment-muted">{update.match.brand} {update.match.model} · MY {update.match.modelYear} · {update.edition} · {update.kind === 'baseline-excerpt' ? 'Trecho da primeira coleta, sem afirmar novidade' : 'Documento alterado: conferir'}</p><p>{update.text}</p></section>)}
      {(sourceUpdates.updates?.length || 0) > sourceLimit ? <button type="button" className="btn btn-ghost" onClick={() => setSourceLimit(sourceLimit + 20)}>Mostrar mais trechos ({sourceLimit} de {sourceUpdates.updates.length})</button> : null}
    </div></details> : null}
    <div className="equipment-filters"><label>Buscar item ou unidade<input type="search" value={query} maxLength={160} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label>Decisão<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Todas</option>{Object.entries(EQUIPMENT_RESEARCH_STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {filtered.slice((current - 1) * 12, current * 12).map((revision) => <ResearchItem key={revision.key} revision={revision} disabled={disabled} onDecision={onDecision} comparison={discovery?.vehicles.find((vehicle) => vehicle.id === revision.candidate.identity.id)?.candidates.find((item) => item.itemKey === revision.candidate.item.key)} />)}
    {!filtered.length ? <p className="equipment-empty">Nenhum item corresponde a este filtro. Unidades sem fonte compatível continuam aguardando pesquisa.</p> : null}
    {pages > 1 ? <nav className="equipment-pagination" aria-label="Páginas da pesquisa"><button className="btn btn-ghost" type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Anterior</button><span>{current} / {pages}</span><button className="btn btn-ghost" type="button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Próxima</button></nav> : null}
  </section>;
}
