import { useState, FormEvent, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DEMO_MESSAGES = [
  { from: "client", text: "Hola! quiero saber los horarios" },
  { from: "bot",    text: "🕒 Horario de atención:\nLunes a Viernes 8:00 AM - 6:00 PM\nSábados 9:00 AM - 2:00 PM" },
  { from: "client", text: "Perfecto, ¿puedo agendar una cita?" },
  { from: "bot",    text: "📅 Con gusto. ¿Qué servicio deseas?\n\n1️⃣ Corte de cabello\n2️⃣ Cuidado de barba\n3️⃣ Tratamiento capilar" },
  { from: "client", text: "1" },
  { from: "bot",    text: "✅ ¡Cita confirmada!\n\nServicio: Corte de cabello\nFecha: Mañana 10:00 AM\n\nTe esperamos 💈" },
];

function AnimatedChat() {
  const [visible, setVisible] = useState<number[]>([0]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = () => {
      const i = indexRef.current;

      if (i >= DEMO_MESSAGES.length) {
        // Esperar 4s y reiniciar desde el mensaje 0 sin pantalla en blanco
        timerRef.current = setTimeout(() => {
          setTyping(false);
          setVisible([0]);
          indexRef.current = 1;
          timerRef.current = setTimeout(show, 1200);
        }, 4000);
        return;
      }

      setTyping(true);
      timerRef.current = setTimeout(() => {
        setTyping(false);
        setVisible(prev => [...prev, i]);
        indexRef.current = i + 1;
        timerRef.current = setTimeout(show, 1200);
      }, 900);
    };

    timerRef.current = setTimeout(show, 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Auto-scroll al último mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible, typing]);

  return (
    <div className="w-full max-w-sm flex-shrink-0">
      <div className="bg-[#111b21] rounded-3xl shadow-2xl overflow-hidden border border-gray-800 flex flex-col" style={{ height: "420px" }}>
        {/* Header */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm">🤖</div>
          <div>
            <p className="text-white text-sm font-semibold">Bot Empresarial</p>
            <p className="text-green-400 text-xs">en línea</p>
          </div>
        </div>

        {/* Messages — scroll interno */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#0b141a]" style={{ scrollbarWidth: "none" }}>
          {visible.map((idx) => {
            const msg = DEMO_MESSAGES[idx];
            const isBot = msg.from === "bot";
            return (
              <div key={`${idx}-${visible.length}`} className={`flex ${isBot ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${
                  isBot
                    ? "bg-[#202c33] text-[#e9edef] rounded-tl-none"
                    : "bg-[#005c4b] text-[#e9edef] rounded-tr-none"
                }`}>
                  {msg.text}
                  <span className="text-[10px] text-gray-500 ml-2 float-right mt-1">
                    {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    {!isBot && " ✓✓"}
                  </span>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex justify-start">
              <div className="bg-[#202c33] px-4 py-3 rounded-xl rounded-tl-none flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 text-gray-500 text-sm">Escribe un mensaje…</div>
          <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm">➤</div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [notVerified, setNotVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotVerified(false);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true);
      } else {
        setError(err?.response?.data?.error || "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch((import.meta as any).env.VITE_API_URL + "/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendOk(true);
    } catch {} finally { setResending(false); }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* LEFT — Demo animada — altura fija, sin scroll */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#0a0a0a] border-r border-gray-800 px-8 gap-8 overflow-hidden">
        <div className="text-center max-w-sm flex-shrink-0">
          <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-700/40 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Bot activo 24/7
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
            Automatiza tu WhatsApp<br/>
            <span className="text-green-400">con inteligencia artificial</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Responde clientes, agenda citas y genera ventas automáticamente — sin perder ningún mensaje.
          </p>
        </div>

        <AnimatedChat />

        {/* Stats */}
        <div className="flex gap-8 text-center flex-shrink-0">
          {[
            { value: "24/7", label: "Disponible" },
            { value: "< 1s", label: "Respuesta" },
            { value: "100%", label: "Automatizado" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — Formulario — fijo, sin moverse */}
      <div className="flex flex-1 items-center justify-center px-6 bg-gray-950 overflow-hidden">
        <div className="w-full max-w-md flex-shrink-0">
          <div className="mb-8 text-center">
            <div className="text-3xl mb-2">🤖</div>
            <h2 className="text-2xl font-bold text-white">MR.ROBOT COL</h2>
            <p className="text-gray-500 text-sm mt-1">Inicia sesión en tu panel</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            {error && (
              <div className="mb-4 bg-red-900/30 border border-red-800/50 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            {notVerified && (
              <div className="mb-4 bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm px-4 py-3 rounded-xl">
                <p className="font-semibold mb-1">📧 Verifica tu email</p>
                <p className="text-yellow-400/80 mb-2">Revisa tu correo y haz clic en el link de verificación antes de iniciar sesión.</p>
                {resendOk ? (
                  <p className="text-green-400 text-xs">✓ Email reenviado. Revisa tu bandeja.</p>
                ) : (
                  <button onClick={handleResend} disabled={resending}
                    className="text-yellow-300 underline text-xs hover:text-yellow-200 transition-colors">
                    {resending ? "Enviando…" : "¿No lo recibiste? Reenviar email"}
                  </button>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Correo electrónico</label>
                <input
                  type="email"
                  placeholder="tu@empresa.com"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all placeholder-gray-600"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all placeholder-gray-600"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Ingresando…</>
                ) : "Ingresar →"}
              </button>
            </form>
          </div>

          <p className="text-sm text-gray-500 mt-6 text-center">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="text-green-400 hover:text-green-300 font-medium transition-colors">
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

