import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Send,
  MessageCircle,
  Clock
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
    <main className="flex-1 pt-16 pb-24 overflow-x-hidden max-w-full bg-[#f5f7f9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-fg mb-4">Fale Conosco</h1>
          <p className="text-gray-500 text-lg max-w-md mx-auto">
            Escolha a melhor forma de entrar em contato
          </p>
        </motion.div>

        {/* Quick Contact Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap justify-center gap-4 mb-16"
        >
          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-white text-fg px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-lg"
          >
            <MessageCircle className="w-5 h-5 text-green-500" />
            WhatsApp
          </a>
          <a
            href={`tel:${phoneLoja1?.telefone || "5134737900"}`}
            className="inline-flex items-center gap-3 bg-white text-fg px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-lg"
          >
            <Phone className="w-5 h-5 text-primary" />
            {phoneLoja1?.telefone || "(51) 3473-7900"}
          </a>
          <a
            href="mailto:contato@netcarmultimarcas.com.br"
            className="inline-flex items-center gap-3 bg-white text-fg px-8 py-4 rounded-full font-semibold hover:bg-gray-50 transition-colors shadow-lg"
          >
            <Mail className="w-5 h-5 text-gray-500" />
            E-mail
          </a>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form - Takes 2 columns */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm"
          >
            <h2 className="text-2xl font-bold text-fg mb-1">Envie uma mensagem</h2>
            <p className="text-gray-400 mb-5">Responderemos o mais breve possível</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-xl px-5 py-4 text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-fg mb-2">Telefone</label>
                  <input
                    type="tel"
                    required
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full bg-gray-50 border-0 rounded-xl px-5 py-4 text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-2">E-mail</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-50 border-0 rounded-xl px-5 py-4 text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-2">Assunto</label>
                <input
                  type="text"
                  required
                  value={formData.assunto}
                  onChange={(e) => setFormData({ ...formData, assunto: e.target.value })}
                  className="w-full bg-gray-50 border-0 rounded-xl px-5 py-4 text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  placeholder="Sobre o que deseja falar?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-fg mb-2">Mensagem</label>
                <textarea
                  required
                  rows={3}
                  value={formData.mensagem}
                  onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })}
                  className="w-full bg-gray-50 border-0 rounded-xl px-5 py-4 text-fg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
                  placeholder="Escreva sua mensagem..."
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4" />
                Enviar mensagem
              </button>
            </form>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="space-y-6"
          >
            {/* Lojas */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-fg">Nossas Lojas</h3>
              </div>
              
              <div className="space-y-6">
                <a
                  href="https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <p className="font-semibold text-fg group-hover:text-primary transition-colors">Loja 1</p>
                  <p className="text-gray-500 text-sm">Av. Presidente Vargas, 740</p>
                  <p className="text-gray-500 text-sm">Centro, Esteio/RS</p>
                  <p className="text-primary text-sm font-medium mt-1">(51) 3473-7900</p>
                </a>

                <div className="h-px bg-gray-100" />

                <a
                  href="https://maps.app.goo.gl/i8uHquE8tNMfoTHr9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <p className="font-semibold text-fg group-hover:text-primary transition-colors">Loja 2</p>
                  <p className="text-gray-500 text-sm">Av. Presidente Vargas, 1106</p>
                  <p className="text-gray-500 text-sm">Centro, Esteio/RS</p>
                  <p className="text-primary text-sm font-medium mt-1">(51) 3033-3900</p>
                </a>
              </div>
            </div>

            {/* Horários */}
            <div className="bg-white rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-fg">Horários</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Seg a Sex</span>
                  <span className="font-semibold text-primary">{schedule?.dias_semana || "9h às 18h"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sábado</span>
                  <span className="font-semibold text-amber-500">{schedule?.sabado || "9h às 16h30"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Jan-Fev (Sáb)</span>
                  <span className="font-semibold text-amber-500">9h às 13h30</span>
                </div>
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <p className="text-gray-400 text-center text-xs">Não fechamos ao meio-dia</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
