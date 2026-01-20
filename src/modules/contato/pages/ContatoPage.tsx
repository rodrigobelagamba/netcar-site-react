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
  useWhatsAppQuery,
  useScheduleQuery
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
  const { data: whatsapp } = useWhatsAppQuery();
  const { data: schedule } = useScheduleQuery();

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
      nome: "Loja 1 — Centro, Esteio/RS",
      endereco: "Av. Presidente Vargas, 740",
      telefone: "(51) 3473-7900",
      maps: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
    },
    {
      nome: "Loja 2 — Centro, Esteio/RS",
      endereco: "Av. Presidente Vargas, 1106",
      telefone: "(51) 3033-3900",
      maps: "https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
    }
  ];

  return (
    <main className="flex-1 pt-12 pb-20 overflow-x-hidden max-w-full">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-primary text-sm font-medium uppercase tracking-wider">Entre em contato</span>
          <h1 className="text-4xl md:text-5xl font-bold text-fg mt-3 mb-5">Como podemos ajudar?</h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Escolha a forma mais conveniente para você
          </p>
        </motion.div>

        {/* Main Contact Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20"
        >
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-5">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-1">WhatsApp</h3>
              <p className="text-gray-400 text-sm">Resposta imediata</p>
            </div>
          </a>

          <a
            href={`tel:${phoneLoja1?.telefone || "5134737900"}`}
            className="group bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-1">Telefone</h3>
              <p className="text-gray-400 text-sm">{phoneLoja1?.telefone || "(51) 3473-7900"}</p>
            </div>
          </a>

          <a
            href="mailto:contato@netcarmultimarcas.com.br"
            className="group bg-white rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
                <Mail className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-fg mb-1">E-mail</h3>
              <p className="text-gray-400 text-sm">contato@netcarmultimarcas.com.br</p>
            </div>
          </a>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
          
          {/* Contact Form - 3 columns */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <h2 className="text-2xl font-bold text-fg mb-8">Envie uma mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-gray-200 px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Telefone</label>
                  <input
                    type="tel"
                    required
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full bg-transparent border-0 border-b border-gray-200 px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">E-mail</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-gray-200 px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Assunto</label>
                <input
                  type="text"
                  required
                  value={formData.assunto}
                  onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-gray-200 px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors"
                  placeholder="Sobre o que deseja falar?"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Mensagem</label>
                <textarea
                  required
                  rows={4}
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  className="w-full bg-transparent border-0 border-b border-gray-200 px-0 py-3 text-fg placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors resize-none"
                  placeholder="Como podemos ajudar?"
                />
              </div>

              <button
                type="submit"
                className="bg-fg text-white px-8 py-4 rounded-full font-medium flex items-center gap-3 hover:bg-fg/90 transition-all hover:shadow-lg group"
              >
                <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                Enviar mensagem
              </button>
            </form>
          </motion.div>

          {/* Info Column - 2 columns */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-2 space-y-8"
          >
            {/* Lojas */}
            <div>
              <h2 className="text-2xl font-bold text-fg mb-8">Nossas Lojas</h2>
              <div className="space-y-6">
                {lojas.map((loja, index) => (
                  <a
                    key={index}
                    href={loja.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-fg mb-1 group-hover:text-primary transition-colors">{loja.nome}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed mb-2">{loja.endereco}</p>
                        <p className="text-gray-400 text-sm">{loja.telefone}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100" />

            {/* Horários */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-fg">Horários</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Segunda a Sexta</span>
                  <span className="font-medium text-fg">{schedule?.semana || "8h às 18h30"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Sábados</span>
                  <span className="font-medium text-fg">{schedule?.sabado || "9h às 13h30"}</span>
                </div>
                <p className="text-xs text-gray-400 pt-2 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  Não fechamos ao meio-dia
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
