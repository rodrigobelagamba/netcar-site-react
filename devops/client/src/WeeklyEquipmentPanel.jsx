const RESULT_LABELS = {
  passed: 'Corresponde ao cadastro', divergent: 'Diferenças encontradas', inconclusive: 'Não foi possível concluir',
};

function formatDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function PublicCheckReport({ report, partial = false }) {
  if (!report) return null;
  const vehicles = [...report.vehicles].sort((a, b) =>
    Number(a.status === 'passed') - Number(b.status === 'passed') || a.model.localeCompare(b.model, 'pt-BR'));
  return (
    <section className="equipment-descriptions" aria-label={partial ? 'Resultado parcial da conferência' : 'Última conferência completa'}>
      <h4>{partial ? 'Resultado parcial' : 'Última rodada completa'} · {formatDate(report.generatedAt)} (Brasília)</h4>
      {partial ? <p className="equipment-muted">Esta tentativa não conferiu todas as fichas. O resultado completo anterior permanece separado abaixo.</p> : null}
      <dl className="equipment-counts">
        <div><dt>Veículos</dt><dd>{report.counts.vehicles}</dd></div>
        <div><dt>Correspondem ao cadastro</dt><dd>{report.counts.passed}</dd></div>
        <div><dt>Com diferenças</dt><dd>{report.counts.divergent}</dd></div>
        <div><dt>Inconclusivos</dt><dd>{report.counts.inconclusive}</dd></div>
      </dl>
      <details>
        <summary>Ver resultados por veículo ({vehicles.length})</summary>
        <div className="equipment-vehicles">
          {vehicles.map((vehicle) => (
            <details className="equipment-vehicle" key={vehicle.vehicleId}>
              <summary>
                <span className="equipment-vehicle-heading">
                  <strong>{vehicle.model}</strong>
                  <span className="equipment-muted">#{vehicle.vehicleId}{vehicle.inventoryStatus === 'sold' ? ' · Vendido / página pública' : ''}</span>
                </span>
                <span className={`pill ${vehicle.status === 'passed' ? 'ok' : vehicle.status === 'divergent' ? 'bad' : 'warn'}`}>
                  {RESULT_LABELS[vehicle.status] || 'Conferir resultado'}
                </span>
              </summary>
              <div className="equipment-vehicle-body">
                <a href={`https://www.netcarmultimarcas.com.br/veiculo/${encodeURIComponent(vehicle.vehicleId)}`} target="_blank" rel="noopener noreferrer">
                  Abrir ficha do veículo #{vehicle.vehicleId} ↗
                </a>
                {vehicle.differences.length ? <ul>{vehicle.differences.map((difference, index) => <li key={index}>{difference}</li>)}</ul>
                  : <p className="equipment-muted">{vehicle.status === 'passed' ? 'A ficha corresponde às regras e ao cadastro consultados. Isso não comprova a presença física dos equipamentos.' : 'Confira o resultado da tentativa antes de concluir a revisão.'}</p>}
                {vehicle.verification ? <p className="equipment-muted">Verificação documental: {vehicle.verification.factoryConflicts} conflito(s) conhecido(s); {vehicle.verification.sensitiveReviewRequired} item(ns) sensível(is) aguardando conferência. Consulte a auditoria diária para os detalhes.</p> : null}
              </div>
            </details>
          ))}
        </div>
      </details>
    </section>
  );
}

export default function WeeklyEquipmentPanel({ publicCheck, enabled }) {
  const { state, report, partial, error } = publicCheck || {};
  const recentPartial = partial && (!report || Date.parse(partial.generatedAt) > Date.parse(report.generatedAt)) ? partial : null;
  return (
    <section className="equipment-research-queue" aria-labelledby="equipment-public-check-title">
      <h3 id="equipment-public-check-title">Conferência semanal do site</h3>
      <p className="equipment-muted">Segundas-feiras às 9h de Brasília, na VPS. Compara XML, cadastro, equipamentos e descrições das fichas públicas, incluindo vendidos. A verificação documental e as pendências de equipamentos são reavaliadas diariamente, em separado.</p>
      <p className="equipment-muted">{enabled
        ? state?.nextRun ? `Próxima conferência: ${formatDate(state.nextRun)} (Brasília).` : 'Primeira conferência pendente.'
        : 'Agenda pausada. Sem próxima conferência automática.'}</p>
      <p className="equipment-muted">“Executar agora” também refaz esta conferência. Diferenças ficam para revisão; a rotina não modifica o cadastro nem publica o site.</p>
      {state ? (
        <div className="equipment-run-status">
          <span>Última tentativa: <strong>{formatDate(state.lastAttempt)}</strong></span>
          <span>Última conclusão: <strong>{formatDate(state.lastSuccess)}</strong></span>
          <span className={`pill ${state.status === 'failed' ? 'bad' : state.status === 'running' ? 'warn' : ''}`}>
            {state.status === 'running' ? 'Em execução' : state.status === 'failed' ? 'Conferência incompleta' : 'Conferência concluída'}
          </span>
        </div>
      ) : null}
      {error ? <p className="error-banner" role="alert">{error}</p> : null}
      {state?.error ? <p className="error-banner" role="alert">{state.error}{report ? ' O último relatório completo foi preservado.' : ''}</p> : null}
      <PublicCheckReport report={recentPartial} partial />
      <PublicCheckReport report={report} />
      {!report && !recentPartial ? <p className="equipment-muted">Nenhum resultado disponível. Execute a conferência para verificar as fichas.</p> : null}
    </section>
  );
}
import React from 'react';

