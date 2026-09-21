import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  Image as Images,
  Sparkles,
  ScanFace,
  X,
} from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { optimizeStockImage, stockImageSrcSet } from "@/lib/images";
import {
  deliveries,
  deliveryCardCrop,
  filterDeliveries,
  mergePublishedDeliveries,
  parsePublishedDeliveries,
  resolveDeliveryId,
  type Delivery,
} from "../lib/deliveries";
import { DeliveryViewer } from "../components/DeliveryViewer";
import cardCropData from "../data/delivery-card-crops.json";
import "./entregas.css";

const cardCrops: Readonly<Record<string, readonly number[]>> = cardCropData;

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const BATCH_SIZE = 24;
const HERO_HIGHLIGHTS: {
  id: string;
  caption?: string;
  imagePosition?: string;
}[] = [
  { id: "mkt-f70fefc7", caption: "Histórias reais" },
  {
    id: "instagram-43c91a37b90fb585124bab7e",
    caption: "Mais uma conquista",
    imagePosition: "center 30%",
  },
  { id: "mkt-ed106e87", caption: "Sonho realizado" },
];
const featured = HERO_HIGHLIGHTS.flatMap((highlight) => {
  const item = deliveries.find((delivery) => delivery.id === highlight.id);
  return item
    ? [
        {
          item: {
            ...item,
            imagePosition: highlight.imagePosition || item.imagePosition,
          },
          caption: highlight.caption,
        },
      ]
    : [];
});

function monthLabel(item: Delivery) {
  if (!item.year || !item.month) return "Acervo Netcar";
  return `${MONTHS[Number(item.month) - 1]} ${item.year}`;
}

function readPhotoId() {
  return resolveDeliveryId(
    new URLSearchParams(window.location.hash.slice(1)).get("foto"),
  );
}

function DeliveryPhoto({
  item,
  eager = false,
  className = "",
  crop,
}: {
  item: Delivery;
  eager?: boolean;
  className?: string;
  crop?: readonly number[];
}) {
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState(false);
  return failed ? (
    <span className={`entregas-photo-fallback ${className}`}>
      <Images size={28} />
      <span>Foto indisponível no acervo</span>
    </span>
  ) : (
    <img
      className={`${className}${crop ? " entregas-photo-crop" : ""}`}
      style={
        crop
          ? {
              width: `${100 / crop[2]}%`,
              height: `${100 / crop[3]}%`,
              left: `${(-100 * crop[0]) / crop[2]}%`,
              top: `${(-100 * crop[1]) / crop[3]}%`,
            }
          : item.imagePosition
            ? { objectPosition: item.imagePosition }
            : undefined
      }
      src={
        original
          ? item.imageUrl
          : item.previewImageUrl || optimizeStockImage(item.imageUrl, 640)
      }
      srcSet={
        original
          ? undefined
          : item.previewSrcSet ||
            stockImageSrcSet(item.imageUrl, [320, 480, 640, 960])
      }
      sizes={
        crop
          ? `(max-width: 700px) ${Math.ceil(48 / crop[2])}vw, (max-width: 1100px) ${Math.ceil(32 / crop[2])}vw, ${Math.ceil(410 / crop[2])}px`
          : "(max-width: 700px) 48vw, (max-width: 1100px) 32vw, 410px"
      }
      alt={
        item.name
          ? `Registro de ${item.name} na Netcar`
          : `Entrega de carro na Netcar${item.year && item.month ? ` — ${monthLabel(item)}` : ""}`
      }
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => (original ? setFailed(true) : setOriginal(true))}
    />
  );
}

