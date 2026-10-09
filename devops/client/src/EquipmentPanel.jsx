import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import EquipmentResearchPanel from './EquipmentResearchPanel.jsx';
import {
  REVIEW_NOTE_LIMIT,
  REVIEW_SOURCE_LIMIT,
  equipmentResearchUrl,
  equipmentReviewCounts,
  equipmentReviewError,
  filterEquipmentVehicles,
  hasEquipmentAlerts,
  isEquipmentJobActive,
  safeEquipmentSourceUrl,
} from './equipment.js';

const PAGE_SIZE = 12;
const CHANGE_LABELS = { new: 'Novo', changed: 'Alterado', unchanged: 'Sem alteração' };
const JOB_LABELS = { queued: 'Na fila', running: 'Em execução', succeeded: 'Concluída', failed: 'Falhou' };
const SEVERITY_LABELS = { high: 'Atenção', medium: 'Conferir', info: 'Informação' };

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function DescriptionList({ title, items = [], empty }) {
  return (
    <section className="equipment-descriptions">
      <h4>{title} <span>({items.length})</span></h4>
      {items.length ? (
        <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      ) : <p className="equipment-muted">{empty}</p>}
    </section>
  );
}

function EquipmentVehicle({ vehicle, review, onSave }) {
  const [note, setNote] = useState(review?.note || '');
  const [sourceUrl, setSourceUrl] = useState(review?.sourceUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reviewed = review?.status === 'reviewed';
  const safeSource = safeEquipmentSourceUrl(review?.sourceUrl);
  const fieldsId = `equipment-${vehicle.reviewKey}`;

  useEffect(() => {
    setNote(review?.note || '');
    setSourceUrl(review?.sourceUrl || '');
  }, [review?.note, review?.sourceUrl]);

  async function save(status) {
    const validation = equipmentReviewError(status, note, sourceUrl);
    setError(validation);
    if (validation) return;
    setSaving(true);
    try {
      await onSave(vehicle, {
        status,
        note: note.trim(),
        sourceUrl: sourceUrl.trim(),
      });
    } catch (err) {
      setError(err.status === 409
        ? 'O cadastro mudou. Atualize o relatório e revise a nova lista antes de salvar.'
        : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="equipment-vehicle">
      <summary>
        <span className="equipment-vehicle-heading">
          <strong>{vehicle.brand} {vehicle.model}</strong>
          <span className="equipment-muted">
            #{vehicle.id} · {[vehicle.modelYear, vehicle.engine, vehicle.transmission].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="equipment-badges">
          {vehicle.change !== 'unchanged' ? <span className="pill">{CHANGE_LABELS[vehicle.change] || vehicle.change}</span> : null}
          {hasEquipmentAlerts(vehicle) ? <span className="pill bad">Com alerta</span> : null}
          <span className={`pill ${reviewed ? 'ok' : 'warn'}`}>{reviewed ? 'Revisado' : 'Pendente'}</span>
          <span className="equipment-expand" aria-hidden="true">⌄</span>
        </span>
      </summary>
      <div className="equipment-vehicle-body">
        <div className="equipment-research">
          <p className="equipment-muted">Confira a versão brasileira e o ano-modelo exatos em fontes oficiais.</p>
          <a className="btn btn-ghost" href={equipmentResearchUrl(vehicle)} target="_blank" rel="noopener noreferrer">
            Pesquisar manualmente ↗
          </a>
        </div>
        {vehicle.findings?.length ? (
          <ul className="equipment-findings">
            {vehicle.findings.map((finding, index) => (
              <li key={`${finding.code}-${index}`}>
                <span className={`pill ${finding.severity === 'high' ? 'bad' : finding.severity === 'medium' ? 'warn' : ''}`}>
                  {finding.code === 'research-needed' ? 'Pesquisa oficial pendente' : SEVERITY_LABELS[finding.severity] || 'Informação'}
                </span>
                <span>{finding.message}</span>
              </li>
            ))}
          </ul>
        ) : <p className="equipment-muted">Sem alertas automáticos. A pesquisa oficial continua necessária.</p>}
        <div className="equipment-description-grid">
          <DescriptionList title="Cadastro (API)" items={vehicle.inventoryDescriptions} empty="Nenhum equipamento informado no cadastro." />
          <DescriptionList title="Lista após aplicar as regras" items={vehicle.displayedDescriptions} empty="Nenhum equipamento na lista calculada." />
        </div>
        {vehicle.confirmationIds?.length ? (
          <p className="equipment-muted">Confirmações desta unidade: {vehicle.confirmationIds.join(', ')}.</p>
        ) : null}
        <form className="equipment-review" onSubmit={(event) => { event.preventDefault(); save('reviewed'); }}>
          <h4>Registro da revisão</h4>
          <p id={`${fieldsId}-help`} className="equipment-muted">
            A revisão registra sua análise deste relatório. Não acrescenta equipamentos, não confirma todos os itens de fábrica e não publica o site.
          </p>
          <label htmlFor={`${fieldsId}-note`}>Nota da revisão <span>(obrigatória para concluir)</span></label>
          <textarea
            id={`${fieldsId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={REVIEW_NOTE_LIMIT}
            rows={3}
            disabled={saving}
            aria-describedby={`${fieldsId}-help`}
            placeholder="Fonte consultada, versão e ano-modelo, página/tabela, conclusão e dúvidas restantes."
          />
          <div className="equipment-field-meta">{note.length}/{REVIEW_NOTE_LIMIT}</div>
          <label htmlFor={`${fieldsId}-source`}>Fonte oficial <span>(URL HTTPS, opcional)</span></label>
          <input
            id={`${fieldsId}-source`}
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            maxLength={REVIEW_SOURCE_LIMIT}
            disabled={saving}
            placeholder="https://…"
          />
          {error ? <p className="error-banner" role="alert">{error}</p> : null}
          <div className="equipment-review-footer">
            <div className="equipment-muted">
              {review?.updatedAt ? <span>Registro atualizado em {formatDate(review.updatedAt)} (Brasília).</span> : <span>Nenhuma revisão registrada para esta lista.</span>}
              {safeSource ? <> <a href={safeSource} target="_blank" rel="noopener noreferrer">Abrir fonte registrada ↗</a></> : null}
            </div>
            <div className="actions">
              {reviewed ? <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => save('pending')}>Reabrir pendência</button> : null}
              <button type="submit" className="btn btn-primary" disabled={saving || !note.trim()}>
                {saving ? 'Salvando…' : reviewed ? 'Salvar revisão' : 'Marcar como revisado'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </details>
  );
}

export default function EquipmentPanel({ token, onJob, busy = false, activeJob }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [action, setAction] = useState('');
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const requestRef = useRef(null);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (!silent) setLoading(true);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    try {
      const result = await api.equipment(token, controller.signal);
      if (requestRef.current === controller && !controller.signal.aborted) {
        setData(result);
        setLoadError('');
      }
    } catch (err) {
      if (requestRef.current === controller && (!controller.signal.aborted || timedOut)) {
        setLoadError(timedOut ? 'A atualização demorou mais que o esperado. Tente novamente.' : err.message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible' && !requestRef.current) refresh({ silent: true });
    };
    const timer = window.setInterval(refreshVisible, 20000);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshVisible);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    if (activeJob?.id && (activeJob.status === 'succeeded' || activeJob.status === 'failed')) {
      refresh({ silent: true });
    }
  }, [activeJob?.id, activeJob?.status, refresh]);

  const vehicles = data?.report?.vehicles || [];
  const reviews = data?.reviews || {};
  const counts = equipmentReviewCounts(vehicles, reviews);
  const filtered = useMemo(() => filterEquipmentVehicles(vehicles, reviews, filter, query), [vehicles, reviews, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const schedule = data?.schedule;
  const job = schedule?.lastJob;
  const jobActive = isEquipmentJobActive(job);

  async function runNow() {
    setAction('run');
    setActionError('');
    setNotice('');
    try {
      const result = await api.equipmentRun(token);
      onJob(result.job);
      setNotice('Auditoria iniciada. Acompanhe a execução no log do job.');
      await refresh({ silent: true });
    } catch (err) {
      if (err.status === 409 && err.data?.job) {
        onJob(err.data.job);
        setNotice('Já existe uma auditoria em andamento. O log dessa execução está disponível.');
        await refresh({ silent: true });
      } else {
        setActionError(err.message);
      }
    } finally {
      setAction('');
    }
  }

  async function toggleSchedule() {
    setAction('schedule');
    setActionError('');
    setNotice('');
    try {
      const enabled = !schedule.enabled;
      await api.equipmentSchedule(token, enabled);
      setNotice(enabled ? 'Agenda diária ativada para as 9h de Brasília na VPS.' : 'Agenda pausada. Você ainda pode executar a auditoria manualmente.');
      await refresh({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setAction('');
    }
  }

  async function saveReview(vehicle, review) {
    const result = await api.equipmentReview(token, { reviewKey: vehicle.reviewKey, ...review });
    setData((previous) => ({
      ...previous,
      reviews: { ...previous?.reviews, [vehicle.reviewKey]: result.review },
    }));
    setNotice(review.status === 'reviewed' ? `Revisão do veículo #${vehicle.id} registrada.` : `Pendência do veículo #${vehicle.id} reaberta.`);
    await refresh({ silent: true });
  }

  async function decideResearch(decision) {
    const result = await api.equipmentResearchDecision(token, decision);
    onJob(result.job);
    setNotice(`Decisão específica de #${decision.vehicleId} enviada para registro. Acompanhe o resultado no job.`);
    await refresh({ silent: true });
  }

  return (
    <section className="panel equipment-panel" aria-labelledby="equipment-title">
      <div className="equipment-header">
        <div>
          <p className="equipment-eyebrow">Conferência do estoque</p>
          <h2 id="equipment-title">Equipamentos</h2>
          <p className="equipment-muted">Comparação XML/API, fontes oficiais registradas e revisão específica por unidade.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => refresh()}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
          <button type="button" className="btn btn-primary" disabled={!data || busy || jobActive || Boolean(action)} onClick={runNow}>
            {action === 'run' ? 'Iniciando…' : jobActive ? 'Auditoria em andamento' : 'Executar agora'}
          </button>
        </div>
      </div>
      {loadError ? <div className="error-banner" role="alert">Não foi possível atualizar os equipamentos: {loadError}{data ? ' Os dados abaixo são da última consulta disponível.' : ''}</div> : null}
      {actionError ? <div className="error-banner" role="alert">{actionError}</div> : null}
      {notice ? <p className="equipment-notice" role="status">{notice}</p> : null}
      {schedule ? (
        <div className="equipment-schedule">
          <div>
            <div className="row">
              <strong>Diário às 9h · Brasília</strong>
              <span className={`pill ${schedule.enabled ? 'ok' : ''}`}>{schedule.enabled ? 'Agenda ativa' : 'Agenda pausada'}</span>
            </div>
            <p className="equipment-muted">Executado na VPS · America/Sao_Paulo</p>
            <p className="equipment-muted">{schedule.enabled ? `Próxima execução: ${formatDate(schedule.nextRun)} (Brasília).` : 'Sem próxima execução automática.'}</p>
          </div>
          <button type="button" className="btn btn-ghost" disabled={Boolean(action)} onClick={toggleSchedule}>
            {action === 'schedule' ? 'Salvando…' : schedule.enabled ? 'Pausar agenda' : 'Ativar agenda'}
          </button>
        </div>
      ) : null}
      {schedule?.error ? <div className="error-banner" role="alert">Agenda: {schedule.error}</div> : null}
      {data ? (
        <div className="equipment-run-status">
          <span>Último relatório concluído: <strong>{data.report ? formatDate(data.report.generatedAt) : 'nenhum'}</strong></span>
          <span>Última tentativa: <strong>{formatDate(schedule?.lastAttempt)}</strong></span>
          {job ? <span className={`pill ${job.status === 'failed' ? 'bad' : job.status === 'succeeded' ? 'ok' : ''}`}>{JOB_LABELS[job.status] || job.status}</span> : null}
          {job && (!busy || activeJob?.id === job.id) ? <a className="btn btn-ghost equipment-small-button" href="#job-log" onClick={() => { if (!busy) onJob(job); }}>Ver log</a> : null}
        </div>
      ) : null}
      {job?.status === 'failed' ? <div className="error-banner" role="alert">A última auditoria falhou. {job.error || 'Consulte o log para ver os detalhes.'} {data?.report ? 'O último relatório concluído foi preservado.' : ''}</div> : null}
      {data ? <EquipmentResearchPanel research={data.research} disabled={busy || jobActive || Boolean(action)} onDecision={decideResearch} /> : null}
      {!data ? <p className="equipment-empty" role="status">{loading ? 'Carregando agenda e relatório…' : 'O relatório não pôde ser carregado. Use “Atualizar” para tentar novamente.'}</p> : !data.report ? (
        <div className="equipment-empty">
          <strong>Nenhuma auditoria concluída ainda.</strong>
          <p>Use “Executar agora” para gerar o primeiro relatório ou ative a agenda diária. Novos cadastros e alterações ficam pendentes de revisão.</p>
        </div>
      ) : (
        <>
          <dl className="equipment-counts">
            <div><dt>Veículos</dt><dd>{counts.vehicles}</dd></div>
            <div><dt>Pendentes</dt><dd>{counts.pending}</dd></div>
            <div><dt>Revisados</dt><dd>{counts.reviewed}</dd></div>
            <div><dt>Com alertas</dt><dd>{counts.withAlerts}</dd></div>
          </dl>
          <div className="equipment-filters">
            <label>Buscar veículo
              <input type="search" value={query} maxLength={160} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Código, marca, modelo, ano ou motor" />
            </label>
            <label>Situação
              <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
                <option value="pending">Pendentes ({counts.pending})</option>
                <option value="all">Todos ({counts.vehicles})</option>
                <option value="reviewed">Revisados ({counts.reviewed})</option>
                <option value="alerts">Com alertas ({counts.withAlerts})</option>
                <option value="new">Novos nesta auditoria</option>
                <option value="changed">Alterados nesta auditoria</option>
              </select>
            </label>
          </div>
          <p className="equipment-muted equipment-result-count" role="status">
            {filtered.length} {filtered.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}. Novas alterações no cadastro ou nas regras exigem nova revisão.
          </p>
          {visible.length ? (
            <div className="equipment-vehicles">
              {visible.map((vehicle) => <EquipmentVehicle key={vehicle.reviewKey} vehicle={vehicle} review={reviews[vehicle.reviewKey]} onSave={saveReview} />)}
            </div>
          ) : <p className="equipment-empty">{counts.vehicles === 0 ? 'Nenhum veículo no cadastro consultado.' : filter === 'pending' && !query ? 'Nenhuma revisão pendente neste relatório. Use “Todos” para consultar os veículos.' : 'Nenhum veículo corresponde aos filtros.'}</p>}
          {pages > 1 ? (
            <nav className="equipment-pagination" aria-label="Páginas dos veículos">
              <button type="button" className="btn btn-ghost" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
              <span>Página {currentPage} de {pages}</span>
              <button type="button" className="btn btn-ghost" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
