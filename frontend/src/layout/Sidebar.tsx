import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

const menuItems = [
  { name: "Dashboard",      path: "/",              icon: "📊" },
  { name: "Conexiones",     path: "/connections",   icon: "🔗" },
  { name: "Notificaciones", path: "/notifications", icon: "🔔" },
  { name: "Contactos",      path: "/contacts",      icon: "👥" },
  { name: "Campañas",       path: "/campaigns",     icon: "📣" },
  { name: "Facturación",    path: "/billing",       icon: "💳" },
  { name: "Configuración",  path: "/settings",      icon: "⚙️" },
];

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar = ({ onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useAuth();
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

  useEffect(() => {
    if (location.pathname === "/notifications") setUnread(0);
    // Cerrar sidebar en móvil al navegar
    if (onClose) onClose();
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="w-64 h-full bg-gray-900 text-white flex flex-col border-r border-gray-800">
      {/* Header */}
      <div className="p-5 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xl font-bold text-white">MR.ROBOT COL</span>
        {/* Botón cerrar — solo visible en móvil */}
        {onClose && (
          <button onClick={onClose}
            className="md:hidden text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isNotif  = item.path === "/notifications";
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                isActive
                  ? "bg-green-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{item.icon}</span>
                <span>{item.name}</span>
              </div>
              {isNotif && unread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cerrar sesión */}
      <div className="p-3 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-red-900/30 hover:text-red-400 transition-colors text-sm font-medium"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