export function EntregasPage() {
  const navigate = useNavigate();
  const locationSearch = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const [page, setPage] = useState(() => {
    const value =
      new URLSearchParams(window.location.search).get("pagina") || "1";
    return /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
  });
  const [allDeliveries, setAllDeliveries] = useState(deliveries);
  const [feedFailed, setFeedFailed] = useState(false);
  const [feedAttempt, setFeedAttempt] = useState(0);
  useDefaultMetaTags(
    page > 1
      ? `Entregas de carros e clientes | Esteio/RS — Página ${page}`
      : "Entregas de carros e clientes | Esteio/RS",
    "Conheça as entregas de carros da Netcar Multimarcas em Esteio/RS. Explore as fotos por mês e ano, reveja sua entrega e compartilhe esse momento." +
      (page > 1 ? ` Página ${page} do histórico.` : ""),
    {
      canonicalPath: page > 1 ? `/entregas?pagina=${page}` : "/entregas",
      imagePath: "/entregas-media/mkt-f70fefc7.webp",
    },
  );
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [layout, setLayout] = useState<"pessoas" | "inteira">("pessoas");
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [activeId, setActiveId] = useState<string | null>(readPhotoId);
  const yearRef = useRef<HTMLSelectElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          allDeliveries
            .map((item) => item.year)
            .filter((value): value is string => Boolean(value)),
        ),
      )
        .sort()
        .reverse(),
    [allDeliveries],
  );
  const matches = useMemo(
    () => filterDeliveries(allDeliveries, { year, month }),
    [allDeliveries, year, month],
  );
  const pageStart = (page - 1) * BATCH_SIZE;
  const displayed = matches.slice(pageStart, pageStart + visibleCount);
  const hasFilters = Boolean(year || month);
  const activePhoto = activeId
    ? allDeliveries.find((item) => item.id === activeId)
    : undefined;
  const viewerItems =
    activePhoto && !matches.some((item) => item.id === activeId)
      ? allDeliveries
      : matches;

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const updateFeed = () => {
      attempts += 1;
      void fetch("/entregas/v1/feed.php", {
        signal: controller.signal,
        cache: "no-cache",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("feed unavailable");
          const feed = await response.json();
          setAllDeliveries(
            mergePublishedDeliveries(
              deliveries,
              parsePublishedDeliveries(feed.deliveries),
            ),
          );
          setFeedFailed(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          if (attempts < 3) {
            retryTimer = setTimeout(updateFeed, attempts * 1500);
          } else {
            setFeedFailed(true);
          }
        });
    };
    updateFeed();
    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [feedAttempt]);

  useEffect(() => {
    const refreshWhenOnline = () => setFeedAttempt((attempt) => attempt + 1);
    window.addEventListener("online", refreshWhenOnline);
    return () => window.removeEventListener("online", refreshWhenOnline);
  }, []);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [year, month]);

  useEffect(() => {
    const value = new URLSearchParams(locationSearch).get("pagina") || "1";
    setPage(/^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1);
    setVisibleCount(BATCH_SIZE);
  }, [locationSearch]);

  useEffect(() => {
    const readHash = () => setActiveId(readPhotoId());
    window.addEventListener("hashchange", readHash);
    window.addEventListener("popstate", readHash);
    return () => {
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("popstate", readHash);
    };
  }, []);

  const openPhoto = (id: string) => {
    setActiveId(id);
    // Only an opaque record ID goes in a shareable URL. Filters stay in memory.
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}#foto=${encodeURIComponent(id)}`,
    );
  };
  const closePhoto = () => {
    setActiveId(null);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  };
  const reset = () => {
    setYear("");
    setMonth("");
    resetPage();
  };
  const resetPage = () => {
    setPage(1);
    setVisibleCount(BATCH_SIZE);
    void navigate({ to: "/entregas", replace: true, resetScroll: false });
  };
  const exploreDeliveries = () => {
    resultRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    yearRef.current?.focus({ preventScroll: true });
  };

  return (
    <main className="entregas-page">
      <div className="entregas-topline entregas-container">
        <div>
          <a href="/">Início</a>
          <span>/</span>
          <span>Entregas</span>
        </div>
        <span className="entregas-preview-badge">
          Memórias de quem escolheu a Netcar
        </span>
      </div>

      <section
        className="entregas-hero entregas-container"
        aria-labelledby="entregas-title"
      >
        <div className="entregas-hero-copy">
          <p className="entregas-eyebrow">
            <span /> PESSOAS REAIS. CONQUISTAS REAIS.
          </p>
          <h1 id="entregas-title">
            O carro muda.
            <br />A <span>história</span> fica.
          </h1>
          <p className="entregas-hero-description">
            A primeira chave. A troca tão esperada. O começo de um novo caminho.
            Aqui, cada foto tem uma história — e a sua pode estar entre elas.
          </p>
          <button
            type="button"
            className="entregas-primary"
            onClick={exploreDeliveries}
          >
            <Images size={18} /> Explorar entregas <ArrowDown size={18} />
          </button>
          <div className="entregas-hero-footnote">
            <span className="entregas-people-icons" aria-hidden="true">
              <Heart size={15} />
              <Check size={15} />
              <Sparkles size={15} />
            </span>
            <span>Momentos que fazem parte da Netcar.</span>
          </div>
        </div>
        <div className="entregas-hero-collage" aria-label="Destaques do acervo">
          <div className="entregas-orbit" aria-hidden="true" />
          <span className="entregas-collage-plus" aria-hidden="true">
            ✳
          </span>
          {featured.map(({ item, caption }, index) => (
            <button
              key={item.id}
              type="button"
              className={`entregas-polaroid entregas-polaroid-${index}`}
              onClick={() => openPhoto(item.id)}
              aria-label={`Ver foto: ${caption || item.name || "Entrega Netcar"}. ${monthLabel(item)}`}
            >
              <DeliveryPhoto item={item} eager />
              <span className="entregas-polaroid-caption">
                <span>{caption || item.name || monthLabel(item)}</span>
                <Heart size={15} />
              </span>
            </button>
          ))}
          <span className="entregas-collage-stamp">
            <Check size={15} /> Novos caminhos começam aqui.
          </span>
        </div>
      </section>

      <div className="entregas-marquee" aria-hidden="true">
        <div>
          UMA CHAVE <span>✳</span> UM SORRISO <span>✳</span> UM NOVO COMEÇO{" "}
          <span>✳</span> UMA HISTÓRIA NETCAR <span>✳</span> UMA CHAVE{" "}
          <span>✳</span> UM SORRISO <span>✳</span> UM NOVO COMEÇO
        </div>
      </div>

      <section
        className="entregas-gallery-section entregas-container"
        aria-labelledby="entregas-gallery-title"
        ref={resultRef}
      >
        <div className="entregas-section-heading">
          <div>
            <p className="entregas-eyebrow">NOSSO ÁLBUM, SUA HISTÓRIA</p>
            <h2 id="entregas-gallery-title">Cada entrega, uma história.</h2>
          </div>
          <p>
            Escolha o mês e o ano.
            <br />
            <span>Reveja e compartilhe esses momentos.</span>
          </p>
        </div>

        <div
          className="entregas-period-panel"
          role="group"
          aria-labelledby="entregas-period-title"
        >
          <div className="entregas-period-heading">
            <CalendarDays size={22} aria-hidden="true" />
            <div>
              <h3 id="entregas-period-title">Encontre sua foto</h3>
              <p id="entregas-period-instructions">
                Escolha o ano e o mês do registro.
              </p>
            </div>
          </div>
          <div className="entregas-date-filters">
            <label>
              <span>Ano</span>
              <select
                ref={yearRef}
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  resetPage();
                }}
                aria-label="Ano do registro"
                aria-describedby="entregas-period-instructions"
              >
                <option value="">Todos os anos</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} aria-hidden="true" />
            </label>
            <label>
              <span>Mês</span>
              <select
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value);
                  resetPage();
                }}
                aria-label="Mês do registro"
                aria-describedby="entregas-period-instructions"
              >
                <option value="">Todos os meses</option>
                {MONTHS.map((item, index) => (
                  <option key={item} value={String(index + 1).padStart(2, "0")}>
                    {item}
                  </option>
                ))}
              </select>
              <ChevronDown size={20} aria-hidden="true" />
            </label>
          </div>
          <p className="entregas-filter-help">
            <Check size={16} aria-hidden="true" />
            As fotos aparecem logo abaixo conforme sua seleção.
          </p>
        </div>

        <div className="entregas-results-bar">
          <p aria-live="polite" aria-atomic="true">
            <strong>{matches.length.toLocaleString("pt-BR")}</strong>{" "}
            {hasFilters
              ? matches.length === 1
                ? "foto neste período"
                : "fotos neste período"
              : "fotos no acervo"}
            {hasFilters && (
              <button type="button" onClick={reset}>
                Limpar filtros <X size={13} />
              </button>
            )}
          </p>
          <div
            className="entregas-layout-options"
            aria-label="Visualização da galeria"
          >
            <button
              type="button"
              aria-pressed={layout === "pessoas"}
              aria-label="Ver mais perto das pessoas"
              onClick={() => setLayout("pessoas")}
            >
              <ScanFace size={16} />
              <span>Mais perto</span>
            </button>
            <button
              type="button"
              aria-pressed={layout === "inteira"}
              aria-label="Ver fotos inteiras"
              onClick={() => setLayout("inteira")}
            >
              <Images size={16} />
              <span>Foto inteira</span>
            </button>
          </div>
        </div>

        {feedFailed && (
          <p className="entregas-feed-notice" role="status">
            Não foi possível atualizar as fotos mais recentes.{" "}
            <button
              type="button"
              onClick={() => setFeedAttempt((attempt) => attempt + 1)}
            >
              Tentar novamente
            </button>
          </p>
        )}
        {page > 1 && (
          <p className="entregas-archive-note">
            <a href={page === 2 ? "/entregas" : `/entregas?pagina=${page - 1}`}>
              ← Página anterior
            </a>
            {" · "}
            <a href="/entregas">Voltar às entregas mais recentes</a>
          </p>
        )}

        {displayed.length > 0 ? (
          <div className={`entregas-grid entregas-grid-${layout}`}>
            {displayed.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="entregas-card"
                onClick={() => openPhoto(item.id)}
                aria-label={`Abrir foto: ${item.name || "Entrega Netcar"}. ${monthLabel(item)}`}
              >
                <div className="entregas-card-photo">
                  <span className="entregas-card-frame">
                    <DeliveryPhoto
                      item={item}
                      eager={index < 3}
                      crop={
                        layout === "pessoas"
                          ? deliveryCardCrop(item, cardCrops)
                          : undefined
                      }
                      className={
                        !deliveryCardCrop(item, cardCrops)
                          ? "entregas-photo-uncropped"
                          : ""
                      }
                    />
                  </span>
                  <span className="entregas-card-open">
                    <ArrowUpRight size={18} />
                  </span>
                  <span className="entregas-card-photo-label">
                    <Images size={13} /> Ver esse momento
                  </span>
                </div>
                <div className="entregas-card-copy">
                  <div>
                    <h3>{item.name || "Uma nova conquista"}</h3>
                    <p>{monthLabel(item)}</p>
                  </div>
                  <Heart size={17} aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="entregas-empty">
            <span>
              <CalendarDays size={30} />
            </span>
            <h3>Ainda não há fotos neste período.</h3>
            <p>
              Escolha outro mês ou ano para continuar explorando as entregas.
            </p>
            <button type="button" className="entregas-primary" onClick={reset}>
              Ver todo o acervo <ArrowRight size={17} />
            </button>
          </div>
        )}

        {displayed.length > 0 && (
          <div className="entregas-load-more">
            <p>
              {page > 1 ? `${pageStart + 1}–` : ""}
              {Math.min(
                pageStart + visibleCount,
                matches.length,
              ).toLocaleString("pt-BR")}{" "}
              de {matches.length.toLocaleString("pt-BR")} momentos
            </p>
            <div className="entregas-progress" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, ((pageStart + visibleCount) / matches.length) * 100)}%`,
                }}
              />
            </div>
            {hasFilters && pageStart + visibleCount < matches.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + BATCH_SIZE)}
              >
                Ver mais momentos <ArrowDown size={17} />
              </button>
            )}
            {!hasFilters && pageStart + visibleCount < matches.length && (
              <a
                href={`/entregas?pagina=${page + visibleCount / BATCH_SIZE}`}
                onClick={(event) => {
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  setVisibleCount((count) => count + BATCH_SIZE);
                }}
              >
                Ver mais momentos <ArrowDown size={17} />
              </a>
            )}
          </div>
        )}
        <p className="entregas-archive-note">
          Registros do acervo, da foto mais recente à mais antiga. Os períodos
          se referem à data de cadastro ou publicação da foto.
        </p>
      </section>

      <section
        className="entregas-next-chapter entregas-container"
        aria-labelledby="entregas-next-title"
      >
        <div className="entregas-next-symbol" aria-hidden="true">
          <ArrowUpRight />
        </div>
        <div>
          <p className="entregas-eyebrow">O PRÓXIMO CAPÍTULO</p>
          <h2 id="entregas-next-title">
            Seu próximo sorriso
            <br />
            pode começar aqui.
          </h2>
          <p>Encontre o carro que combina com a sua história.</p>
        </div>
        <a href="/seminovos" className="entregas-primary">
          Explorar o estoque <ArrowUpRight size={18} />
        </a>
      </section>

      {activePhoto && (
        <DeliveryViewer
          items={viewerItems}
          activeId={activePhoto.id}
          focusCrop={deliveryCardCrop(activePhoto, cardCrops)}
          onClose={closePhoto}
          onChange={openPhoto}
        />
      )}
    </main>
  );
}
