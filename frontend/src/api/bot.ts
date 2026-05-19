import api from "./client";

/* ================================================================
   TIPOS
================================================================ */
export interface FlowStep {
  id: string;
  message: string;
  next: Record<string, string>;
}

export interface BotFlow {
  steps: FlowStep[];
}

export interface BotConfig {
  business_id: string;
  flow_json: BotFlow | string;
  updated_at?: string;
}

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

/* ================================================================
   HELPER — parsea flow_json sea string o objeto
================================================================ */
function parseFlowJson(raw: any): BotFlow {
  try {
    if (!raw) return { steps: [] };
    if (typeof raw === "string") return JSON.parse(raw);
    return raw;
  } catch {
    return { steps: [] };
  }
}

/* ================================================================
   GET CONFIG
   Retorna el objeto BotConfig con flow_json ya parseado a BotFlow
================================================================ */
export const getBotConfig = async (token: string): Promise<BotConfig | null> => {
  try {
    const res = await api.get("/bot", {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    if (!res.data) return null;

    // Normalizar flow_json a objeto siempre
    const parsed: BotConfig = {
      ...res.data,
      flow_json: parseFlowJson(res.data.flow_json),
    };

    return parsed;
  } catch (err: any) {
    console.error("❌ getBotConfig ERROR:", err?.response?.data ?? err.message);
    return null;
  }
};

/* ================================================================
   UPDATE FLOW
   Retorna { ok, error? } — nunca lanza, siempre resuelve
================================================================ */
export const updateBotFlow = async (
  token: string,
  flow: BotFlow
): Promise<ApiResponse> => {
  try {
    const res = await api.put(
      "/bot/flow",
      { flow_json: flow },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 12000,
      }
    );

    if (res.status >= 200 && res.status < 300) {
      return { ok: true, data: res.data };
    }

    return {
      ok: false,
      error: res.data?.error ?? `Respuesta inesperada: ${res.status}`,
    };
  } catch (err: any) {
    console.error("❌ updateBotFlow ERROR:", {
      message: err?.message,
      response: err?.response?.data,
      status: err?.response?.status,
    });

    const status = err?.response?.status;

    const errorMap: Record<number, string> = {
      400: "Datos inválidos en la configuración",
      401: "Sesión expirada — vuelve a iniciar sesión",
      403: "No tienes permisos para realizar esta acción",
      413: "La configuración es demasiado grande",
      500: "Error interno del servidor — intenta de nuevo",
    };

    const errorMessage =
      errorMap[status] ??
      err?.response?.data?.error ??
      (err?.code === "ECONNABORTED"
        ? "Tiempo de espera agotado — verifica tu conexión"
        : !navigator.onLine
        ? "Sin conexión a internet"
        : "Error guardando configuración del bot");

    return { ok: false, error: errorMessage };
  }
};

/* ================================================================
   GET STATUS
================================================================ */
export const getBotStatus = async (
  token: string,
  businessId: string
): Promise<ApiResponse> => {
  try {
    if (!businessId) throw new Error("businessId es requerido");

    const res = await api.get(`/bot/status/${businessId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    return { ok: true, data: res.data };
  } catch (err: any) {
    console.error("❌ getBotStatus ERROR:", err?.response?.data ?? err.message);
    return {
      ok: false,
      error: err?.response?.data?.error ?? err?.message ?? "Error obteniendo estado del bot",
    };
  }
};

/* ================================================================
   GET QR
================================================================ */
export const getBotQR = async (
  token: string,
  businessId: string
): Promise<ApiResponse> => {
  try {
    if (!businessId) throw new Error("businessId es requerido");

    const res = await api.get(`/bot/qr/${businessId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });

    return { ok: true, data: res.data };
  } catch (err: any) {
    console.error("❌ getBotQR ERROR:", err?.response?.data ?? err.message);
    return {
      ok: false,
      error: err?.response?.data?.error ?? err?.message ?? "Error obteniendo QR",
    };
  }
};

/* ================================================================
   VALIDATE FLOW — validación local antes de guardar
================================================================ */
export const validateBotFlow = (
  flow: BotFlow
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!flow?.steps || !Array.isArray(flow.steps)) {
    return { valid: false, errors: ["El flujo debe tener un array de pasos"] };
  }

  const stepIds = new Set(flow.steps.map((s) => s.id));

  flow.steps.forEach((step, i) => {
    const label = step.id ? `'${step.id}'` : `#${i + 1}`;

    if (!step.id || step.id.trim() === "") {
      errors.push(`Paso ${i + 1}: el ID no puede estar vacío`);
    }

    if (typeof step.message !== "string") {
      errors.push(`Paso ${label}: el mensaje debe ser texto`);
    }

    if (!step.next || typeof step.next !== "object" || Array.isArray(step.next)) {
      errors.push(`Paso ${label}: las opciones deben ser un objeto clave→valor`);
    }
  });

  // Verificar que exista un paso "start"
  if (flow.steps.length > 0 && !stepIds.has("start")) {
    errors.push("Debe existir un paso con ID 'start' como punto de entrada del bot");
  }

  return { valid: errors.length === 0, errors };
};

