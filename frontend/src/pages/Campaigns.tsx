import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "../api/dashboard";
import api from "../api/client";

interface Contact {
  user_phone: string;
  last_message_at: string;
}

const TEMPLATES = [
  { name: "Promoción especial", icon: "🎁", message: "¡Hola! 👋 Tenemos una *promoción especial* solo para ti.\n\n🔥 [Describe tu oferta aquí]\n\n¿Te interesa? Responde *SI* para más info." },
  { name: "Recordatorio de cita", icon: "📅", message: "Hola 👋 Te recordamos que tienes una cita con nosotros.\n\n📅 *Fecha:* [fecha]\n🕐 *Hora:* [hora]\n\nSi necesitas reagendar escribe *REAGENDAR*." },
  { name: "Nuevo producto/servicio", icon: "✨", message: "¡Hola! 🎉 Tenemos algo nuevo para ti.\n\n✨ *[Nombre del producto/servicio]*\n\n[Descripción breve]\n\n¿Quieres saber más? Escribe *INFO*." },
  { name: "Seguimiento", icon: "💬", message: "Hola 👋 Hace un tiempo conversamos y quería saber si pudimos ayudarte.\n\nEstamos disponibles. Escribe *HOLA* para hablar con nosotros." },
  { name: "Encuesta de satisfacción", icon: "⭐", message: "Hola 😊 ¿Cómo calificarías nuestro servicio?\n\n1️⃣ Malo\n2️⃣ Regular\n3️⃣ Bueno\n4️⃣ Muy bueno\n5️⃣ Excelente\n\nResponde con el número." },
];

const FILE_TYPES: Record<string, { icon: string; label: string }> = {
  "image/jpeg":       { icon: "🖼️", label: "Imagen JPG" },
  "image/png":        { icon: "🖼️", label: "Imagen PNG" },
  "image/webp":       { icon: "🖼️", label: "Imagen WebP" },
  "image/gif":        { icon: "🎞️", label: "GIF animado" },
  "video/mp4":        { icon: "🎬", label: "Video MP4" },
  "video/3gpp":       { icon: "🎬", label: "Video 3GP" },
  "application/pdf":  { icon: "📄", label: "PDF" },
  "audio/mpeg":       { icon: "🎵", label: "Audio MP3" },
  "audio/ogg":        { icon: "🎵", label: "Audio OGG" },
};

