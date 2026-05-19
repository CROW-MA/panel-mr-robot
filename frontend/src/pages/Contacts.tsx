import { useEffect, useState, useCallback } from "react";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

interface Conversation {
  id: string;
  user_phone: string;
  current_step: string;
  mode: string;
  last_message_at: string;
  created_at: string;
}

function getStepLabel(step: string): string {
  const map: Record<string,string> = {
    start: "Menú principal", servicios: "Servicios", horarios: "Horarios",
    ubicacion: "Ubicación", asesor: "Asesor", agenda_cita: "Agendar Cita",
  };
  if (map[step]) return map[step];
  return step.replace(/_/g," ").replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "Sin actividad";
  const utcStr = dateStr.endsWith("Z") ? dateStr : dateStr + "Z";
  const d = new Date(utcStr);
  if (isNaN(d.getTime())) return "Sin actividad";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function cleanPhone(phone: string): string {
  return phone.replace("@lid","").replace("@c.us","").replace(/\D/g,"");
}

const Contacts = () => {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.get("/conversations", { headers: { Authorization: `Bearer ${token}` } });
      setConversations(r.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useRefreshOnFocus(fetchConversations);

  const filtered = conversations.filter((c) =>
    cleanPhone(c.user_phone).includes(search.replace(/\D/g,"")) ||
    c.user_phone.includes(search)
  );

  const toggleMode = async (conv: Conversation) => {
    const newMode = conv.mode === "human" ? "bot" : "human";
    try {
      await api.put(`/conversations/${conv.id}/mode`, { mode: newMode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, mode: newMode } : c));
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-7 w-7 text-green-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p className="text-gray-400 text-sm">Cargando contactos…</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Contactos</h1>
        <p className="text-gray-400 mt-1">Clientes que han escrito a tu WhatsApp</p>
      </div>

      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por número..."
          className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-600"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center">
          <p className="text-5xl mb-4">💬</p>
          <p className="text-gray-400 font-medium text-lg">No hay contactos aún</p>
          <p className="text-gray-600 text-sm mt-2">Cuando alguien escriba a tu WhatsApp aparecerá aquí</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conv) => {
            const phone = cleanPhone(conv.user_phone);
            const isHuman = conv.mode === "human";
            return (
              <div key={conv.id} className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-colors ${
                isHuman ? "bg-orange-950/30 border-orange-800/50" : "bg-gray-800 border-gray-700"
              }`}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 ${
                    isHuman ? "bg-orange-900/60" : "bg-gray-700"
                  }`}>
                    {isHuman ? "👨" : "👤"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold">+{phone}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isHuman ? "bg-orange-900/60 text-orange-300 border border-orange-700/50" : "bg-green-900/60 text-green-300 border border-green-700/50"
                      }`}>
                        {isHuman ? "🧑‍💼 Asesor" : "🤖 Bot"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">
                        Paso: <span className="text-gray-300">{getStepLabel(conv.current_step)}</span>
                      </span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-500">{formatDate(conv.last_message_at || conv.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Abrir WhatsApp */}
                  <a
                    href={`https://wa.me/${phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    💬 Responder
                  </a>
                  {/* Activar/desactivar bot */}
                  <button
                    onClick={() => toggleMode(conv)}
                    className={`text-xs border px-3 py-2 rounded-xl transition-colors font-medium ${
                      isHuman
                        ? "border-green-700 text-green-400 hover:bg-green-900/30"
                        : "border-gray-600 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {isHuman ? "Activar bot" : "Tomar control"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Contacts;

