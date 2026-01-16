import { motion } from "framer-motion";
import { useAboutTextQuery, useCountersQuery, useBannersQuery } from "@/api/queries/useSiteQuery";
import { useBannersLoja1Query, useBannersLoja2Query, useAddressQuery, usePhoneQuery, useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";

export function SobrePage() {
  // Busca dados da API
  const { data: essencia } = useAboutTextQuery("Essência");
  const { data: counters } = useCountersQuery("Sobre");
  const { data: banners } = useBannersQuery();
  const { data: bannersLoja1 } = useBannersLoja1Query();
  const { data: bannersLoja2 } = useBannersLoja2Query();
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: historia } = useAboutTextQuery("História");
  const { data: valores } = useAboutTextQuery("Valores");

  useDefaultMetaTags(
    "Sobre Nós",
    "Desde 1997, a Netcar seleciona carros com histórico, qualidade e transparência. Conheça nossa história e valores."
  );

  // Imagem da essência (primeiro banner ou fallback)
  const essenciaImage = banners?.[0]?.imagem || "/images/loja1.jpg";
  
  // Imagem da fachada para cada loja
  const getFachadaImage = (banners?: Array<{ titulo?: string; imagem: string }>) => {
    if (!banners || banners.length === 0) return "";
    const fachada = banners.find(b => b.titulo?.toLowerCase() === "fachada");
    return fachada?.imagem || banners[0]?.imagem || "";
  };

  const loja1Image = getFachadaImage(bannersLoja1) || "/images/loja1.jpg";
  const loja2Image = getFachadaImage(bannersLoja2) || "/images/loja2.jpg";
  const loja1DetailImage = bannersLoja1?.[1]?.imagem || loja1Image;
  const loja2DetailImage = bannersLoja2?.[1]?.imagem || loja2Image;

  // Formata endereço
  const formatAddress = (address?: { endereco?: string; cidade?: string; estado?: string }) => {
    if (!address) return "";
    const parts = [address.endereco, address.cidade, address.estado].filter(Boolean);
    return parts.join(", ");
  };

  // Formata telefone
  const formatPhone = (phone?: { telefone?: string }) => {
    if (!phone?.telefone) return "";
    return phone.telefone;
  };

  // Timeline items (pode vir da API ou ser estático)
  const timelineItems = [
    { year: "1997", title: "Início em Esteio", description: "Nasce a Netcar com foco em confiança e relacionamento." },
    { year: "2010", title: "Curadoria reforçada", description: "Processos de avaliação e seleção ganham rigor e padronização." },
    { year: "2018", title: "Fábrica de Valor", description: "Preparo técnico estruturado para entrega de qualidade." },
    { year: "2024", title: "Segunda loja", description: "Expansão do showroom e atendimento em dois endereços." },
  ];

  // Valores (pode vir da API ou ser estático)
  const valoresList = valores?.conteudo ? [] : [
    { title: "Transparência", description: "Informação clara em cada etapa da compra." },
    { title: "Procedência", description: "Histórico e documentação verificados." },
    { title: "Experiência", description: "Desde 1997 no mercado de seminovos." },
  ];

  // Equipe (mock - pode vir da API futuramente)
  const team = [
    { name: "Marcelo Marchis", role: "Gestão & Relacionamento" },
    { name: "Gilnei", role: "Consultor Comercial" },
    { name: "Bruno", role: "Consultor Comercial" },
    { name: "Tiago", role: "Consultor Comercial" },
  ];

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <header className="relative py-20 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-primary text-xs font-semibold tracking-widest uppercase mb-2">
            Sobre a Netcar
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-[52px] font-bold leading-tight mb-4 transition-colors hover:text-primary">
            Desde 1997, curadoria e procedência em seminovos.
          </h1>
          <p className="max-w-[760px] mx-auto text-muted-foreground text-base md:text-lg">
            Há quase três décadas selecionando carros com histórico, qualidade e transparência. Nosso foco é um <strong>estoque qualificado</strong>, com procedência do RS, checklist técnico e entrega sem surpresa.
          </p>
        </div>
      </header>

      {/* Nossa essência */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-7 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="bg-surface border border-border rounded-[24px] p-6 md:p-9 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <h2 className="text-2xl md:text-[28px] font-bold mb-2">Nossa essência</h2>
              <p className="text-muted-foreground mb-4">
                {essencia?.conteudo || "Selecionamos cada veículo com critérios objetivos de quilometragem, histórico e procedência. O preparo e a transparência fazem parte do processo, para você comprar certo."}
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Curadoria de estoque com <strong>procedência comprovada</strong></li>
                <li>Checklist técnico e histórico de manutenção</li>
                <li>Laudos e documentação quando aplicável</li>
                <li>Atendimento próximo e experiente</li>
              </ul>
            </motion.div>
            <motion.figure
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative h-[320px] rounded-[20px] overflow-hidden border border-border"
            >
              <img
                src={essenciaImage}
                alt="Showroom da Netcar"
                className="w-full h-full object-cover transition-transform hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = "/images/loja1.jpg";
                }}
              />
            </motion.figure>
          </div>
        </div>
      </section>

      {/* Nossos números */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="bg-surface border border-border rounded-[24px] p-6 md:p-9 shadow-sm"
          >
            <h2 className="text-2xl md:text-[26px] font-bold mb-1">Nossos números</h2>
            <p className="text-muted-foreground mb-5">Resultados consistentes construídos com relacionamento e transparência.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-7">
              {counters && counters.length > 0 ? (
                counters.slice(0, 4).map((counter, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="bg-surface border border-border rounded-[20px] p-7 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-1 hover:scale-[1.01]"
                  >
                    <div className="text-3xl md:text-4xl lg:text-[40px] font-bold mb-2">
                      {counter.valor.toLocaleString("pt-BR")}
                    </div>
                    <div className="text-muted-foreground text-sm">{counter.titulo}</div>
                  </motion.div>
                ))
              ) : (
                <>
                  <div className="bg-surface border border-border rounded-[20px] p-7 text-center shadow-sm">
                    <div className="text-3xl md:text-4xl lg:text-[40px] font-bold mb-2">1997</div>
                    <div className="text-muted-foreground text-sm">Desde</div>
                  </div>
                  <div className="bg-surface border border-border rounded-[20px] p-7 text-center shadow-sm">
                    <div className="text-3xl md:text-4xl lg:text-[40px] font-bold mb-2">+2.500</div>
                    <div className="text-muted-foreground text-sm">Clientes atendidos</div>
                  </div>
                  <div className="bg-surface border border-border rounded-[20px] p-7 text-center shadow-sm">
                    <div className="text-3xl md:text-4xl lg:text-[40px] font-bold mb-2">2</div>
                    <div className="text-muted-foreground text-sm">Lojas em Esteio/RS</div>
                  </div>
                  <div className="bg-surface border border-border rounded-[20px] p-7 text-center shadow-sm">
                    <div className="text-3xl md:text-4xl lg:text-[40px] font-bold mb-2">100%</div>
                    <div className="text-muted-foreground text-sm">Estoque com procedência</div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Nossas lojas */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-2xl md:text-[26px] font-bold mb-4">Nossas lojas</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Loja 1 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative bg-surface border border-border rounded-[20px] p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 overflow-visible"
            >
              <div className="relative rounded-[14px] overflow-hidden h-[260px] mb-4">
                <img
                  src={loja1Image}
                  alt="Fachada da Loja 1"
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja1.jpg";
                  }}
                />
              </div>
              <div className="hidden lg:block absolute top-[-50px] right-6 w-[42%] max-w-[200px] h-[160px] rounded-[18px] overflow-hidden border border-border shadow-sm transition-transform hover:-translate-y-1 hover:scale-105">
                <img
                  src={loja1DetailImage}
                  alt="Detalhe da Loja 1"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = loja1Image;
                  }}
                />
              </div>
              <div className="mt-4 space-y-1">
                <h3 className="text-lg font-semibold">Loja 1 — Centro, Esteio/RS</h3>
                <p className="text-muted-foreground text-sm">
                  {formatAddress(addressLoja1) || "Av. Presidente Vargas, 740"} — {formatPhone(phoneLoja1) || "(51) 3473‑7900"}
                </p>
                <p className="text-muted-foreground text-sm">Showroom amplo, atendimento personalizado e test‑drive.</p>
              </div>
            </motion.article>

            {/* Loja 2 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative bg-surface border border-border rounded-[20px] p-6 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 overflow-visible"
            >
              <div className="relative rounded-[14px] overflow-hidden h-[260px] mb-4">
                <img
                  src={loja2Image}
                  alt="Fachada da Loja 2"
                  className="w-full h-full object-cover transition-transform hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja2.jpg";
                  }}
                />
              </div>
              <div className="hidden lg:block absolute top-[-50px] right-6 w-[42%] max-w-[200px] h-[160px] rounded-[18px] overflow-hidden border border-border shadow-sm transition-transform hover:-translate-y-1 hover:scale-105">
                <img
                  src={loja2DetailImage}
                  alt="Detalhe da Loja 2"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = loja2Image;
                  }}
                />
              </div>
              <div className="mt-4 space-y-1">
                <h3 className="text-lg font-semibold">Loja 2 — Centro, Esteio/RS</h3>
                <p className="text-muted-foreground text-sm">
                  {formatAddress(addressLoja2) || "Av. Presidente Vargas, 1106"} — {formatPhone(phoneLoja2) || "(51) 3033‑3900"}
                </p>
                <p className="text-muted-foreground text-sm">Seleção de seminovos e condições especiais de financiamento.</p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Linha do tempo + Valores */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
            {/* Nossa história */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="bg-surface border border-border rounded-[24px] p-6 md:p-9 shadow-sm"
            >
              <h2 className="text-2xl md:text-[26px] font-bold mb-2">Nossa história</h2>
              {historia?.conteudo ? (
                <div
                  className="text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: historia.conteudo }}
                />
              ) : (
                <div className="relative pl-6">
                  <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-gradient-to-b from-primary to-transparent opacity-40" />
                  {timelineItems.map((item, index) => (
                    <div key={index} className="relative pl-4 pb-4 transition-transform hover:translate-x-1">
                      <div className="absolute left-[-2px] top-5 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_0_5px_rgba(31,111,235,0.1)]" />
                      <h4 className="font-semibold mb-1">{item.year} — {item.title}</h4>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Nossos valores */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="bg-surface border border-border rounded-[24px] p-6 md:p-9 shadow-sm"
            >
              <h2 className="text-2xl md:text-[26px] font-bold mb-2">Nossos valores</h2>
              {valores?.conteudo ? (
                <div
                  className="text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: valores.conteudo }}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {valoresList.map((valor, index) => (
                    <div
                      key={index}
                      className="bg-surface border border-border rounded-[20px] p-6 transition-all hover:border-primary/35 hover:bg-gradient-to-b hover:from-surface hover:to-surface-alt hover:-translate-y-1"
                    >
                      <h4 className="font-semibold mb-1">{valor.title}</h4>
                      <p className="text-muted-foreground text-sm">{valor.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-2xl md:text-[26px] font-bold mb-2">Nossa equipe</h2>
          <p className="text-muted-foreground mb-5">Profissionais que somam experiência, cuidado e atenção a cada detalhe.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {team.map((person, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex flex-col items-center gap-2.5 p-5 border border-border rounded-[20px] bg-surface transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="w-20 h-20 rounded-full bg-muted border border-border transition-all hover:shadow-[0_0_0_6px_rgba(31,111,235,0.1)] hover:scale-105" />
                <h5 className="font-semibold text-center">{person.name}</h5>
                <p className="text-muted-foreground text-sm text-center">{person.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Estoque */}
      <section className="py-14">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative bg-gradient-to-br from-surface via-surface to-surface-alt border border-border rounded-[28px] text-center p-12 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-[400px] h-[200px] bg-primary/12 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-primary/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Quer ver nosso estoque qualificado?</h3>
              <p className="text-muted-foreground mb-6">Fale com a equipe ou explore as ofertas atualizadas nas duas lojas.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  to="/seminovos"
                  search={{
                    marca: undefined,
                    modelo: undefined,
                    precoMin: undefined,
                    precoMax: undefined,
                    anoMin: undefined,
                    anoMax: undefined,
                  }}
                  className={cn(
                    "px-5 py-3.5 rounded-[14px] font-semibold tracking-wide",
                    "bg-fg text-white shadow-md transition-all",
                    "hover:-translate-y-0.5 hover:shadow-lg hover:bg-primary"
                  )}
                >
                  Ver estoque
                </Link>
                {whatsapp?.link && (
                  <a
                    href={whatsapp.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "px-5 py-3.5 rounded-[14px] font-semibold tracking-wide",
                      "bg-muted text-fg border border-border transition-all",
                      "hover:-translate-y-0.5 hover:bg-fg hover:text-white"
                    )}
                  >
                    Chamar no WhatsApp
                  </a>
                )}
                {phoneLoja1?.telefone && (
                  <a
                    href={`tel:${phoneLoja1.telefone.replace(/\D/g, "")}`}
                    className={cn(
                      "px-5 py-3.5 rounded-[14px] font-semibold tracking-wide",
                      "bg-muted text-fg border border-border transition-all",
                      "hover:-translate-y-0.5 hover:bg-fg hover:text-white"
                    )}
                  >
                    Loja 1
                  </a>
                )}
                {phoneLoja2?.telefone && (
                  <a
                    href={`tel:${phoneLoja2.telefone.replace(/\D/g, "")}`}
                    className={cn(
                      "px-5 py-3.5 rounded-[14px] font-semibold tracking-wide",
                      "bg-muted text-fg border border-border transition-all",
                      "hover:-translate-y-0.5 hover:bg-fg hover:text-white"
                    )}
                  >
                    Loja 2
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
