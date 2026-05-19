import { useEffect, useState, useCallback } from "react";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAuth } from "../context/AuthContext";
import { getDashboard } from "../api/dashboard";
import { getBotQR, getBotStatus } from "../api/bot";
import QRModal from "../components/QRModal";

interface Business {
  id: string;
  name: string;
  subscription_status: string;
  subscription_end: string | null;
  days_remaining: number;
  messages_used: number;
  message_limit: number;
  plan_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

type BotStatus = "online" | "offline" | "qr" | "connecting" | "loading";

const Dashboard = () => {
  const { token } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus>("loading");
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrError, setQrError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!token) return;
    getDashboard(token)
      .then((data) => {
        setBusiness(data.business);
        setPlan(data.plan);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useRefreshOnFocus(fetchDashboard);

  const checkBotStatus = useCallback(async () => {
    if (!token || !business) return;
    try {
      const res = await getBotStatus(token, business.id);
      if (!res.ok) {
        setBotStatus("offline");
        return;
      }
      const s = res.data?.status;
      if (s === "online") setBotStatus("online");
      else if (s === "qr") setBotStatus("qr");
      else if (s === "connecting") setBotStatus("connecting");
      else setBotStatus("offline");
    } catch {
      setBotStatus("offline");
    }
  }, [token, business]);

  useEffect(() => {
    if (!business) return;
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 8000);
    return () => clearInterval(interval);
  }, [business, checkBotStatus]);

  const handleShowQR = async () => {
    if (!token || !business) return;
    setQrError("");
    setLoadingQR(true);
    try {
      const res = await getBotQR(token, business.id);
      const qrCode = res.data?.qr;
      if (res.ok && qrCode) {
        setQr(qrCode);
      } else {
        setQrError(
          res.error ??
          "QR no disponible aún. El bot puede estar iniciando — espera unos segundos e intenta de nuevo."
        );
      }
    } catch {
      setQrError("No se pudo obtener el QR.");
    } finally {
      setLoadingQR(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-7 w-7 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-400 text-sm">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400">
        Error cargando datos
      </div>
    );
  }

  const daysRemaining = business.subscription_end
    ? Math.max(
        Math.ceil(
          (new Date(business.subscription_end).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        ),
        0
      )
    : 30;

  const usagePercent =
    business.message_limit > 0
      ? Math.min((business.messages_used / business.message_limit) * 100, 100)
      : 0;

  const statusColors: Record<BotStatus, {
    bg: string; border: string; dot: string; text: string; label: string;
  }> = {
    online: {
      bg: "bg-green-900/30", border: "border-green-700",
      dot: "bg-green-400", text: "text-green-300", label: "Conectado ✅",
    },
    qr: {
      bg: "bg-yellow-900/30", border: "border-yellow-700",
      dot: "bg-yellow-400 animate-pulse", text: "text-yellow-300", label: "Esperando QR 📲",
    },
    connecting: {
      bg: "bg-blue-900/30", border: "border-blue-700",
      dot: "bg-blue-400 animate-pulse", text: "text-blue-300", label: "Iniciando… ⚙️",
    },
    offline: {
      bg: "bg-red-900/30", border: "border-red-700",
      dot: "bg-red-400", text: "text-red-300", label: "Desconectado ❌",
    },
    loading: {
      bg: "bg-gray-800", border: "border-gray-600",
      dot: "bg-gray-500 animate-pulse", text: "text-gray-400", label: "Verificando…",
    },
  };

  const sc = statusColors[botStatus];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">{business.name}</p>
      </div>

      {/* GRID TOP */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">

        {/* PLAN */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Plan Actual</p>
          <p className="text-2xl font-bold text-green-400">{plan?.name || "Trial"}</p>
          <p className="text-gray-500 text-sm mt-1">
            ${plan?.price ?? "0"} / {plan?.duration_days ?? 30} días
          </p>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <span
              className={`text-xs font-bold px-2 py-1 rounded-full ${
                business.subscription_status === "trial"
                  ? "bg-blue-900 text-blue-300"
                  : business.subscription_status === "active"
                  ? "bg-green-900 text-green-300"
                  : "bg-red-900 text-red-300"
              }`}
            >
              {business.subscription_status?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* SUSCRIPCIÓN */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Suscripción</p>
          <p className="text-2xl font-bold text-white">
            {daysRemaining}{" "}
            <span className="text-base font-normal text-gray-400">días</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">Tiempo restante</p>
          <div className="mt-4 pt-4 border-t border-gray-700">
            {daysRemaining <= 5 ? (
              <p className="text-xs text-red-400 font-semibold">⚠️ Próximo a vencer</p>
            ) : (
              <p className="text-xs text-gray-500">
                Vence:{" "}
                {business.subscription_end
                  ? new Date(business.subscription_end).toLocaleDateString("es-CO")
                  : "N/A"}
              </p>
            )}
          </div>
        </div>

        {/* WHATSAPP STATUS */}
        <div className={`rounded-xl border-2 p-6 ${sc.bg} ${sc.border} transition-all`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">WhatsApp Bot</p>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full shrink-0 ${sc.dot}`} />
            <p className={`text-lg font-bold ${sc.text}`}>{sc.label}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            {botStatus !== "online" ? (
              <button
                onClick={handleShowQR}
                disabled={loadingQR || botStatus === "loading" || botStatus === "connecting"}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 rounded-lg transition"
              >
                {loadingQR ? "Generando…" : "📲 Conectar WhatsApp"}
              </button>
            ) : (
              <button
                onClick={handleShowQR}
                disabled={loadingQR}
                className="w-full border border-gray-600 hover:bg-gray-700 disabled:opacity-50 text-gray-400 text-sm py-2 rounded-lg transition"
              >
                {loadingQR ? "Generando…" : "🔄 Reconectar"}
              </button>
            )}
            {qrError && <p className="text-xs text-red-400 mt-2">{qrError}</p>}
          </div>
        </div>

      </div>

      {/* USO DE MENSAJES */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Uso de Mensajes</h2>
          <span className="text-sm text-gray-400">
            {business.messages_used} / {business.message_limit}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              usagePercent > 80
                ? "bg-red-500"
                : usagePercent > 50
                ? "bg-yellow-500"
                : "bg-green-500"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <p className="text-xs text-gray-500">{usagePercent.toFixed(0)}% utilizado</p>
          <p className="text-xs text-gray-500">
            {business.message_limit - business.messages_used} restantes
          </p>
        </div>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Mensajes Enviados", value: business.messages_used, icon: "💬", color: "text-blue-400" },
          { label: "Días Restantes", value: daysRemaining, icon: "📅", color: "text-purple-400" },
          { label: "Límite Mensajes", value: business.message_limit, icon: "📊", color: "text-yellow-400" },
          {
            label: "Estado Bot",
            value: botStatus === "online" ? "Activo" : botStatus === "connecting" ? "Iniciando" : "Inactivo",
            icon: "🤖",
            color: botStatus === "online" ? "text-green-400" : botStatus === "connecting" ? "text-blue-400" : "text-red-400",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
            <p className="text-2xl mb-1">{stat.icon}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {qr && <QRModal qr={qr} onClose={() => setQr(null)} />}
    </div>
  );
};

export default Dashboard;

// TEST_MARKER_XYZ_123
