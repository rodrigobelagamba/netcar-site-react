import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send,
  MessageCircle,
  ArrowRight
} from "lucide-react";
import { useDefaultMetaTags } from "@/hooks/useDefaultMetaTags";
import { 
  usePhoneQuery, 
  useAddressQuery, 
  useWhatsAppQuery,
  useScheduleQuery,
  useBannersLoja1Query,
  useBannersLoja2Query
} from "@/api";

export function ContatoPage() {
  useDefaultMetaTags(
    "Contato",
    "Entre em contato com a Netcar. Estamos prontos para ajudar você a encontrar o veículo ideal."
  );

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    assunto: "",
    mensagem: ""
  });

  const { data: phoneLoja1 } = usePhoneQuery("Loja1");
  const { data: phoneLoja2 } = usePhoneQuery("Loja2");
  const { data: addressLoja1 } = useAddressQuery("Loja1");
  const { data: addressLoja2 } = useAddressQuery("Loja2");
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: schedule } = useScheduleQuery();
  const { data: bannersLoja1 } = useBannersLoja1Query();
  const { data: bannersLoja2 } = useBannersLoja2Query();

  const getFachadaImage = (banners: Array<{ titulo?: string; imagem: string }> | undefined, fallback: string): string => {
    if (!banners || banners.length === 0) return fallback;
    const fachada = banners.find((banner) => banner.titulo?.toLowerCase() === "fachada");
    if (fachada?.imagem) return fachada.imagem;
    return banners[0]?.imagem || fallback;
  };

  const imagemLoja1 = getFachadaImage(bannersLoja1, "/images/loja1.jpg");
  const imagemLoja2 = getFachadaImage(bannersLoja2, "/images/loja2.jpg");

  const getWhatsAppLink = () => {
    if (!whatsapp?.numero) return "#";
    if (whatsapp.link) return whatsapp.link;
    const cleaned = whatsapp.numero.replace(/\D/g, "");
    const message = whatsapp.mensagem || "Olá! Gostaria de mais informações.";
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `*Contato via Site*\n\n*Nome:* ${formData.nome}\n*Email:* ${formData.email}\n*Telefone:* ${formData.telefone}\n*Assunto:* ${formData.assunto}\n\n*Mensagem:*\n${formData.mensagem}`;
    const whatsappUrl = `https://wa.me/5551998879281?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const lojas = [
    {
      nome: "Loja 1 - Esteio",
      imagem: imagemLoja1,
      endereco: addressLoja1 
        ? `${addressLoja1.endereco}, ${addressLoja1.cidade}/${addressLoja1.estado}`
        : "Av. Presidente Vargas, 2505 - Centro, Esteio/RS",
      telefone: phoneLoja1?.telefone || "(51) 3473-7900",
      maps: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
    },
    {
      nome: "Loja 2 - Sapucaia",
      imagem: imagemLoja2,
      endereco: addressLoja2 
        ? `${addressLoja2.endereco}, ${addressLoja2.cidade}/${addressLoja2.estado}`
        : "Av. Presidente Lucena, 2700 - Centro, Sapucaia do Sul/RS",
      telefone: phoneLoja2?.telefone || "(51) 3033-3900",
      maps: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
    }
  ];

  return (
    <main className="flex-1 pt-8 pb-16 overflow-x-hidden max-w-full">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-fg mb-4">Fale Conosco</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Estamos prontos para ajudar você a encontrar o veículo ideal. Entre em contato por qualquer um dos nossos canais.
          </p>
        </motion.div>

        {/* Quick Contact Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
        >
          {/* WhatsApp Card */}
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-lg transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-green-100 transition-colors">
              <MessageCircle className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">WhatsApp</h3>
            <p className="text-gray-500 text-sm mb-4">Resposta rápida</p>
            <span className="text-primary font-medium text-sm flex items-center justify-center gap-1">
              Iniciar conversa <ArrowRight className="w-4 h-4" />
            </span>
          </a>

          {/* Telefone Card */}
          <a
            href={`tel:${phoneLoja1?.telefone || "5134737900"}`}
            className="group bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-lg transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors">
              <Phone className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">Telefone</h3>
            <p className="text-gray-500 text-sm mb-4">Ligue agora</p>
            <span className="text-primary font-medium text-sm">{phoneLoja1?.telefone || "(51) 3473-7900"}</span>
          </a>

          {/* Email Card */}
          <a
            href="mailto:contato@netcarmultimarcas.com.br"
            className="group bg-white rounded-2xl shadow-sm p-8 text-center hover:shadow-lg transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
              <Mail className="w-7 h-7 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-fg mb-2">E-mail</h3>
            <p className="text-gray-500 text-sm mb-4">Envie uma mensagem</p>
            <span className="text-primary font-medium text-sm">contato@netcarmultimarcas.com.br</span>
          </a>
        </motion.div>

        {/* Content Grid: Form + Stores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-fg mb-6">Envie sua mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                  <input
                    type="tel"
                    required
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">E-mail</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Assunto</label>
                <input
                  type="text"
                  required
                  value={formData.assunto}
                  onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                  className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary"
                  placeholder="Sobre o que deseja falar?"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Mensagem</label>
                <textarea
                  required
                  rows={4}
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  className="w-full border-0 border-b border-gray-200 bg-transparent px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary resize-none"
                  placeholder="Escreva sua mensagem aqui..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-fg text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-fg/90 transition-colors"
              >
                <Send className="w-4 h-4" />
                Enviar via WhatsApp
              </button>
            </form>
          </motion.div>

          {/* Store Cards */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-fg mb-6">Nossas Lojas</h2>
            
            {lojas.map((loja, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="aspect-[16/9] relative overflow-hidden">
                  <img 
                    src={loja.imagem} 
                    alt={loja.nome}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <h3 className="absolute bottom-4 left-4 text-white font-bold text-lg">{loja.nome}</h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-gray-600 text-sm">{loja.endereco}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <p className="text-gray-600 text-sm">{loja.telefone}</p>
                  </div>
                  <a
                    href={loja.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary text-sm font-medium hover:underline"
                  >
                    Ver no mapa <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}

            {/* Horários */}
            <div className="bg-gray-50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-fg">Horário de Funcionamento</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Segunda a Sexta</span>
                  <span className="font-medium text-fg">{schedule?.semana || "8h às 18h30"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sábados</span>
                  <span className="font-medium text-fg">{schedule?.sabado || "9h às 13h30"}</span>
                </div>
                <p className="text-xs text-gray-400 pt-2">Não fechamos ao meio-dia</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
