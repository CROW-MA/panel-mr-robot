import { useEffect, useState, useCallback, useRef } from "react";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAuth } from "../context/AuthContext";
import { getBotConfig, updateBotFlow, validateBotFlow } from "../api/bot";
import type { BotFlow, FlowStep } from "../api/bot";
import api from "../api/client";

type SaveStatus = "idle" | "saving" | "success" | "error";
type StepType = "menu" | "message" | "location" | "link" | "agenda" | "human" | "collect";

const NUMBER_EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
const getEmoji = (i: number) => NUMBER_EMOJIS[i] ?? `${i+1}.`;
const countEmojis = (msg: string) => NUMBER_EMOJIS.filter(e => msg.includes(e)).length;

/* ── Emoji picker data ── */
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: "Números", emojis: ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","0️⃣","#️⃣","*️⃣"] },
  { label: "Símbolos", emojis: ["✅","❌","⚠️","ℹ️","🔴","🟡","🟢","🔵","⭐","💥","🔔","📣","🚨","🔒","🔓","💡","🎯","🏷️","📌","📍"] },
  { label: "Gestos", emojis: ["👋","👍","👎","🙏","👏","💪","🤝","👉","👈","👆","👇","☝️","🤙","✌️","🫶"] },
  { label: "Caras", emojis: ["😊","😄","😅","🤔","😍","🥰","😎","🤩","😢","😮","🤗","😁","🙂","🫡","🤖"] },
  { label: "Objetos", emojis: ["📱","💻","📞","📧","📩","📝","📋","📅","🗓️","⏰","🕐","💰","💳","🎁","🛒","🏪","🏠","🚗","✈️","🌍"] },
  { label: "Negocio", emojis: ["🏢","🤝","📊","💼","🎯","🏆","⚡","🔧","🛠️","💎","🌟","✨","🚀","📈","💬","🗣️","📢","🎉","🎊","🥳"] },
];

