import { useEffect, useState, useCallback } from "react";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useAuth } from "../context/AuthContext";
import { getDashboard } from "../api/dashboard";
import api from "../api/client";

const Billing = () => {
  const { token } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      getDashboard(token),
      api.get("/plan/list", { headers: { Authorization: `Bearer ${token}` } }),
    ]).then(([dash, plansRes]) => {
      setBusiness(dash.business);
      setCurrentPlan(dash.plan);
      // Filtrar el plan Trial de la lista de planes disponibles para comprar
      setPlans((plansRes.data || []).filter((p: any) => p.price > 0));
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [token]);

  const handleSelectPlan = async (planId: string) => {
    if (!token || paying) return;
    setPaying(planId);
    try {
      const res = await api.post("/payments/create",
        { plan_id: planId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.init_point) {
        window.location.href = res.data.init_point;
      }
    } catch (err) {
      alert("Error al procesar el pago. Intenta de nuevo.");
    } finally {
      setPaying(null);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(price);

  const daysRemaining = business?.subscription_end
    ? Math.max(Math.ceil((new Date(business.subscription_end + "Z").getTime() - Date.now()) / (1000*60*60*24)), 0)
    : 30;

  const isActive = business?.subscription_status === "active";
  const isTrial  = business?.subscription_status === "trial" || !business?.subscription_status;

  // Ícono por nombre de plan
  const getPlanIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("emprend")) return "🚀";
    if (n.includes("profes")) return "⚡";
    if (n.includes("empresa")) return "🏢";
    return "📦";
  };

  // Features por plan
  const getPlanFeatures = (plan: any) => {
    const n = plan.name.toLowerCase();
    const convs = plan.max_conversations === 999999 ? "Ilimitadas" : plan.max_conversations.toLocaleString("es-CO");
    if (n.includes("emprend")) return [
      "1 número WhatsApp",
      `${convs} conversaciones/mes`,
      "Flujos básicos",
      "Notificaciones en tiempo real",
      "Soporte por email",
    ];
    if (n.includes("profes")) return [
      "1 número WhatsApp",
      `${convs} conversaciones/mes`,
      "Flujos avanzados",
      "Agendamiento automático",
      "Campañas masivas",
      "Soporte prioritario",
    ];
    if (n.includes("empresa")) return [
      "Múltiples números WhatsApp",
      `${convs} conversaciones`,
      "Flujos ilimitados",
      "Campañas + Analytics",
      "API personalizada",
      "Soporte 24/7",
    ];
    return [`${convs} conversaciones/mes`];
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin h-7 w-7 text-green-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
        </svg>
        <p className="text-gray-400 text-sm">Cargando facturación…</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Facturación</h1>
        <p className="text-gray-400 mt-1">Gestiona tu plan y suscripción</p>
      </div>

      {/* PLAN ACTUAL */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Plan Actual</h2>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            isActive ? "bg-green-900/40 text-green-300 border-green-700/50" :
            isTrial  ? "bg-blue-900/40 text-blue-300 border-blue-700/50" :
                       "bg-red-900/40 text-red-300 border-red-700/50"
          }`}>
            {isActive ? "✓ ACTIVO" : isTrial ? "PRUEBA GRATUITA" : "VENCIDO"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{currentPlan?.name || "Trial"}</p>
            <p className="text-xs text-gray-500 mt-1">Plan</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {currentPlan?.price ? formatPrice(currentPlan.price) : "$0"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Precio/mes</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${daysRemaining > 7 ? "text-purple-400" : "text-red-400"}`}>
              {daysRemaining}
            </p>
            <p className="text-xs text-gray-500 mt-1">Días restantes</p>
          </div>
        </div>

        {daysRemaining <= 7 && daysRemaining > 0 && (
          <div className="mt-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
            <p className="text-yellow-300 text-sm">⚠️ Tu plan vence en {daysRemaining} días. Renueva para no perder el servicio.</p>
          </div>
        )}
        {daysRemaining === 0 && (
          <div className="mt-4 bg-red-900/20 border border-red-700/40 rounded-xl p-3">
            <p className="text-red-300 text-sm">❌ Tu plan ha vencido. Selecciona un plan para reactivar el bot.</p>
          </div>
        )}
      </div>

      {/* PLANES DISPONIBLES */}
      <h2 className="text-lg font-semibold text-white mb-4">Planes disponibles</h2>
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        {plans.map((plan, idx) => {
          const isPopular = idx === 1;
          const isCurrent = currentPlan?.id === plan.id;
          const features = getPlanFeatures(plan);
          const icon = getPlanIcon(plan.name);
          return (
            <div key={plan.id} className={`rounded-2xl border p-6 relative flex flex-col ${
              isPopular
                ? "border-green-600 bg-green-900/10"
                : "border-gray-700 bg-gray-800"
            }`}>
              {isPopular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MÁS POPULAR
                </span>
              )}
              <div className="mb-4">
                <div className="text-2xl mb-2">{icon}</div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <p className="text-3xl font-bold text-white mt-2">
                  {formatPrice(plan.price)}
                  <span className="text-base font-normal text-gray-500">/mes</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {plan.max_conversations === 999999
                    ? "Conversaciones ilimitadas"
                    : `${plan.max_conversations.toLocaleString("es-CO")} conversaciones/mes`}
                </p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {features.map((f: string) => (
                  <li key={f} className="text-sm text-gray-400 flex items-start gap-2">
                    <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !isCurrent && handleSelectPlan(plan.id)}
                disabled={isCurrent || paying === plan.id}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isCurrent
                    ? "bg-gray-700 text-gray-500 cursor-default"
                    : isPopular
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : "border border-gray-600 hover:bg-gray-700 text-gray-300"
                }`}
              >
                {paying === plan.id ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Procesando…</>
                ) : isCurrent ? "Plan actual ✓"
                : "Seleccionar plan →"}
              </button>
            </div>
          );
        })}
      </div>

      {/* INFO TRIAL */}
      {isTrial && (
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-2xl p-5">
          <p className="font-semibold text-blue-200 mb-1">ℹ️ Período de prueba gratuito</p>
          <p className="text-blue-300 text-sm">
            Tienes <strong>{daysRemaining} días</strong> restantes en tu prueba gratuita con 200 conversaciones incluidas.
            Elige un plan antes de que venza para mantener el bot activo sin interrupciones.
          </p>
        </div>
      )}

      {/* INFO PAGO */}
      <div className="mt-4 bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
        <p className="text-gray-400 text-xs leading-relaxed">
          🔒 Pagos procesados de forma segura por <strong className="text-gray-300">MercadoPago</strong>.
          Aceptamos tarjetas de crédito/débito, PSE, Nequi y Daviplata.
          Al seleccionar un plan serás redirigido al checkout seguro de MercadoPago.
        </p>
      </div>
    </div>
  );
};

export default Billing;

