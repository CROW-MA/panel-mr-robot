import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

interface Notification {
  id: string;
  type: "human_request" | "agenda_request" | "new_contact";
  title: string;
  body: string;
  phone: string;
  read: boolean;
  created_at: string;
}

const TYPE_CONFIG = {
  agenda_request: {
    icon: "📅",
    bg: "bg-purple-900/30",
    border: "border-purple-700/50",
    badge: "bg-purple-600/30 text-purple-300 border-purple-700/40",
    label: "Solicitud de cita",
  },
  human_request: {
    icon: "👤",
    bg: "bg-blue-900/30",
    border: "border-blue-700/50",
    badge: "bg-blue-600/30 text-blue-300 border-blue-700/40",
    label: "Solicita asesor",
  },
  new_contact: {
    icon: "🆕",
    bg: "bg-green-900/20",
    border: "border-green-700/40",
    badge: "bg-green-600/30 text-green-300 border-green-700/40",
    label: "Nuevo contacto",
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function cleanPhone(phone: string): string {
  return phone.replace("@lid","").replace("@c.us","").replace(/\D/g,"");
}

/* Link que abre WhatsApp app en celular y WhatsApp Web en desktop */
function getWhatsAppLink(phone: string): string {
  const clean = cleanPhone(phone);
  return `https://wa.me/${clean}`;
}

const Notifications = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"unread"|"agenda_request"|"human_request"|"new_contact">("all");

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get("/notifications", { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(res.data ?? []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    // Polling cada 4 segundos — compatible con Cloudflare
    const interval = setInterval(async () => {
      if (!token) return;
      try {
        const res = await api.get("/notifications", { headers: { Authorization: `Bearer ${token}` } });
        setNotifications(res.data ?? []);
      } catch {}
    }, 4000);
    return () => clearInterval(interval);
  }, [token, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  };

  const deleteNotif = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "all") return true;
    return n.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-7 w-7 text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p className="text-gray-400 text-sm">Cargando notificaciones…</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">🔔 Notificaciones</h1>
          <p className="text-gray-400 text-sm mt-1">Alertas de citas, asesores y nuevos contactos</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-4 py-2 rounded-xl transition-colors">
            ✓ Marcar todas como leídas ({unreadCount})
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key:"all",            label:"Todas" },
          { key:"unread",         label:`No leídas${unreadCount > 0 ? ` (${unreadCount})` : ""}` },
          { key:"agenda_request", label:"📅 Citas" },
          { key:"human_request",  label:"👤 Asesores" },
          { key:"new_contact",    label:"🆕 Contactos" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === key
                ? "bg-green-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-800 rounded-2xl border border-gray-700">
          <div className="text-5xl mb-4">🔕</div>
          <p className="text-gray-400">No hay notificaciones en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.new_contact;
            const waLink = notif.phone ? getWhatsAppLink(notif.phone) : null;
            return (
              <div key={notif.id}
                className={`rounded-2xl border p-4 transition-all ${cfg.bg} ${cfg.border} ${!notif.read ? "ring-1 ring-white/10" : "opacity-75"}`}>
                <div className="flex items-start gap-4">
                  <div className="text-2xl shrink-0 mt-0.5">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-semibold text-sm">{notif.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
                      {!notif.read && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">Nuevo</span>}
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{notif.body}</p>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-gray-500 text-xs">🕐 {formatDate(notif.created_at)}</span>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-green-700 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          💬 Responder por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!notif.read && (
                      <button onClick={() => markAsRead(notif.id)}
                        className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="Marcar como leída">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                      </button>
                    )}
                    <button onClick={() => deleteNotif(notif.id)}
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                      title="Eliminar">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;

