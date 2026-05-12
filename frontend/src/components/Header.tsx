import { NavLink, useNavigate } from "react-router-dom";
import logo from "../assets/logo-header.png";

function Header() {
  const navigate = useNavigate();

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    navigate("/login");
    window.location.reload();
  };

  return (
    <>
      <header className="main-header">
        <div className="header-left">
          <img src={logo} alt="TENISRioSHOP" className="header-logo" />
        </div>

        <div className="header-title">
          <h2>TENIS RIO SHOP</h2>
          <p>SISTEMA DE ENCARGOS</p>
        </div>

        <button className="logout-btn" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </header>

      <nav className="main-nav">
        <NavLink
          to="/dashboard/nuevo"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
        >
          Nuevo encargo
        </NavLink>

        <NavLink
          to="/dashboard/encargos"
          className={({ isActive }) =>
            isActive ? "nav-link nav-link-active" : "nav-link"
          }
        >
          Ver encargos
        </NavLink>
      </nav>
    </>
  );
}

export default Header;