import { motion } from "framer-motion";
import { useAboutTextQuery, useCountersQuery } from "@/api/queries/useSiteQuery";
import { useBannersLoja1Query, useBannersLoja2Query, useAddressQuery, usePhoneQuery, useWhatsAppQuery } from "@/api/queries/useSiteQuery";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { CheckCircle2, Shield, Award } from "lucide-react";

export function SobrePage() {
  // Busca dados da API
  const { data: essencia } = useAboutTextQuery("Essência");
  const { data: counters } = useCountersQuery("Sobre");
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
  
  // Imagem da fachada para cada loja
  const getFachadaImage = (banners?: Array<{ titulo?: string; imagem: string }>) => {
    if (!banners || banners.length === 0) return "";
    const fachada = banners.find(b => b.titulo?.toLowerCase() === "fachada");
    return fachada?.imagem || banners[0]?.imagem || "";
  };

  const loja1Image = getFachadaImage(bannersLoja1) || "/images/loja1.jpg";
  const loja2Image = getFachadaImage(bannersLoja2) || "/images/loja2.jpg";

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

  // Equipe organizada por setor
  const teamBySector = [
    {
      sector: "Gestão & Administração",
      members: [
        { name: "Cristiano", role: "Gestão", image: "/team/cristiano.jpg" },
        { name: "Marcelo", role: "Administração & TI", image: "/team/marcelo.jpg" },
        { name: "Shirley", role: "Financeiro & RH", image: "/team/shirley.png" },
      ]
    },
    {
      sector: "Comercial",
      members: [
        { name: "Carlos", role: "Consultor", image: "/team/carlos.jpg" },
        { name: "Filipe", role: "Consultor", image: "/team/filipe.jpg" },
        { name: "Tiago", role: "Consultor", image: "/team/tiago.jpg" },
        { name: "Bruno", role: "Consultor", image: "/team/bruno.jpg" },
        { name: "Gilnei", role: "Consultor", image: "/team/gilnei.jpg" },
      ]
    },
    {
      sector: "Manutenção & Preparação",
      members: [
        { name: "Juliano", role: "Preparação", image: "/team/juliano.jpg" },
        { name: "Herick", role: "Preparação", image: "/team/herick.jpg" },
        { name: "Claudio", role: "Preparação", image: "/team/claudio.jpg" },
      ]
    },
  ];

  return (
    <main className="flex-1 overflow-x-hidden max-w-full bg-gradient-to-b from-white via-gray-50/50 to-white">
      {/* Hero Section */}
      <header className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/8 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-primary text-xs font-semibold tracking-widest uppercase mb-4 block"
              >
                Sobre a Netcar
              </motion.span>
              <h1 className="text-3xl md:text-4xl lg:text-[48px] font-bold leading-tight mb-5 text-fg">
                Desde 1997, curadoria e procedência em seminovos.
              </h1>
              <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-6">
                Há quase três décadas selecionando carros com histórico, qualidade e transparência.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Procedência comprovada</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Checklist técnico</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span>Entrega sem surpresa</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex justify-center lg:justify-end"
            >
              <div className="relative">
                <div className="w-64 h-64 md:w-80 md:h-80 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 p-2">
                  <div className="w-full h-full rounded-full bg-white p-2 shadow-xl overflow-hidden">
                    <img 
                      src={loja1Image || "/images/loja1.jpg"}
                      alt="Netcar Multimarcas"
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/images/loja1.jpg";
                      }}
                    />
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 bg-white rounded-full px-4 py-2 shadow-lg border border-gray-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-fg">Desde 1997</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Nossa essência */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative bg-white rounded-[24px] p-8 md:p-10 shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-primary/50 to-transparent" />
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Nossa essência</span>
            <h2 className="text-2xl md:text-[30px] font-bold mb-4 leading-tight">Curadoria com propósito</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed max-w-3xl">
              {essencia?.conteudo || "Selecionamos cada veículo com critérios objetivos de quilometragem, histórico e procedência. O preparo e a transparência fazem parte do processo, para você comprar certo."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: CheckCircle2, text: "Curadoria de estoque com procedência comprovada" },
                { icon: CheckCircle2, text: "Checklist técnico e histórico de manutenção" },
                { icon: CheckCircle2, text: "Laudos e documentação quando aplicável" },
                { icon: CheckCircle2, text: "Atendimento próximo e experiente" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 group">
                  <item.icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="text-muted-foreground text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Nossos números */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {counters && counters.length > 0 ? (
              counters.slice(0, 4).map((counter, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-primary/30 hover:shadow-md transition-all text-center md:text-left"
                >
                  <div className="text-4xl md:text-5xl font-bold text-fg mb-1">
                    {counter.valor.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-primary text-sm font-medium">{counter.titulo}</div>
                </motion.div>
              ))
            ) : (
              <>
                {[
                  { value: "1997", label: "Desde" },
                  { value: "+2.750", label: "Clientes atendidos" },
                  { value: "94%", label: "Clientes recomendam" },
                  { value: "83%", label: "Taxa de recompra" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                    className="p-6 rounded-2xl border border-gray-200 bg-white hover:border-primary/30 hover:shadow-md transition-all text-center md:text-left"
                  >
                    <div className="text-4xl md:text-5xl font-bold text-fg mb-1">{item.value}</div>
                    <div className="text-primary text-sm font-medium">{item.label}</div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Nossas lojas */}
      <section className="py-16 md:py-20 bg-gray-50/50 relative z-10 overflow-hidden">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="mb-10">
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Onde estamos</span>
            <h2 className="text-2xl md:text-[32px] font-bold mb-2">Nossas lojas</h2>
            <p className="text-muted-foreground max-w-lg">Dois endereços em Esteio/RS para melhor atendê-lo.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Loja 1 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative bg-white rounded-[20px] shadow-sm hover:shadow-md transition-all group"
            >
              <div className="relative h-[220px] rounded-t-[20px] overflow-hidden">
                <img
                  src={loja1Image}
                  alt="Fachada da Loja 1"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja1.jpg";
                  }}
                />
              </div>
              <div className="absolute -top-6 -right-6 w-40 h-28 rounded-xl overflow-hidden shadow-2xl border-4 border-white z-10">
                <img
                  src={loja2Image}
                  alt="Miniatura Loja 2"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja2.jpg";
                  }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-fg mb-1">Loja 1 — Centro, Esteio/RS</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  {formatAddress(addressLoja1) || "Av. Presidente Vargas, 740"} — {formatPhone(phoneLoja1) || "(51) 3473-7900"}
                </p>
                <p className="text-muted-foreground text-sm">Showroom amplo, atendimento personalizado e test-drive.</p>
              </div>
            </motion.article>

            {/* Loja 2 */}
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="relative bg-white rounded-[20px] shadow-sm hover:shadow-md transition-all group"
            >
              <div className="relative h-[220px] rounded-t-[20px] overflow-hidden">
                <img
                  src={loja2Image}
                  alt="Fachada da Loja 2"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja2.jpg";
                  }}
                />
              </div>
              <div className="absolute -top-6 -right-6 w-40 h-28 rounded-xl overflow-hidden shadow-2xl border-4 border-white z-10">
                <img
                  src={loja1Image}
                  alt="Miniatura Loja 1"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/images/loja1.jpg";
                  }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-fg mb-1">Loja 2 — Centro, Esteio/RS</h3>
                <p className="text-muted-foreground text-sm mb-3">
                  {formatAddress(addressLoja2) || "Av. Presidente Vargas, 1106"} — {formatPhone(phoneLoja2) || "(51) 3033-3900"}
                </p>
                <p className="text-muted-foreground text-sm">Seleção de seminovos e condições especiais de financiamento.</p>
              </div>
            </motion.article>
          </div>
        </div>
      </section>

      {/* Linha do tempo + Valores */}
      <section className="py-16 md:py-20">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
            {/* Nossa história */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="h-full p-6 md:p-8 rounded-2xl border border-gray-200 bg-white hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="mb-6">
                <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-2 block">Trajetória</span>
                <h2 className="text-2xl md:text-[28px] font-bold">Nossa história</h2>
              </div>
              {historia?.conteudo ? (
                <div
                  className="text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: historia.conteudo }}
                />
              ) : (
                <div className="space-y-0">
                  {timelineItems.map((item, index) => (
                    <motion.div 
                      key={index} 
                      className="group relative py-4 border-b border-gray-100 last:border-0"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-primary font-bold text-lg min-w-[60px]">{item.year}</span>
                        <div>
                          <h4 className="font-semibold text-fg group-hover:text-primary transition-colors">{item.title}</h4>
                          <p className="text-muted-foreground text-sm mt-1">{item.description}</p>
                        </div>
                      </div>
                    </motion.div>
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
              className="h-full p-6 md:p-8 rounded-2xl border border-gray-200 bg-white hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="mb-6">
                <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-2 block">Princípios</span>
                <h2 className="text-2xl md:text-[28px] font-bold">Nossos valores</h2>
              </div>
              {valores?.conteudo ? (
                <div
                  className="text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: valores.conteudo }}
                />
              ) : (
                <div className="space-y-0">
                  {[
                    { icon: Shield, title: "Transparência", description: "Informação clara em cada etapa da compra." },
                    { icon: CheckCircle2, title: "Procedência", description: "Histórico e documentação verificados." },
                    { icon: Award, title: "Experiência", description: "Desde 1997 no mercado de seminovos." },
                  ].map((valor, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="group py-4 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <valor.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-fg group-hover:text-primary transition-colors">{valor.title}</h4>
                          <p className="text-muted-foreground text-sm mt-1">{valor.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Equipe */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="text-primary text-xs font-semibold uppercase tracking-widest mb-3 block">Quem faz acontecer</span>
            <h2 className="text-2xl md:text-[36px] font-bold mb-3">Nossa equipe</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Profissionais dedicados em cada etapa do seu atendimento.</p>
          </motion.div>
          
          <div className="space-y-16">
            {teamBySector.map((sector, sectorIndex) => (
              <motion.div
                key={sector.sector}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: sectorIndex * 0.1 }}
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-200 to-gray-200" />
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground px-4">{sector.sector}</h3>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-gray-200 to-gray-200" />
                </div>
                
                <div className={cn(
                  "grid gap-6 md:gap-8",
                  sector.members.length <= 3 ? "grid-cols-2 sm:grid-cols-3 max-w-2xl mx-auto" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                )}>
                  {sector.members.map((person, index) => (
                    <motion.div
                      key={person.name}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.08 }}
                      className="group text-center"
                    >
                      <div className="relative mb-4 mx-auto w-28 h-28 md:w-32 md:h-32">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 scale-110 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative w-full h-full rounded-full overflow-hidden ring-2 ring-white shadow-lg group-hover:ring-primary/30 transition-all duration-300">
                          <img 
                            src={person.image} 
                            alt={person.name}
                            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                      </div>
                      <h5 className="font-semibold text-fg group-hover:text-primary transition-colors">{person.name}</h5>
                      <p className="text-muted-foreground text-sm mt-0.5">{person.role}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Estoque */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/50 to-transparent rounded-full" />
            <div className="pl-8">
              <h3 className="text-3xl md:text-[42px] font-bold mb-4 text-fg leading-tight">
                Quer ver nosso<br />estoque qualificado?
              </h3>
              <p className="text-muted-foreground mb-8 text-lg max-w-md">
                Fale com a equipe ou explore as ofertas atualizadas nas duas lojas.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/seminovos"
                  search={{
                    marca: undefined,
                    modelo: undefined,
                    precoMin: undefined,
                    precoMax: undefined,
                    anoMin: undefined,
                    anoMax: undefined,
                    cambio: undefined,
                    cor: undefined,
                  }}
                  className={cn(
                    "px-7 py-3.5 rounded-full font-semibold",
                    "bg-primary text-white transition-all",
                    "hover:bg-primary/90 hover:shadow-lg"
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
                      "px-7 py-3.5 rounded-full font-semibold",
                      "text-primary underline underline-offset-4 transition-all",
                      "hover:text-primary/80"
                    )}
                  >
                    Chamar no WhatsApp
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
