import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Send,
  MessageCircle
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

  return (
    <main className="flex-1 pt-12 pb-20 overflow-x-hidden max-w-full">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-fg mb-4">Fale Conosco</h1>
          <p className="text-gray-500 text-lg">
            Estamos prontos para ajudar
          </p>
        </motion.div>

        {/* Contact Cards Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16"
        >
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 group-hover:bg-green-100 transition-colors">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-fg text-sm">WhatsApp</h3>
              <p className="text-primary text-sm font-medium">(51) 99887-9281</p>
            </div>
          </a>

          <a
            href={`tel:${phoneLoja1?.telefone || "5134737900"}`}
            className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-fg text-sm">Telefone</h3>
              <p className="text-gray-500 text-sm">{phoneLoja1?.telefone || "(51) 3473-7900"}</p>
            </div>
          </a>

          <a
            href="mailto:contato@netcarmultimarcas.com.br"
            className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-gray-200 transition-colors">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-fg text-sm">E-mail</h3>
              <p className="text-gray-500 text-sm truncate">contato@netcarmultimarcas.com.br</p>
            </div>
          </a>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-3xl shadow-sm p-8 border border-gray-100"
          >
            <h2 className="text-xl font-bold text-fg mb-6">Envie uma mensagem</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                  <input
                    type="tel"
                    required
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
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
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
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
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
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
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all resize-none"
                  placeholder="Como podemos ajudar?"
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

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-6"
          >
            {/* Lojas */}
            <div className="bg-white rounded-3xl shadow-sm p-8 border border-gray-100">
              <h2 className="text-xl font-bold text-fg mb-6">Nossas Lojas</h2>
              <div className="space-y-5">
                <a
                  href="https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-fg text-sm group-hover:text-primary transition-colors">Loja 1 — Centro, Esteio/RS</h3>
                    <p className="text-gray-500 text-sm">Av. Presidente Vargas, 740</p>
                    <p className="text-fg text-sm font-medium mt-1">(51) 3473-7900</p>
                  </div>
                </a>

                <div className="h-px bg-gray-100" />

                <a
                  href="https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-fg text-sm group-hover:text-primary transition-colors">Loja 2 — Centro, Esteio/RS</h3>
                    <p className="text-gray-500 text-sm">Av. Presidente Vargas, 1106</p>
                    <p className="text-fg text-sm font-medium mt-1">(51) 3033-3900</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Horários */}
            <div className="bg-white rounded-3xl shadow-sm p-8 border border-gray-100">
              <h2 className="text-xl font-bold text-fg mb-6">Atendimento</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Seg a Sex</span>
                  <span className="font-semibold text-primary">{schedule?.dias_semana || "9h às 18h"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Sábado</span>
                  <span className="font-semibold text-amber-500">{schedule?.sabado || "9h às 16h30"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Jan-Fev (Sáb)</span>
                  <span className="font-semibold text-amber-500">9h às 13h30</span>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 text-center">Não fechamos ao meio-dia</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
