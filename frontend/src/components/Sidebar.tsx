import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

const menuItems = [
  { name: "Dashboard",      path: "/" },
  { name: "Conexiones",     path: "/connections" },
  { name: "Notificaciones", path: "/notifications" },
  { name: "Contactos",      path: "/contacts" },
  { name: "Campañas",       path: "/campaigns" },
  { name: "Facturación",    path: "/billing" },
  { name: "Configuración",  path: "/settings" },
];

const Sidebar = () => {
  const location = useLocation();
  const { token } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token) return;

    const fetchUnread = async () => {
      try {
        const res = await api.get("/notifications/unread-count", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnread(res.data?.count ?? 0);
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [token]);

  // Resetear badge al entrar a notificaciones
  useEffect(() => {
    if (location.pathname === "/notifications") setUnread(0);
  }, [location.pathname]);

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 text-2xl font-bold border-b border-gray-700">
        MR.ROBOT COL
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isNotif  = item.path === "/notifications";

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                isActive ? "bg-green-600" : "hover:bg-gray-700"
              }`}
            >
              <span>{item.name}</span>
              {isNotif && unread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;

