import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getDashboard } from "../api/dashboard";
import { getBotQR, getBotStatus } from "../api/bot";
import QRModal from "../components/QRModal";
import api from "../api/client";

type BotStatus = "online" | "offline" | "qr" | "connecting" | "loading";

const Connections = () => {
  const { token } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [status, setStatus] = useState<BotStatus>("loading");
  const [qr, setQr] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [loadingQR, setLoadingQR] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    getDashboard(token)
      .then((data) => setBusinessId(data.business?.id ?? null))
      .catch(console.error);
  }, [token]);

  const checkStatus = useCallback(async () => {
    if (!token || !businessId) return;
    try {
      const res = await getBotStatus(token, businessId);
      if (!res.ok) { setStatus("offline"); return; }
      const s = res.data?.status;
      if (s === "online") setStatus("online");
      else if (s === "qr") setStatus("qr");
      else if (s === "connecting") setStatus("connecting");
      else setStatus("offline");
    } catch { setStatus("offline"); }
  }, [token, businessId]);

  useEffect(() => {
    if (!businessId) return;
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [businessId, checkStatus]);

  const handleConnect = async () => {
    if (!token || !businessId) return;
    setError(""); setSuccessMsg("");
    setLoadingQR(true);
    try {
      const res = await getBotQR(token, businessId);
      const qrCode = res.data?.qr;
      if (res.ok && qrCode) { setQr(qrCode); setShowQR(true); }
      else setError(res.error ?? "QR no disponible todavía. Espera unos segundos e intenta de nuevo.");
    } catch { setError("No se pudo obtener el QR."); }
    finally { setLoadingQR(false); }
  };

  const handleReset = async () => {
    if (!token || !businessId) return;
    if (!confirm("¿Resetear la sesión de WhatsApp?\n\nEsto desconectará el bot y generará un nuevo QR.")) return;
    setResetting(true);
    setError(""); setSuccessMsg("");
    try {
      await api.post(`/bot/reset-session/${businessId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus("connecting");
      setSuccessMsg("Sesión reseteada. En unos segundos haz clic en Generar QR.");
      setTimeout(() => checkStatus(), 8000);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error reseteando sesión");
    } finally { setResetting(false); }
  };

  const statusConfig: Record<BotStatus, { color: string; dot: string; label: string; description: string; textColor: string; }> = {
    online:     { color: "bg-green-900/30 border-green-700",   dot: "bg-green-400",                label: "Conectado",            description: "Tu WhatsApp está activo y respondiendo mensajes automáticamente.", textColor: "text-green-300" },
    qr:         { color: "bg-yellow-900/30 border-yellow-700", dot: "bg-yellow-400 animate-pulse", label: "Esperando escaneo QR", description: "El bot generó un QR. Escanéalo con tu WhatsApp para activarlo.",    textColor: "text-yellow-300" },
    connecting: { color: "bg-blue-900/30 border-blue-700",     dot: "bg-blue-400 animate-pulse",   label: "Iniciando bot…",       description: "El bot se está iniciando, esto puede tomar hasta 30 segundos.",   textColor: "text-blue-300" },
    offline:    { color: "bg-red-900/30 border-red-700",       dot: "bg-red-400",                  label: "Desconectado",         description: "El bot no está conectado. Conéctate escaneando el código QR.",    textColor: "text-red-300" },
    loading:    { color: "bg-gray-800 border-gray-600",        dot: "bg-gray-500 animate-pulse",   label: "Verificando…",         description: "Comprobando estado de la conexión.",                              textColor: "text-gray-400" },
  };

  const cfg = statusConfig[status];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Conexiones WhatsApp</h1>
      <p className="text-gray-400 mb-8">Vincula tu número de WhatsApp para activar el bot automático.</p>

      <div className={`rounded-xl border-2 p-6 mb-6 transition-all ${cfg.color}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`font-bold text-lg ${cfg.textColor}`}>{cfg.label}</span>
        </div>
        <p className={`text-sm ${cfg.textColor} opacity-80`}>{cfg.description}</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm flex gap-2"><span>⚠️</span><span>{error}</span></div>}
      {successMsg && <div className="mb-4 p-3 bg-green-900/40 border border-green-700 text-green-300 rounded-lg text-sm flex gap-2"><span>✅</span><span>{successMsg}</span></div>}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="font-semibold text-lg text-white">{status === "online" ? "Gestión de conexión" : "Conectar WhatsApp"}</h2>

        {status !== "online" && (
          <>
            <div className="bg-gray-900 rounded-lg p-4 text-sm text-gray-400 space-y-2">
              <p className="font-semibold text-gray-300">Pasos para conectar:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Haz clic en <strong className="text-gray-200">Generar código QR</strong></li>
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Ve a <strong className="text-gray-200">Dispositivos vinculados</strong> → <strong className="text-gray-200">Vincular dispositivo</strong></li>
                <li>Escanea el código QR que aparece en pantalla</li>
              </ol>
            </div>
            <button onClick={handleConnect} disabled={loadingQR || status === "loading" || status === "connecting"}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:text-green-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2">
              {loadingQR ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Generando QR…</> : status === "qr" ? "👁 Ver QR nuevamente" : "📲 Generar código QR"}
            </button>
          </>
        )}

        {status === "online" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-green-900/20 border border-green-800 rounded-lg">
              <div><p className="font-semibold text-green-300">🤖 Bot activo</p><p className="text-sm text-green-500">Respondiendo mensajes automáticamente</p></div>
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            </div>
            <button onClick={handleConnect} disabled={loadingQR}
              className="w-full border border-gray-600 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm">
              {loadingQR ? "Generando…" : "🔄 Reconectar (nuevo QR)"}
            </button>
          </div>
        )}

        <div className="border-t border-gray-700 pt-4">
          <p className="text-xs text-gray-500 mb-3">¿Cambiaste de celular o formateaste tu teléfono? Resetea la sesión para escanear un nuevo QR.</p>
          <button onClick={handleReset} disabled={resetting}
            className="w-full border border-red-800/60 hover:bg-red-900/20 disabled:opacity-50 text-red-400 hover:text-red-300 font-medium py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
            {resetting ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Reseteando…</> : "🔁 Resetear sesión de WhatsApp"}
          </button>
        </div>
      </div>

      <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-xl p-4 text-sm text-blue-300">
        <p className="font-semibold text-blue-200 mb-2">ℹ️ Importante</p>
        <ul className="space-y-1.5 list-disc list-inside text-blue-400">
          <li>Solo necesitas escanear el QR una vez por dispositivo.</li>
          <li>Si cambias de celular, usa <strong className="text-blue-300">Resetear sesión</strong> y escanea el nuevo QR.</li>
          <li>El bot sigue activo aunque cierres sesión en este panel.</li>
          <li>Si el QR no aparece, espera 10 segundos y vuelve a intentarlo.</li>
        </ul>
      </div>

      {showQR && qr && <QRModal qr={qr} onClose={() => { setShowQR(false); setQr(null); }} />}
    </div>
  );
};

export default Connections;
