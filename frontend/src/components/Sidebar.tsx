import { NavLink } from "react-router-dom";
import { LayoutDashboard, PlusCircle, List, MessageSquare, Package, ShoppingCart } from "lucide-react";
import clsx from "clsx";
import logo from "../assets/logo-header.png";

function Sidebar() {
  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/dashboard/nuevo", icon: PlusCircle, label: "Nuevo Encargo" },
    { to: "/dashboard/encargos", icon: List, label: "Ver Encargos" },
    { to: "/dashboard/mensajes", icon: MessageSquare, label: "Mensajes" },
    { to: "/dashboard/pos", icon: ShoppingCart, label: "Nueva Venta" },
    { to: "/dashboard/inventario", icon: Package, label: "Inventario" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        <div className="sidebar-brand">
          <h2>TENIS RIO</h2>
          <p>SISTEMA DE ENCARGOS</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              clsx("sidebar-link", { "sidebar-link-active": isActive })
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
