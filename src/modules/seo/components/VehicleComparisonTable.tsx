import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowLeftRight,
  MessageCircle,
  Plus,
  X,
} from "lucide-react";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { trackCompareInteraction } from "@/lib/analytics";
import {
  comparisonVehicleLabel,
  comparisonWhatsAppMessage,
} from "@/lib/comparisonContact";
import { resolvedVehicleCategory } from "@/lib/vehicleCategory";
import { generateVehicleSlug } from "@/lib/slug";
import { buildWhatsAppUrl } from "@/lib/whatsappMessages";
import { ComparisonVehicleImage } from "./ComparisonVehicleImage";

export function comparisonPrice(vehicle: Vehicle) {
  const cleaned = vehicle.valor_formatado?.replace(/<[^>]*>/g, "").trim();
  return (
    cleaned ||
    (vehicle.price ? `R$ ${vehicle.price.toLocaleString("pt-BR")}` : "—")
  );
}

export const comparisonRows: { label: string; get: (v: Vehicle) => string }[] =
  [
    { label: "Ano", get: (v) => (v.year ? String(v.year) : "—") },
    { label: "Câmbio", get: (v) => v.cambio || "—" },
    { label: "Motor", get: (v) => v.motor || "—" },
    { label: "Combustível", get: (v) => v.combustivel || "—" },
    { label: "Potência", get: (v) => v.potencia || "—" },
    { label: "Portas", get: (v) => (v.portas ? String(v.portas) : "—") },
    { label: "Cor", get: (v) => v.cor || "—" },
    { label: "Categoria", get: (v) => resolvedVehicleCategory(v) || "—" },
  ];

