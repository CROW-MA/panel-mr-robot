import { useEffect } from "react";

export function useRefreshOnFocus(callback: () => void) {
  useEffect(() => {
    // Recargar cuando el usuario vuelve a la pestaña
    const onFocus = () => callback();
    const onVisible = () => { if (document.visibilityState === "visible") callback(); };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [callback]);
}
