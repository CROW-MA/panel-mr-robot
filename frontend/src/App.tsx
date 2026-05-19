import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Connections from "./pages/Connections";
import Contacts from "./pages/Contacts";
import Campaigns from "./pages/Campaigns";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }
  return token ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }
  return token ? <Navigate to="/" replace /> : children;
};

const wrap = (Page: JSX.Element) => (
  <PrivateRoute>
    <Layout>{Page}</Layout>
  </PrivateRoute>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

    <Route path="/"               element={wrap(<Dashboard />)} />
    <Route path="/connections"    element={wrap(<Connections />)} />
    <Route path="/notifications"  element={wrap(<Notifications />)} />
    <Route path="/contacts"       element={wrap(<Contacts />)} />
    <Route path="/campaigns"      element={wrap(<Campaigns />)} />
    <Route path="/billing"        element={wrap(<Billing />)} />
    <Route path="/settings"       element={wrap(<Settings />)} />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

// BUILD_1776453149
