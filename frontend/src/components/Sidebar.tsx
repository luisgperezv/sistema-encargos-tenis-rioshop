import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, List, MessageSquare, Package, ShoppingCart, ReceiptText, Receipt } from "lucide-react";
import clsx from "clsx";
import logo from "../assets/logo-header.png";

function Sidebar() {
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/dashboard/encargos", icon: List, label: "Ver Encargos" },
    { to: "/dashboard/nuevo", icon: PlusCircle, label: "Nuevo Encargo" },
    { to: "/dashboard/pos", icon: ShoppingCart, label: "Nueva Venta" },
    { to: "/dashboard/ventas-historial", icon: ReceiptText, label: "Historial de Ventas" },
    { to: "/dashboard/inventario", icon: Package, label: "Inventario" },
    { to: "/dashboard/gastos", icon: Receipt, label: "Gastos" },
    { to: "/dashboard/mensajes", icon: MessageSquare, label: "Mensajes" },
  ];

  useEffect(() => {
    // En móvil (<= 768px), centrar automáticamente el elemento activo en el scroll horizontal
    if (navRef.current && window.innerWidth <= 768) {
      const activeElement = navRef.current.querySelector<HTMLElement>(".sidebar-link-active");
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }, [location.pathname]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="Logo" className="sidebar-logo" />
        <div className="sidebar-brand">
          <h2>TENIS RIO</h2>
          <p>SISTEMA DE ENCARGOS</p>
        </div>
      </div>
      <nav ref={navRef} className="sidebar-nav">
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