export default function Campaigns() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Archivo adjunto
  const [attachedFile, setAttachedFile] = useState<{ url: string; type: string; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [convRes, dash] = await Promise.all([
        api.get("/conversations", { headers: { Authorization: `Bearer ${token}` } }),
        getDashboard(token),
      ]);
      setContacts(convRes.data || []);
      const status = dash?.business?.subscription_status;
      setIsPaid(status === "active");
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRefreshOnFocus(fetchData);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setSelectedContacts(checked ? contacts.map(c => c.user_phone) : []);
  };

  const handleSelectContact = (phone: string, checked: boolean) => {
    setSelectedContacts(prev => checked ? [...prev, phone] : prev.filter(p => p !== phone));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await api.post("/campaigns/upload", form, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setAttachedFile({ url: res.data.url, type: res.data.type, name: res.data.name });
    } catch { alert("Error subiendo el archivo. Máx 16MB."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleSend = async () => {
    if (!campaignName.trim()) { setResult({ ok: false, msg: "Escribe un nombre para la campaña" }); return; }
    if (!message.trim() && !attachedFile) { setResult({ ok: false, msg: "Escribe un mensaje o adjunta un archivo" }); return; }
    if (selectedContacts.length === 0) { setResult({ ok: false, msg: "Selecciona al menos un contacto" }); return; }
    if (!confirm(`¿Enviar a ${selectedContacts.length} contacto(s)?`)) return;

    setSending(true);
    setResult(null);
    try {
      const res = await api.post("/campaigns/send", {
        name: campaignName,
        message,
        phones: selectedContacts,
        mediaUrl: attachedFile?.url || null,
        mediaType: attachedFile?.type || null,
      }, { headers: { Authorization: `Bearer ${token}` } });

      setResult({ ok: true, msg: `✅ Enviado a ${res.data.sent} contacto(s)${res.data.failed > 0 ? ` — ${res.data.failed} fallaron` : ""}` });
      setCampaignName(""); setMessage(""); setSelectedContacts([]); setSelectAll(false); setAttachedFile(null);
    } catch (err: any) {
      setResult({ ok: false, msg: err?.response?.data?.error || "Error enviando campaña" });
    } finally { setSending(false); }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">📣 Campañas</h1>
        <p className="text-gray-400 mt-1">Envía mensajes masivos a tus contactos de WhatsApp</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Contactos totales", value: contacts.length, color: "text-blue-400" },
          { label: "Seleccionados", value: selectedContacts.length, color: "text-green-400" },
          { label: "Tipo de plan", value: isPaid ? "Activo" : "Trial", color: isPaid ? "text-green-400" : "text-yellow-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Bloqueo para plan trial */}
      {!isPaid && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-2xl p-6 mb-6 flex items-start gap-4">
          <span className="text-3xl shrink-0">🔒</span>
          <div className="flex-1">
            <p className="text-yellow-300 font-semibold mb-1">Función exclusiva para planes de pago</p>
            <p className="text-yellow-400/80 text-sm mb-3">Las campañas masivas están disponibles en los planes Emprendedor, Profesional y Empresa.</p>
            <button onClick={() => navigate("/billing")}
              className="bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors">
              Ver planes →
            </button>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* LEFT — Mensaje */}
        <div className="space-y-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-4">✉️ Mensaje de la campaña</h2>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">Nombre de la campaña</label>
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                disabled={!isPaid}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 focus:border-green-500 focus:outline-none disabled:opacity-50"
                placeholder="Ej: Promoción de abril"/>
            </div>

            {/* Plantillas */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-500">Mensaje</label>
                <button onClick={() => setShowTemplates(!showTemplates)} disabled={!isPaid}
                  className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">
                  📝 {showTemplates ? "Ocultar plantillas" : "Usar plantilla"}
                </button>
              </div>
              {showTemplates && (
                <div className="space-y-2 mb-3">
                  {TEMPLATES.map(t => (
                    <button key={t.name} onClick={() => { setMessage(t.message); setShowTemplates(false); }}
                      className="w-full text-left bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3 transition-colors flex items-center gap-3">
                      <span className="text-xl shrink-0">{t.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <p className="text-xs text-gray-500 truncate">{t.message.slice(0, 50)}…</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
                disabled={!isPaid}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-200 resize-y focus:border-green-500 focus:outline-none disabled:opacity-50"
                placeholder={attachedFile ? "Caption del archivo (opcional)…" : "Escribe tu mensaje aquí…\n\nUsa *negrita*, _cursiva_ y emojis 😊"}/>
              <p className="text-xs text-gray-600 mt-1 text-right">{message.length} caracteres</p>
            </div>

            {/* Adjuntar archivo */}
            <div className="border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 mb-2 font-medium">📎 Adjuntar archivo</p>
              <input ref={fileRef} type="file" className="hidden"
                accept="image/*,video/mp4,video/3gpp,application/pdf,audio/mpeg,audio/ogg"
                onChange={handleFileUpload}/>

              {attachedFile ? (
                <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3">
                  <span className="text-2xl">{FILE_TYPES[attachedFile.type]?.icon || "📎"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{attachedFile.name}</p>
                    <p className="text-xs text-gray-500">{FILE_TYPES[attachedFile.type]?.label}</p>
                  </div>
                  <button onClick={() => setAttachedFile(null)}
                    className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/20">
                    ✕ Quitar
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={!isPaid || uploading}
                  className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl py-4 text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Subiendo…</>
                  ) : <>📎 Imagen, Video, PDF o Audio (máx 16MB)</>}
                </button>
              )}
            </div>

            {/* Preview */}
            {(message || attachedFile) && (
              <div className="bg-[#0b141a] rounded-xl p-4 border border-gray-800 mt-4">
                <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Vista previa</p>
                <div className="inline-block bg-[#202c33] rounded-xl rounded-tl-none px-4 py-3 max-w-xs">
                  {attachedFile && (
                    <div className="flex items-center gap-2 mb-2 bg-gray-700 rounded-lg px-3 py-2">
                      <span>{FILE_TYPES[attachedFile.type]?.icon || "📎"}</span>
                      <span className="text-xs text-gray-300 truncate">{attachedFile.name}</span>
                    </div>
                  )}
                  {message && <p className="text-[#e9edef] text-sm whitespace-pre-wrap leading-relaxed">{message}</p>}
                  <p className="text-[#8696a0] text-xs mt-1.5 text-right">Ahora ✓✓</p>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className={`rounded-xl p-4 text-sm font-medium ${
              result.ok ? "bg-green-900/30 border border-green-700/50 text-green-300" : "bg-red-900/30 border border-red-700/50 text-red-300"
            }`}>
              {result.msg}
            </div>
          )}

          <button onClick={handleSend}
            disabled={!isPaid || sending || selectedContacts.length === 0 || (!message.trim() && !attachedFile)}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base">
            {sending ? (
              <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Enviando…</>
            ) : `🚀 Enviar a ${selectedContacts.length} contacto(s)`}
          </button>
        </div>

        {/* RIGHT — Contactos */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">👥 Seleccionar contactos</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectAll}
                onChange={e => handleSelectAll(e.target.checked)}
                disabled={!isPaid}
                className="w-4 h-4 accent-green-500"/>
              <span className="text-xs text-gray-400">Todos</span>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-green-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-500 text-sm">No tienes contactos aún. Los contactos aparecen cuando alguien escribe al bot.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {contacts.map(contact => {
                const isSelected = selectedContacts.includes(contact.user_phone);
                const date = contact.last_message_at
                  ? new Date(contact.last_message_at + "Z").toLocaleDateString("es-CO", { day: "2-digit", month: "short" })
                  : "";
                return (
                  <label key={contact.user_phone}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                      !isPaid ? "opacity-50 cursor-not-allowed" :
                      isSelected ? "bg-green-900/30 border border-green-700/50" : "bg-gray-900/60 border border-gray-700 hover:bg-gray-700/50"
                    }`}>
                    <input type="checkbox" checked={isSelected}
                      onChange={e => handleSelectContact(contact.user_phone, e.target.checked)}
                      disabled={!isPaid}
                      className="w-4 h-4 accent-green-500 shrink-0"/>
                    <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                      {contact.user_phone.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 font-medium">+{contact.user_phone}</p>
                      <p className="text-xs text-gray-500">Último mensaje: {date}</p>
                    </div>
                    {isSelected && <span className="text-green-400 text-sm shrink-0">✓</span>}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