export function comparisonValuesDiffer(values: string[]) {
  return (
    new Set(
      values.map((value) =>
        value
          .trim()
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
    ).size > 1
  );
}

export function VehicleComparisonTable({
  vehicles,
  onRemove,
  onAdd,
  whatsAppNumber,
  title,
}: {
  vehicles: Vehicle[];
  onRemove?: (id: string) => void;
  onAdd: () => void;
  whatsAppNumber?: string;
  title?: string;
}) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const hasPair = vehicles.length >= 2;
  const rows = comparisonRows.map((row) => ({
    ...row,
    differs: comparisonValuesDiffer(vehicles.map(row.get)),
  }));
  const visibleRows =
    hasPair && onlyDifferences ? rows.filter((row) => row.differs) : rows;
  const columns = Math.max(2, vehicles.length);
  const comparisonWhatsAppUrl = whatsAppNumber
    ? buildWhatsAppUrl(whatsAppNumber, comparisonWhatsAppMessage(vehicles))
    : undefined;
  const pricesDiffer = comparisonValuesDiffer(vehicles.map(comparisonPrice));
  const lowestPrice = Math.min(...vehicles.map((vehicle) => vehicle.price));

  return (
    <section className="comparison-board" aria-labelledby="comparison-title">
      <div className="comparison-board__heading">
        <div>
          <p className="comparison-eyebrow">Sua seleção</p>
          <h2 id="comparison-title">
            {title ||
              (hasPair
                ? `${vehicles.length} carros, lado a lado`
                : "Seu primeiro carro está aqui")}
          </h2>
        </div>
        {hasPair ? (
          <label className="comparison-differences">
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(event) => setOnlyDifferences(event.target.checked)}
            />
            Só diferenças
          </label>
        ) : (
          <span className="comparison-board__hint">
            Escolha mais um para comparar.
          </span>
        )}
      </div>
      <p className="comparison-swipe">
        <ArrowLeftRight size={15} aria-hidden="true" /> Deslize a tabela para
        ver todos os carros
      </p>
      <div
        className="comparison-scroll"
        tabIndex={0}
        role="region"
        aria-label="Fotos, preços e ficha dos carros selecionados"
      >
        <table
          className="comparison-table"
          data-columns={columns}
          style={{ "--comparison-columns": columns } as CSSProperties}
        >
          <caption className="sr-only">
            Comparativo de fotos, preços e ficha técnica dos seminovos
            selecionados
          </caption>
          <colgroup>
            <col className="comparison-label-column" />
            {Array.from({ length: columns }, (_, index) => (
              <col key={index} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th
                className="comparison-label-cell comparison-table__intro"
                scope="col"
              >
                <span>Ficha técnica</span>
              </th>
              {vehicles.map((vehicle, index) => (
                <th key={vehicle.id} scope="col" className="comparison-vehicle">
                  <div className="comparison-vehicle__top">
                    <span>Opção {String(index + 1).padStart(2, "0")}</span>
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove(vehicle.id)}
                        aria-label={`Remover ${comparisonVehicleLabel(vehicle)} do comparativo`}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="comparison-vehicle__body">
                    <div className="comparison-vehicle__photo">
                      <ComparisonVehicleImage
                        vehicle={vehicle}
                        priority
                        sizes="(max-width: 639px) 180px, (max-width: 1023px) 280px, 400px"
                      />
                    </div>
                    <div className="comparison-vehicle__info">
                      <p className="comparison-vehicle__brand">
                        {vehicle.marca}
                      </p>
                      <Link
                        className="comparison-vehicle__name"
                        to="/veiculo/$slug"
                        params={{ slug: generateVehicleSlug(vehicle) }}
                        onClick={() =>
                          trackCompareInteraction({
                            action: "view_details",
                            vehicleIds: [vehicle.id],
                            vehicleNames: [comparisonVehicleLabel(vehicle)],
                          })
                        }
                      >
                        {vehicle.modelo || vehicle.name}
                      </Link>
                      <p className="comparison-vehicle__year">
                        {vehicle.year || "Ano não informado"}{" "}
                        <span aria-hidden="true">·</span> Cód. {vehicle.id}
                      </p>
                      <p className="comparison-vehicle__price">
                        {comparisonPrice(vehicle)}
                      </p>
                      <p className="comparison-vehicle__price-note">
                        {hasPair &&
                        pricesDiffer &&
                        vehicle.price === lowestPrice
                          ? "Menor preço desta seleção"
                          : null}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
              {!hasPair && (
                <th scope="col" className="comparison-empty">
                  <button type="button" onClick={onAdd}>
                    <span className="comparison-empty__icon">
                      <Plus size={24} aria-hidden="true" />
                    </span>
                    <strong>Qual é a outra opção?</strong>
                    <span>Escolha mais um carro do estoque</span>
                    <span className="comparison-empty__link">
                      Adicionar carro{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </span>
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.label}
                className={
                  hasPair && row.differs ? "comparison-row--different" : ""
                }
              >
                <th scope="row" className="comparison-label-cell">
                  {row.label}
                  {hasPair && row.differs && (
                    <span
                      className="comparison-difference-dot"
                      title="Dados diferentes"
                    >
                      <span className="sr-only">: dados diferentes</span>
                    </span>
                  )}
                </th>
                {vehicles.map((vehicle) => (
                  <td key={vehicle.id}>{row.get(vehicle)}</td>
                ))}
                {!hasPair && <td className="comparison-empty-value">—</td>}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns + 1} className="comparison-identical">
                  Os dados desta ficha são iguais. Compare também as fotos e o
                  preço de cada unidade.
                </td>
              </tr>
            )}
            <tr className="comparison-actions-row">
              <th scope="row" className="comparison-label-cell">
                Saiba mais
              </th>
              {vehicles.map((vehicle) => (
                <td key={vehicle.id}>
                  <div className="comparison-vehicle__actions">
                    <Link
                      to="/veiculo/$slug"
                      params={{ slug: generateVehicleSlug(vehicle) }}
                      aria-label={`Ver este carro: ${comparisonVehicleLabel(vehicle)}`}
                      onClick={() =>
                        trackCompareInteraction({
                          action: "view_details",
                          vehicleIds: [vehicle.id],
                          vehicleNames: [comparisonVehicleLabel(vehicle)],
                        })
                      }
                      className="comparison-detail-link"
                    >
                      Ver este carro <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    {whatsAppNumber && (
                      <a
                        href={buildWhatsAppUrl(
                          whatsAppNumber,
                          comparisonWhatsAppMessage([vehicle]),
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Falar deste carro: ${comparisonVehicleLabel(vehicle)}`}
                        data-wa-source="comparison"
                        data-wa-intent="vehicle_inquiry"
                        data-wa-vehicle-id={vehicle.id}
                        data-wa-vehicle-name={comparisonVehicleLabel(vehicle)}
                        onClick={() =>
                          trackCompareInteraction({
                            action: "whatsapp",
                            vehicleIds: [vehicle.id],
                            vehicleNames: [comparisonVehicleLabel(vehicle)],
                          })
                        }
                        className="comparison-inquiry-link"
                      >
                        <MessageCircle size={15} aria-hidden="true" /> Falar
                        deste carro
                      </a>
                    )}
                  </div>
                </td>
              ))}
              {!hasPair && <td />}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="comparison-board__footer">
        <span>
          <i className="comparison-difference-dot" aria-hidden="true" /> Linhas
          destacadas indicam diferenças
        </span>
        <span>Dados do anúncio. Confirme os detalhes com a equipe.</span>
      </div>
      {hasPair && (
        <div className="comparison-help">
          <div>
            <h3>Ficou entre essas opções?</h3>
            <p>
              A equipe ajuda a comparar. A mensagem leva os carros que você
              escolheu.
            </p>
          </div>
          {comparisonWhatsAppUrl ? (
            <a
              href={comparisonWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="comparison"
              data-wa-intent="comparison_help"
              onClick={() =>
                trackCompareInteraction({
                  action: "whatsapp",
                  vehicleIds: vehicles.map((vehicle) => vehicle.id),
                  vehicleNames: vehicles.map(comparisonVehicleLabel),
                })
              }
            >
              <MessageCircle size={18} aria-hidden="true" /> Quero ajuda para
              escolher
            </a>
          ) : (
            <Link to="/contato">
              Ver formas de contato <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
