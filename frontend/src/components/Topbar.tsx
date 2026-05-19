import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Topbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm">
      <div className="font-semibold text-gray-700">Panel de Control</div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{user?.email}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default Topbar;

