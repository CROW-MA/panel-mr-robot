import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PLANS = [
  {
    id: "trial",
    name: "Trial",
    price: "Gratis",
    duration: "30 días",
    features: ["200 conversaciones", "1 agente", "1 número"],
    badge: "",
  },
  {
    id: "emprendedor",
    name: "Emprendedor",
    price: "$39.900",
    duration: "mes",
    features: ["1.000 mensajes", "1 agente"],
    badge: "",
  },
  {
    id: "profesional",
    name: "Profesional",
    price: "$89.900",
    duration: "mes",
    features: ["5.000 mensajes", "3 agentes"],
    badge: "Popular",
  },
  {
    id: "empresa",
    name: "Empresa",
    price: "$199.900",
    duration: "mes",
    features: ["Ilimitado", "10 agentes"],
    badge: "",
  },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState("trial");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [businessName, setBusinessName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("Mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      await register(email, password, businessName);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-5xl">

        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">MR.ROBOT</h1>
          <p className="text-green-500 text-sm">COL</p>
          <p className="text-gray-400 mt-2 text-sm">
            Automatiza tu WhatsApp con IA
          </p>
        </div>

        {/* STEPS */}
        <div className="flex justify-center mb-10 gap-6">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s
                    ? "bg-green-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {s}
              </div>
              <span className={step >= s ? "text-white" : "text-gray-500"}>
                {s === 1 ? "Plan" : "Cuenta"}
              </span>
            </div>
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <h2 className="text-xl text-white text-center mb-6">
              Selecciona tu plan
            </h2>

            <div className="grid md:grid-cols-4 gap-4">

              {PLANS.map((plan) => {
                const active = selectedPlan === plan.id;

                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`p-5 rounded-xl border cursor-pointer transition ${
                      active
                        ? "border-green-500 bg-[#111]"
                        : "border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {plan.badge && (
                      <div className="text-xs bg-green-600 text-white px-2 py-1 rounded mb-2 inline-block">
                        {plan.badge}
                      </div>
                    )}

                    <h3 className="text-white font-semibold">
                      {plan.name}
                    </h3>

                    <p className="text-2xl text-green-500 font-bold">
                      {plan.price}
                    </p>

                    <p className="text-xs text-gray-500 mb-3">
                      /{plan.duration}
                    </p>

                    <ul className="text-xs text-gray-400 space-y-1">
                      {plan.features.map((f, i) => (
                        <li key={i}>✓ {f}</li>
                      ))}
                    </ul>

                  </div>
                );
              })}
            </div>

            <div className="text-center mt-8">
              <button
                onClick={() => setStep(2)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="max-w-md mx-auto bg-[#111] p-8 rounded-2xl border border-gray-800">

            <button
              onClick={() => setStep(1)}
              className="text-gray-400 text-sm mb-4"
            >
              ← Volver
            </button>

            <h2 className="text-white text-xl font-bold mb-6">
              Crear cuenta
            </h2>

            {error && (
              <div className="text-red-400 text-sm mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              <input
                type="text"
                placeholder="Nombre de empresa"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white"
                required
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white"
                required
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white"
                required
              />

              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
              >
                {loading ? "Creando..." : "Crear cuenta"}
              </button>

            </form>

            <p className="text-gray-400 text-sm mt-6 text-center">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-green-500">
                Inicia sesión
              </Link>
            </p>

          </div>
        )}
      </div>
    </div>
  );
}