/* ── Emoji Picker Popup ── */
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}
function EmojiPickerPopup({ onSelect, onClose, anchorRef }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});

  // Detectar bordes y posicionar el picker para que nunca quede cortado
  useEffect(() => {
    if (!anchorRef.current) return;
    const PICKER_W = 288; // w-72
    const PICKER_H = 340; // aprox max-h
    const rect = anchorRef.current.getBoundingClientRect();
    const vw   = window.innerWidth;
    const vh   = window.innerHeight;

    const spaceBelow = vh - rect.bottom;
    const spaceRight = vw - rect.right;

    const style: typeof pos = {};
    // Vertical: abrir hacia arriba si no hay espacio abajo
    if (spaceBelow < PICKER_H && rect.top > PICKER_H) {
      style.bottom = rect.height + 4;
    } else {
      style.top = rect.height + 4;
    }
    // Horizontal: abrir hacia la izquierda si no hay espacio a la derecha
    if (spaceRight < PICKER_W) {
      style.right = 0;
    } else {
      style.left = 0;
    }
    setPos(style);
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  const allEmojis = EMOJI_GROUPS.flatMap(g => g.emojis);

  return (
    <div
      ref={ref}
      style={pos}
      className="absolute z-[9999] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-72 overflow-hidden"
    >
      <div className="p-2 border-b border-gray-800">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar emoji..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="overflow-y-auto max-h-64 p-2">
        {search.trim() ? (
          <div className="flex flex-wrap gap-1">
            {allEmojis.map((em, i) => (
              <button key={i} onClick={() => { onSelect(em); onClose(); }}
                className="text-xl p-1.5 hover:bg-gray-700 rounded-lg transition-colors">{em}</button>
            ))}
          </div>
        ) : (
          EMOJI_GROUPS.map(group => (
            <div key={group.label} className="mb-2">
              <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider px-1 mb-1">{group.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {group.emojis.map((em, i) => (
                  <button key={i} onClick={() => { onSelect(em); onClose(); }}
                    className="text-xl p-1.5 hover:bg-gray-700 rounded-lg transition-colors">{em}</button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Textarea con emoji picker integrado ── */
interface RichTextareaProps {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  focusColor?: string;
}
function RichTextarea({ value, onChange, rows = 4, placeholder, focusColor = "blue" }: RichTextareaProps) {
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const insertAtCursor = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) { onChange(value + emoji); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm text-gray-200 leading-relaxed resize-y focus:border-${focusColor}-500 focus:ring-2 focus:ring-${focusColor}-500/20 focus:outline-none`}
      />
      <div className="absolute bottom-2 right-2">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setShowPicker(p => !p)}
          className="text-gray-500 hover:text-yellow-400 hover:bg-gray-700 p-1.5 rounded-lg transition-colors text-base leading-none"
          title="Insertar emoji"
        >😊</button>
        {showPicker && (
          <EmojiPickerPopup
            onSelect={insertAtCursor}
            onClose={() => setShowPicker(false)}
            anchorRef={btnRef}
          />
        )}
      </div>
    </div>
  );
}

/* ── Input con emoji picker integrado ── */
interface RichInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  focusColor?: string;
}
function RichInput({ value, onChange, placeholder, focusColor = "blue" }: RichInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);

  const insertAtCursor = (emoji: string) => {
    const el = inputRef.current;
    if (!el) { onChange(value + emoji); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm text-gray-200 focus:border-${focusColor}-500 focus:outline-none`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <button
          ref={btnRef}
          type="button"
          onClick={() => setShowPicker(p => !p)}
          className="text-gray-500 hover:text-yellow-400 hover:bg-gray-700 p-1.5 rounded-lg transition-colors text-base leading-none"
          title="Insertar emoji"
        >😊</button>
        {showPicker && (
          <EmojiPickerPopup
            onSelect={insertAtCursor}
            onClose={() => setShowPicker(false)}
            anchorRef={btnRef}
          />
        )}
      </div>
    </div>
  );
}

function getStepName(id: string): string {
  const map: Record<string, string> = {
    start: "Menú principal", servicios: "Servicios", horarios: "Horarios",
    ubicacion: "Ubicación", asesor: "Hablar con asesor", agenda_cita: "Agendar Cita",
  };
  if (map[id]) return map[id];
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");
}

const STEP_STYLES: Record<string, { emoji: string; color: string; bg: string; border: string; label: string; desc: string }> = {
  menu:     { emoji: "📋", color: "text-blue-400",   bg: "bg-blue-950/40",   border: "border-blue-700",   label: "Menú con opciones",    desc: "El cliente elige una opción" },
  message:  { emoji: "💬", color: "text-gray-300",   bg: "bg-gray-800/60",   border: "border-gray-600",   label: "Enviar información",   desc: "El bot responde y vuelve al menú" },
  location: { emoji: "📍", color: "text-orange-400", bg: "bg-orange-950/40", border: "border-orange-700", label: "Ubicación",            desc: "Envía dirección + Google Maps" },
  agenda:   { emoji: "📅", color: "text-purple-400", bg: "bg-purple-950/50", border: "border-purple-700", label: "Agendar una cita",     desc: "Flujo de agendamiento automático" },
  human:    { emoji: "🧑‍💼", color: "text-green-400",  bg: "bg-green-950/50",  border: "border-green-700",  label: "Hablar con un asesor", desc: "El bot se calla y notifica al asesor" },
  link:     { emoji: "🌐", color: "text-cyan-400",   bg: "bg-cyan-950/40",   border: "border-cyan-700",   label: "Enviar un enlace",     desc: "Manda un link (tienda, catálogo, redes)" },
  collect:  { emoji: "📝", color: "text-yellow-400", bg: "bg-yellow-950/40", border: "border-yellow-700", label: "Pedir un dato",        desc: "El bot pregunta y guarda la respuesta" },
};

function inferType(step: FlowStep): StepType {
  if ((step as any).type) return (step as any).type as StepType;
  const id = step.id.toLowerCase();
  if (["ubicacion","ubicación","location"].some(k => id.includes(k)))              return "location";
  if (["asesor","human","humano","agente","soporte"].some(k => id.includes(k)))    return "human";
  if (["agend","cita","reserva","turno"].some(k => id.includes(k)))                return "agenda";
  if (["tienda","link","web","catalogo"].some(k => id.includes(k)))                return "link";
  if (Object.keys(step.next || {}).length > 0)                                    return "menu";
  return "message";
}

const TypeModal = ({ onSelect, onClose }: { onSelect: (t: StepType) => void; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <h2 className="text-white font-semibold text-lg">¿Qué hace este paso?</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800">✕</button>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {(Object.entries(STEP_STYLES) as [StepType, any][]).map(([type, s]) => (
          <button key={type} onClick={() => { onSelect(type); onClose(); }}
            className={`text-left p-4 rounded-xl border-2 ${s.bg} ${s.border} hover:brightness-125 transition-all`}>
            <div className="text-2xl mb-2">{s.emoji}</div>
            <p className={`font-semibold text-sm ${s.color}`}>{s.label}</p>
            <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
          </button>
        ))}
      </div>
    </div>
  </div>
);

const ErrorModal = ({ errors, onClose }: { errors: string[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
    <div className="bg-gray-900 border border-red-800/50 rounded-2xl max-w-md w-full shadow-2xl">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-700">
        <span className="text-xl">⚠️</span>
        <h2 className="text-white font-semibold">Revisa estos puntos</h2>
      </div>
      <ul className="px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
        {errors.map((e, i) => <li key={i} className="text-red-300 text-sm flex gap-2"><span className="text-red-500 shrink-0">•</span>{e}</li>)}
      </ul>
      <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
        <button onClick={onClose} className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2 rounded-xl text-sm font-medium">Entendido</button>
      </div>
    </div>
  </div>
);

/* ── Logo Upload ── */
function LogoSection() {
  const { token } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchLogo = useCallback(() => {
    if (!token) return;
    api.get("/business", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setLogoUrl(r.data?.logo_url || null)).catch(() => {});
  }, [token]);

  useEffect(() => { fetchLogo(); }, [fetchLogo]);
  useRefreshOnFocus(fetchLogo);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const form = new FormData();
    form.append("logo", file);
    try {
      const res = await api.post("/business/logo", form, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setLogoUrl(res.data.logo_url);
    } catch { alert("Error subiendo el logo"); }
    finally { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!token || !confirm("¿Eliminar el logo?")) return;
    await api.delete("/business/logo", { headers: { Authorization: `Bearer ${token}` } });
    setLogoUrl(null);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
      <h2 className="text-white font-semibold text-lg mb-1">🏢 Logo de tu empresa</h2>
      <p className="text-gray-500 text-sm mb-4">Se envía cuando un cliente espera al asesor. JPG, PNG o WebP. Máx 2MB.</p>
      <div className="flex items-center gap-5">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-contain bg-gray-900 border border-gray-700 p-1" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gray-900 border-2 border-dashed border-gray-700 flex items-center justify-center text-3xl shrink-0">🏢</div>
        )}
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2">
            {uploading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Subiendo…</> : "📤 Subir logo"}
          </button>
          {logoUrl && <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-sm px-4 py-2 rounded-xl hover:bg-red-900/20 block">🗑 Eliminar logo</button>}
        </div>
      </div>
    </div>
  );
}

/* ── Menu File Upload ── */
function MenuFileSection() {
  const { token } = useAuth();
  const [menuFileUrl, setMenuFileUrl] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [fileName, setFileName]       = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMenuFile = useCallback(() => {
    if (!token) return;
    api.get("/business", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const url = r.data?.menu_file_url || null;
        setMenuFileUrl(url);
        if (url) setFileName(url.split("/").pop() || "");
      }).catch(() => {});
  }, [token]);

  useEffect(() => { fetchMenuFile(); }, [fetchMenuFile]);
  useRefreshOnFocus(fetchMenuFile);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    const form = new FormData();
    form.append("menu_file", file);
    try {
      const res = await api.post("/business/menu-file", form, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setMenuFileUrl(res.data.menu_file_url);
      setFileName(file.name);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Error subiendo el archivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!token || !confirm("¿Eliminar el archivo de menú?")) return;
    try {
      await api.delete("/business/menu-file", { headers: { Authorization: `Bearer ${token}` } });
      setMenuFileUrl(null);
      setFileName("");
    } catch { alert("Error eliminando el archivo"); }
  };

  const isImage = menuFileUrl ? /\.(jpg|jpeg|png|webp)$/i.test(menuFileUrl) : false;
  const isPdf   = menuFileUrl ? /\.pdf$/i.test(menuFileUrl) : false;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 mb-6">
      <h2 className="text-white font-semibold text-lg mb-1">🍽️ Menú / Catálogo del negocio</h2>
      <p className="text-gray-500 text-sm mb-4">
        El bot lo enviará cuando un cliente pida ver el menú o catálogo. Acepta PDF, JPG, PNG o WebP. Máx 10MB.
      </p>

      {menuFileUrl ? (
        <div className="flex items-center gap-4 bg-gray-900/60 border border-gray-700 rounded-xl p-4">
          {isImage ? (
            <img src={menuFileUrl} alt="Menú" className="w-16 h-16 rounded-lg object-cover border border-gray-700" />
          ) : isPdf ? (
            <div className="w-16 h-16 rounded-lg bg-red-900/30 border border-red-700/40 flex items-center justify-center text-3xl shrink-0">📄</div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center text-3xl shrink-0">📁</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-sm font-medium truncate">{fileName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{isImage ? "Imagen" : isPdf ? "PDF" : "Archivo"} · Listo para enviarse</p>
            <a href={menuFileUrl} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 text-xs hover:underline mt-1 inline-block">Ver archivo ↗</a>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
              {uploading ? "Subiendo…" : "📤 Cambiar"}
            </button>
            <button onClick={handleDelete} className="text-red-400 hover:text-red-300 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/20">
              🗑 Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-gray-600 transition-colors">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="text-gray-400 text-sm mb-1">Sube tu menú o catálogo</p>
          <p className="text-gray-600 text-xs mb-4">PDF, JPG, PNG o WebP — Máx 10MB</p>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2">
            {uploading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Subiendo…</> : "📤 Subir archivo"}
          </button>
        </div>
      )}

      <div className="mt-3 bg-blue-950/30 border border-blue-800/30 rounded-xl p-3">
        <p className="text-blue-300 text-xs">
          💡 <strong>Tip:</strong> Agrega una opción en el menú como <strong>"Ver menú"</strong> o <strong>"Ver catálogo"</strong> y crea un paso tipo <em>Enviar enlace</em> apuntando a la URL del archivo. El bot lo enviará automáticamente.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   STEP CARD
================================================================ */
interface StepCardProps {
  step: FlowStep; index: number; allSteps: FlowStep[];
  onChange: (s: FlowStep) => void; onDelete: () => void; onAddStep: (s: FlowStep) => void;
}

function StepCard({ step, index, allSteps, onChange, onDelete, onAddStep }: StepCardProps) {
  const [isOpen, setIsOpen]           = useState(index === 0);
  const [showTypeModal, setShowTypeModal] = useState(false);

  const type  = inferType(step);
  const style = STEP_STYLES[type] ?? STEP_STYLES.message;
  const isStart  = step.id === "start";
  const meta     = (step as any).metadata || {};
  const optCount = Object.keys(step.next || {}).length;

  const setMsg  = (msg: string) => onChange({ ...step, message: msg });
  const setMeta = (k: string, v: any) => onChange({ ...step, metadata: { ...meta, [k]: v } } as any);
  const setType = (t: StepType) => onChange({ ...step, type: t, next: {} } as any);

  /* ── Insertar número emoji en el texto del menú ──
     FIX: inserta el siguiente número ANTES del salto de línea final,
     no al final de todo el texto, para que quede dentro del mensaje
     y no después del texto ya escrito.
  */
  const insertNumberEmoji = () => {
    const em   = getEmoji(countEmojis(step.message));
    const text = step.message;
    // Si termina en salto de línea, insertar antes del último \n
    const trimmed = text.trimEnd();
    onChange({ ...step, message: trimmed === "" ? `${em} ` : `${trimmed}\n${em} ` });
  };

  /* ── Agregar opción al menú ──
     FIX: inserta la nueva opción al FINAL de la parte de texto
     pero DENTRO del mensaje, no después de otro contenido posterior.
     El texto del menú se reconstruye ordenando las opciones existentes
     y añadiendo la nueva al final, en orden.
  */
  const addMenuOption = () => {
    const existingKeys = Object.keys(step.next || {});
    const count        = existingKeys.length;
    const em           = getEmoji(count);
    const optText      = `${em} Nueva opción`;

    // Generar ID único
    const baseId = `opcion_${count + 1}`;
    let newId    = baseId, c = 2;
    while (allSteps.some(s => s.id === newId)) { newId = `${baseId}_${c}`; c++; }

    // Reconstruir el mensaje: texto del menú limpio + todas las opciones existentes + nueva opción
    // Separamos el encabezado del menú de las opciones ya listadas
    const lines      = step.message.split("\n");
    const emojiSet   = new Set(NUMBER_EMOJIS);
    // Líneas que NO son opciones numeradas (encabezado del menú)
    const headerLines = lines.filter(l => !NUMBER_EMOJIS.some(e => l.trim().startsWith(e)));
    // Líneas que SÍ son opciones numeradas existentes
    const optionLines = lines.filter(l => NUMBER_EMOJIS.some(e => l.trim().startsWith(e)));

    const newMessage = [
      ...headerLines,
      ...optionLines,
      `${optText}`,
    ].join("\n").replace(/\n{3,}/g, "\n\n"); // evitar líneas en blanco excesivas

    onChange({
      ...step,
      message: newMessage,
      next: { ...step.next, [optText]: newId },
    });
    onAddStep({ id: newId, type: "message" as any, message: "", next: {} } as FlowStep);
  };

  const renameOpt = (old: string, nw: string) => {
    if (old === nw) return;
    if (step.next[nw] !== undefined) { alert("Ya existe esa opción"); return; }
    const u: Record<string, string> = {};
    Object.entries(step.next).forEach(([k, v]) => { u[k === old ? nw : k] = v; });
    onChange({ ...step, message: step.message.replace(old, nw), next: u });
  };

  const setOptDest = (key: string, dest: string) => onChange({ ...step, next: { ...step.next, [key]: dest } });
  const delOpt     = (key: string) => { const n = { ...step.next }; delete n[key]; onChange({ ...step, next: n }); };

  const agendaServices: string[] = meta.services || [];
  const addService    = () => setMeta("services", [...agendaServices, ""]);
  const updateService = (i: number, val: string) => { const a = [...agendaServices]; a[i] = val; setMeta("services", a); };
  const removeService = (i: number) => setMeta("services", agendaServices.filter((_: any, idx: number) => idx !== i));

  const otherSteps = allSteps.filter(s => s.id !== step.id);

  return (
    <>
      {showTypeModal && <TypeModal onSelect={setType} onClose={() => setShowTypeModal(false)} />}
      <div className={`rounded-2xl border-2 overflow-hidden ${style.border}`}>
        {/* Header del card */}
        <button
          className={`w-full flex items-center gap-4 px-5 py-4 text-left ${isOpen ? style.bg : "bg-gray-800/70 hover:bg-gray-800"}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-2xl shrink-0">{style.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-white">{getStepName(step.id)}</span>
              {isStart && <span className="text-xs bg-yellow-900/60 text-yellow-400 border border-yellow-700/50 px-2 py-0.5 rounded-full">Menú principal</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.color}`}>{style.emoji} {style.label}</span>
              {optCount > 0 && <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-0.5 rounded-full">{optCount} {optCount === 1 ? "opción" : "opciones"}</span>}
            </div>
            <p className="text-gray-500 text-xs mt-0.5 truncate max-w-sm">
              {step.message ? step.message.replace(/\n/g, " ").substring(0, 70) + "…" : <span className="italic text-gray-600">Haz clic para editar</span>}
            </p>
          </div>
          <svg className={`h-5 w-5 text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className={`border-t border-gray-700/50 px-5 py-6 space-y-6 ${style.bg}`}>
            {/* Tipo de paso */}
            {!isStart && (
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">¿Qué hace este paso?</p>
                <button onClick={() => setShowTypeModal(true)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border ${style.border} bg-gray-900/60 hover:bg-gray-900/80 text-left`}>
                  <span className="text-xl">{style.emoji}</span>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${style.color}`}>{style.label}</p>
                    <p className="text-gray-500 text-xs">{style.desc}</p>
                  </div>
                  <span className="text-xs text-gray-600 bg-gray-800 border border-gray-700 px-3 py-1 rounded-lg">Cambiar</span>
                </button>
              </div>
            )}

            {/* Mensaje / texto del menú */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-200">{type === "menu" ? "📋 Texto del menú" : "💬 Mensaje del bot"}</p>
                {type === "menu" && (
                  <button onClick={insertNumberEmoji}
                    className="text-xs bg-purple-900/60 hover:bg-purple-800/70 border border-purple-700/50 text-purple-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                    <span>{getEmoji(countEmojis(step.message))}</span> Insertar número
                  </button>
                )}
              </div>
              {/* Vista previa WhatsApp */}
              <div className="bg-[#0b141a] rounded-xl p-4 mb-3 border border-gray-800/80">
                <p className="text-[10px] text-gray-600 mb-2 font-medium uppercase tracking-wider">Vista previa en WhatsApp</p>
                <div className="inline-block bg-[#202c33] rounded-xl rounded-tl-none px-4 py-3 max-w-[280px]">
                  {step.message
                    ? <p className="text-[#e9edef] text-sm whitespace-pre-wrap leading-relaxed">{step.message}</p>
                    : <p className="text-gray-600 text-sm italic">El mensaje aparecerá aquí…</p>}
                  <p className="text-[#8696a0] text-[11px] mt-2 text-right">12:00 ✓✓</p>
                </div>
              </div>
              {/* Textarea con emoji picker */}
              <RichTextarea
                value={step.message}
                onChange={setMsg}
                rows={type === "menu" ? 7 : 4}
                focusColor={type === "menu" ? "blue" : type === "human" ? "green" : type === "agenda" ? "purple" : type === "location" ? "orange" : type === "link" ? "cyan" : "blue"}
                placeholder={
                  type === "menu"     ? "👋 Hola, bienvenido a [tu negocio].\n\n1️⃣ Servicios\n2️⃣ Horarios\n\nEscribe el número de tu opción." :
                  type === "human"    ? "👨‍💼 Un asesor se comunicará contigo en breve." :
                  type === "agenda"   ? "📅 ¿Qué servicio deseas? Elige una opción:" :
                  type === "location" ? "📍 Estamos ubicados en:\n\nEscribe *menu* para volver." :
                  "Escribe el mensaje que el cliente verá…"
                }
              />
            </div>

            {/* Campos específicos por tipo */}
            {type === "location" && (
              <div>
                <p className="text-sm font-semibold text-gray-200 mb-2">🗺 Link de Google Maps</p>
                <RichInput
                  value={meta.maps_url || ""}
                  onChange={v => setMeta("maps_url", v)}
                  placeholder="https://maps.google.com/..."
                  focusColor="orange"
                />
              </div>
            )}

            {type === "link" && (
              <div>
                <p className="text-sm font-semibold text-gray-200 mb-2">🔗 Enlace</p>
                <RichInput
                  value={meta.url || ""}
                  onChange={v => setMeta("url", v)}
                  placeholder="https://mitienda.com"
                  focusColor="cyan"
                />
              </div>
            )}

            {type === "human" && (
              <>
                <div>
                  <p className="text-sm font-semibold text-gray-200 mb-2">👤 Nombre del asesor <span className="text-gray-500 font-normal text-xs">(opcional)</span></p>
                  <RichInput
                    value={meta.agent_name || ""}
                    onChange={v => setMeta("agent_name", v)}
                    placeholder="Ej: Juan Pérez — Gerente"
                    focusColor="green"
                  />
                </div>
                <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4">
                  <p className="text-green-300 text-sm leading-relaxed">
                    🧑‍💼 El bot se calla, envía el logo de tu empresa + mensaje de espera al cliente, y te notifica. El cliente escribe <strong className="text-green-200">menu</strong> para volver al bot.
                  </p>
                </div>
              </>
            )}

            {type === "agenda" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-200">🛎 Servicios disponibles</p>
                    <p className="text-gray-500 text-xs mt-0.5">El cliente elige uno y el bot notifica al asesor</p>
                  </div>
                  <button onClick={addService} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">+ Agregar</button>
                </div>
                <div className="space-y-2 mb-4">
                  {agendaServices.map((svc: string, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-900/70 rounded-xl border border-gray-700 px-4 py-3">
                      <span className="text-purple-400 font-bold text-sm shrink-0">{getEmoji(i)}</span>
                      <input value={svc} onChange={e => updateService(i, e.target.value)}
                        className="flex-1 bg-transparent text-gray-200 text-sm focus:outline-none placeholder-gray-600"
                        placeholder="Ej: Corte de cabello…" />
                      <button onClick={() => removeService(i)} className="text-red-500/50 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {agendaServices.length === 0 && (
                    <div className="border-2 border-dashed border-purple-800/40 rounded-xl p-5 text-center">
                      <p className="text-gray-600 text-sm">Agrega los servicios de tu negocio</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Duración del servicio</label>
                    <select value={meta.duration_minutes || 30} onChange={e => setMeta("duration_minutes", parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-purple-700/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none">
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos</option>
                      <option value={45}>45 minutos</option>
                      <option value={60}>1 hora</option>
                      <option value={90}>1 hora y media</option>
                      <option value={120}>2 horas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Nombre del servicio</label>
                    <input value={meta.service || ""} onChange={e => setMeta("service", e.target.value)}
                      className="w-full bg-gray-900 border border-purple-700/40 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                      placeholder="Corte, Masaje, Consulta…" />
                  </div>
                </div>
              </div>
            )}

            {type === "menu" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-200">🔢 Opciones del menú</p>
                    <p className="text-gray-500 text-xs mt-0.5">Al agregar una opción se crea su paso automáticamente</p>
                  </div>
                  <button onClick={addMenuOption} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">+ Agregar opción</button>
                </div>
                <div className="space-y-3">
                  {Object.entries(step.next).map(([key, val], oi) => {
                    const dest = allSteps.find(s => s.id === val);
                    return (
                      <div key={`${step.id}-opt-${oi}`} className="bg-gray-900/70 rounded-xl border border-gray-700 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-900/60 border border-blue-700/40 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0 mt-1">{oi + 1}</div>
                          <div className="flex-1 space-y-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1.5">Texto que ve el cliente:</label>
                              <input value={key} onChange={e => renameOpt(key, e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none"
                                placeholder="Ej: 1️⃣ Ver servicios" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1.5">
                                Lleva al paso: {dest && <span className="text-green-500 font-semibold ml-1">✓ {getStepName(dest.id)}</span>}
                                {val && !dest && <span className="text-yellow-500 ml-1">⚠ ese paso no existe</span>}
                              </label>
                              <select value={val} onChange={e => setOptDest(key, e.target.value)}
                                className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none ${dest && val ? "border-green-700/50" : "border-gray-600"}`}>
                                <option value="">— Elige a dónde va —</option>
                                {otherSteps.map(s => {
                                  const st = STEP_STYLES[inferType(s)] ?? STEP_STYLES.message;
                                  return <option key={s.id} value={s.id}>{st.emoji} {getStepName(s.id)}</option>;
                                })}
                              </select>
                            </div>
                          </div>
                          <button onClick={() => delOpt(key)} className="text-red-500/50 hover:text-red-400 hover:bg-red-900/20 p-2 rounded-lg shrink-0 mt-1">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {optCount === 0 && (
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-5 text-center">
                      <p className="text-gray-600 text-sm">Agrega al menos una opción</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {type === "message" && (
              <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3">
                <p className="text-gray-400 text-xs">💬 El bot envía este mensaje y vuelve automáticamente al menú principal.</p>
              </div>
            )}

            {!isStart && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-700/50">
                <p className="text-gray-700 text-xs">ID: <code className="text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{step.id}</code></p>
                <button onClick={onDelete} className="text-red-500/60 hover:text-red-400 text-sm flex items-center gap-1.5 hover:bg-red-900/20 px-3 py-2 rounded-xl">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Eliminar este paso
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================
   SETTINGS PAGE
================================================================ */
export default function Settings() {
  const { token } = useAuth();
  const [flow, setFlow]             = useState<BotFlow | null>(null);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError]   = useState("");
  const [valErrors, setValErrors]   = useState<string[]>([]);
  const [showValModal, setShowValModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    getBotConfig(token).then(cfg => {
      if (!cfg) {
        setFlow({ steps: [{ id: "start", type: "menu" as any, message: "👋 Hola, bienvenido.\n\nEscribe el número de tu opción.", next: {} }] });
        return;
      }
      const p = typeof cfg.flow_json === "string" ? JSON.parse(cfg.flow_json) : cfg.flow_json;
      setFlow(p?.steps ? p : { steps: [] });
    }).catch(() => setLoadError("No se pudo cargar. Recarga la página."));
  }, [token]);

  const save = useCallback(async () => {
    if (!flow || !token || saveStatus === "saving") return;
    const { valid, errors } = validateBotFlow(flow);
    if (!valid) { setValErrors(errors); setShowValModal(true); return; }
    setSaveStatus("saving"); setSaveError("");
    const r = await updateBotFlow(token, flow);
    if (r.ok) { setSaveStatus("success"); setTimeout(() => setSaveStatus("idle"), 3500); }
    else { setSaveStatus("error"); setSaveError(r.error ?? "Error guardando"); setTimeout(() => setSaveStatus("idle"), 5000); }
  }, [flow, token, saveStatus]);

  const updateStep = useCallback((i: number, s: FlowStep) => {
    setFlow(p => { if (!p) return p; const steps = [...p.steps]; steps[i] = s; return { ...p, steps }; });
  }, []);

  const addStep = useCallback((newStep?: FlowStep) => {
    setFlow(p => {
      if (!p) return p;
      if (newStep) return { ...p, steps: [...p.steps, newStep] };
      let c = 1, id = `paso_${c}`;
      while (p.steps.some(s => s.id === id)) { c++; id = `paso_${c}`; }
      return { ...p, steps: [...p.steps, { id, type: "message" as any, message: "", next: {} }] };
    });
  }, []);

  const deleteStep = useCallback((i: number) => {
    setFlow(p => {
      if (!p) return p;
      if (p.steps[i].id === "start") { alert("El menú principal no puede eliminarse."); return p; }
      if (!confirm("¿Eliminar este paso?")) return p;
      return { ...p, steps: p.steps.filter((_, idx) => idx !== i) };
    });
  }, []);

  if (loadError) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 border border-red-800/40 rounded-2xl p-8 max-w-sm text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="text-red-400 mb-4">{loadError}</p>
        <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm">Recargar</button>
      </div>
    </div>
  );

  if (!flow) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );

  return (
    <>
      {showValModal && <ErrorModal errors={valErrors} onClose={() => setShowValModal(false)} />}
      <div className="min-h-screen bg-gray-900">
        {/* Topbar */}
        <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-white font-bold text-xl">🤖 Configuración del Bot</h1>
              <p className="text-gray-500 text-xs mt-0.5">Los cambios se aplican al instante</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {saveStatus === "success" && (
                <span className="text-green-400 text-sm flex items-center gap-1.5">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  ¡Guardado!
                </span>
              )}
              {saveStatus === "error" && <span className="text-red-400 text-sm">{saveError}</span>}
              <button onClick={() => addStep()}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium">
                + Nuevo paso
              </button>
              <button onClick={save} disabled={saveStatus === "saving"}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 min-w-[120px] justify-center">
                {saveStatus === "saving"
                  ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Guardando…</>
                  : "💾 Guardar"}
              </button>
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <LogoSection />
          <MenuFileSection />
          <div className="space-y-4">
            {flow.steps.map((step, i) => (
              <StepCard
                key={`${step.id}-${i}`}
                step={step} index={i} allSteps={flow.steps}
                onChange={s => updateStep(i, s)}
                onDelete={() => deleteStep(i)}
                onAddStep={s => addStep(s)}
              />
            ))}
            {flow.steps.length === 0 && (
              <div className="text-center py-20">
                <p className="text-6xl mb-4">🤖</p>
                <h3 className="text-white font-bold text-xl mb-2">Tu bot está vacío</h3>
                <button onClick={() => addStep()} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-semibold">
                  Crear primer paso
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

