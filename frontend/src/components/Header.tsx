import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Bell, Search } from "lucide-react";

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    navigate("/login");
    window.location.reload();
  };

  const getTitle = () => {
    switch (location.pathname) {
      case "/dashboard": return "Dashboard";
      case "/dashboard/nuevo": return "Nuevo Encargo";
      case "/dashboard/encargos": return "Ver Encargos";
      case "/dashboard/mensajes": return "Mensajes Proveedores";
      default: return "Dashboard";
    }
  };

  return (
    <header className="topbar glass-panel">
      <div className="topbar-left">
        <h1 className="topbar-title">{getTitle()}</h1>
      </div>

      <div className="topbar-right">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Buscar..." />
        </div>
        
        <button className="icon-button">
          <Bell size={20} />
          <span className="notification-dot"></span>
        </button>

        <div className="user-profile">
          <div className="avatar">A</div>
          <div className="user-info">
            <span className="user-name">Admin</span>
            <span className="user-role">Premium</span>
          </div>
        </div>

        <button className="logout-btn-modern" onClick={cerrarSesion} title="Cerrar sesión">
          <LogOut size={18} />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}

export default Header;