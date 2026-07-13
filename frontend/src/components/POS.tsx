import { useEffect, useState, useMemo } from "react";
import {
  listarInventarioRequest,
  registrarCheckoutVentaRequest,
} from "../services/api";
import type {
  VentaCheckoutCreate,
  VentaCheckoutItem,
} from "../services/api";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  Phone,
  CreditCard,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  PackageOpen,
} from "lucide-react";
import "./POS.css";

type TallaInventario = {
  id: number;
  inventario_id: number;
  talla_eur: string;
  talla_col: string;
  cantidad: number;
  fecha_registro: string;
};

type ArticuloInventario = {
  id: number;
  marca: string;
  referencia: string;
  talla_eur?: string;
  talla_col?: string;
  foto: string | null;
  costo: number;
  precio_sugerido: number;
  cantidad_total: number;
  estado: "disponible" | "agotado" | "reservado";
  fecha_ingreso: string;
  observaciones: string | null;
  fecha_registro: string;
  tallas: TallaInventario[];
};

interface CarritoItem {
  inventario_talla_id: number;
  producto: ArticuloInventario;
  talla: TallaInventario;
  cantidad: number;
  precio_unitario: number;
}

const formatearPesos = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

// Orden de visualización de tallas
const ORDEN_TALLAS = [
  "36", "37", "38", "39", "40D", "40H", "41D", "41H", "42", "43", "44", "45"
];

function POS() {
  // Estados de carga de datos
  const [productos, setProductos] = useState<ArticuloInventario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorBackend, setErrorBackend] = useState<string | null>(null);

  // Estados de filtros y búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState("");
  const [tallaFiltro, setTallaFiltro] = useState("");

  // Estado del carrito de compras
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);

  // Estados para selección inline de talla por cada producto
  const [seleccionTallas, setSeleccionTallas] = useState<
    Record<
      number,
      {
        talla: TallaInventario | null;
        precio: number;
        cantidad: number;
      }
    >
  >({});

  // Datos del checkout
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Control de interfaz móvil
  const [verCarritoMovil, setVerCarritoMovil] = useState(false);
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [exitoVenta, setExitoVenta] = useState<{
    numero_venta: string;
    total: number;
  } | null>(null);

  // Cargar inventario desde el backend
  const cargarInventario = async () => {
    try {
      setCargando(true);
      const data = await listarInventarioRequest();
      if (Array.isArray(data)) {
        setProductos(data);
      }
    } catch (err) {
      console.error("Error al cargar inventario:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInventario();
    
    // Add class to body for scoped styling of topbar and layout on POS page
    document.body.classList.add("pos-page-active");
    
    return () => {
      document.body.classList.remove("pos-page-active");
    };
  }, []);

  // Extraer marcas únicas para el filtro de marcas
  const marcasUnicas = useMemo(() => {
    const marcas = productos.map((p) => p.marca.trim());
    return Array.from(new Set(marcas)).sort();
  }, [productos]);

  // Filtrar y ordenar catálogo de productos
  const productosFiltrados = useMemo(() => {
    return productos
      .filter((prod) => {
        // Regla: Solo productos con stock > 0
        const tieneStock = prod.tallas.some((t) => t.cantidad > 0);
        if (!tieneStock) return false;

        // Filtro de búsqueda por texto libre (marca o referencia)
        if (busqueda.trim()) {
          const query = busqueda.toLowerCase().trim();
          const matchMarca = prod.marca.toLowerCase().includes(query);
          const matchReferencia = prod.referencia.toLowerCase().includes(query);
          if (!matchMarca && !matchReferencia) return false;
        }

        // Filtro de marca
        if (marcaFiltro) {
          if (prod.marca.trim() !== marcaFiltro) return false;
        }

        // Filtro de talla EUR
        if (tallaFiltro) {
          const tieneTalla = prod.tallas.some(
            (t) => t.talla_eur === tallaFiltro && t.cantidad > 0
          );
          if (!tieneTalla) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Orden alfabético: marca y luego referencia
        const compMarca = a.marca.localeCompare(b.marca);
        if (compMarca !== 0) return compMarca;
        return a.referencia.localeCompare(b.referencia);
      });
  }, [productos, busqueda, marcaFiltro, tallaFiltro]);

  // Selección de talla en la tarjeta del producto
  const seleccionarTalla = (productoId: number, talla: TallaInventario, precioSugerido: number) => {
    setSeleccionTallas((prev) => {
      const actual = prev[productoId];
      if (actual?.talla?.id === talla.id) {
        // Si ya está seleccionada, se deselecciona
        const copia = { ...prev };
        delete copia[productoId];
        return copia;
      }
      return {
        ...prev,
        [productoId]: {
          talla,
          precio: precioSugerido,
          cantidad: 1,
        },
      };
    });
  };

  // Modificar precio temporal en la tarjeta
  const cambiarPrecioSeleccion = (productoId: number, precio: number) => {
    setSeleccionTallas((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId],
        precio: precio < 0 ? 0 : precio,
      },
    }));
  };

  // Modificar cantidad temporal en la tarjeta
  const cambiarCantidadSeleccion = (productoId: number, delta: number, maxStock: number) => {
    setSeleccionTallas((prev) => {
      const actual = prev[productoId];
      if (!actual) return prev;
      let nuevaCant = actual.cantidad + delta;
      if (nuevaCant < 1) nuevaCant = 1;
      if (nuevaCant > maxStock) nuevaCant = maxStock;
      return {
        ...prev,
        [productoId]: {
          ...actual,
          cantidad: nuevaCant,
        },
      };
    });
  };

  // Agregar item seleccionado al carrito
  const agregarAlCarrito = (producto: ArticuloInventario) => {
    const seleccion = seleccionTallas[producto.id];
    if (!seleccion || !seleccion.talla) return;

    const { talla, precio, cantidad } = seleccion;

    if (precio <= 0) {
      alert("El precio unitario debe ser mayor a 0.");
      return;
    }

    setCarrito((prevCarrito) => {
      // Buscar si ya existe la talla en el carrito
      const index = prevCarrito.findIndex(
        (item) => item.inventario_talla_id === talla.id
      );

      if (index > -1) {
        // Duplicados: Sumar cantidad
        const itemExistente = prevCarrito[index];
        const nuevaCantidad = itemExistente.cantidad + cantidad;

        if (nuevaCantidad > talla.cantidad) {
          alert(
            `No se puede agregar. El stock disponible es ${talla.cantidad} unidades, y ya tienes ${itemExistente.cantidad} en el carrito.`
          );
          return prevCarrito;
        }

        const nuevoCarrito = [...prevCarrito];
        nuevoCarrito[index] = {
          ...itemExistente,
          cantidad: nuevaCantidad,
          precio_unitario: precio, // Se actualiza al último precio seleccionado
        };
        return nuevoCarrito;
      } else {
        // Nuevo item
        return [
          ...prevCarrito,
          {
            inventario_talla_id: talla.id,
            producto,
            talla,
            cantidad,
            precio_unitario: precio,
          },
        ];
      }
    });

    // Limpiar selección del producto
    setSeleccionTallas((prev) => {
      const copia = { ...prev };
      delete copia[producto.id];
      return copia;
    });
  };

  // Editar cantidad directamente en el carrito
  const actualizarCantidadCarrito = (tallaId: number, nuevaCant: number, maxStock: number) => {
    if (nuevaCant < 1) return;
    if (nuevaCant > maxStock) {
      alert(`Stock insuficiente. Máximo disponible: ${maxStock}`);
      return;
    }
    setCarrito((prev) =>
      prev.map((item) =>
        item.inventario_talla_id === tallaId
          ? { ...item, cantidad: nuevaCant }
          : item
      )
    );
  };

  // Editar precio directamente en el carrito
  const actualizarPrecioCarrito = (tallaId: number, nuevoPrecio: number) => {
    if (nuevoPrecio < 0) nuevoPrecio = 0;
    setCarrito((prev) =>
      prev.map((item) =>
        item.inventario_talla_id === tallaId
          ? { ...item, precio_unitario: nuevoPrecio }
          : item
      )
    );
  };

  // Eliminar item del carrito
  const eliminarItemCarrito = (tallaId: number) => {
    setCarrito((prev) => prev.filter((item) => item.inventario_talla_id !== tallaId));
  };

  // Cálculos de resumen en frontend (vista previa)
  const resumenCarrito = useMemo(() => {
    const lineas = carrito.length;
    const unidades = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    const totalBruto = carrito.reduce(
      (acc, item) => acc + item.cantidad * item.precio_unitario,
      0
    );
    return { lineas, unidades, totalBruto };
  }, [carrito]);

  // Enviar Checkout
  const procesarVentaCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carrito.length === 0) {
      alert("El carrito está vacío");
      return;
    }
    if (!metodoPago) {
      alert("Por favor seleccione un método de pago");
      return;
    }

    setProcesandoVenta(true);
    setErrorBackend(null);
    setExitoVenta(null);

    const itemsRequest: VentaCheckoutItem[] = carrito.map((item) => ({
      inventario_talla_id: item.inventario_talla_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
    }));

    const checkoutData: VentaCheckoutCreate = {
      items: itemsRequest,
      metodo_pago: metodoPago,
      cliente_nombre: clienteNombre.trim() ? clienteNombre.trim() : "Cliente casual",
      cliente_telefono: clienteTelefono.trim() ? clienteTelefono.trim() : "",
      observaciones: observaciones.trim() ? observaciones.trim() : "",
    };

    try {
      const response = await registrarCheckoutVentaRequest(checkoutData);

      // El backend retorna VentaCheckoutResponse o un objeto con detail/error en caso de fallo
      if (response && response.operacion && response.operacion.numero_venta) {
        setExitoVenta({
          numero_venta: response.operacion.numero_venta,
          total: response.total_bruto,
        });

        // Limpiar el estado del checkout y el carrito
        setCarrito([]);
        setClienteNombre("");
        setClienteTelefono("");
        setMetodoPago("");
        setObservaciones("");
        setVerCarritoMovil(false);

        // Recargar inventario para obtener stock fresco
        await cargarInventario();
      } else {
        // Fallo con formato no esperado o mensaje de error directo
        const errDetail = (response as any).detail || "Ocurrió un error inesperado al procesar la venta.";
        setErrorBackend(errDetail);
        // Recargar stock por si hubo desfase
        await cargarInventario();
      }
    } catch (err: any) {
      console.error("Error en checkout:", err);
      setErrorBackend("No se pudo conectar con el servidor. Intente nuevamente.");
      await cargarInventario();
    } finally {
      setProcesandoVenta(false);
    }
  };

  return (
    <div className="pos-container">
      {/* Notificaciones de éxito y error */}
      {exitoVenta && (
        <div className="pos-alert pos-alert-success glass-panel">
          <CheckCircle size={24} className="alert-icon" />
          <div className="alert-content">
            <h4>¡Venta Registrada Exitosamente!</h4>
            <p>
              Código de Venta: <strong>{exitoVenta.numero_venta}</strong> | Total:{" "}
              <strong>{formatearPesos(exitoVenta.total)}</strong>
            </p>
          </div>
          <button className="alert-close" onClick={() => setExitoVenta(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      {errorBackend && (
        <div className="pos-alert pos-alert-danger glass-panel">
          <AlertCircle size={24} className="alert-icon" />
          <div className="alert-content">
            <h4>Error al registrar venta</h4>
            <p>{errorBackend}</p>
          </div>
          <button className="alert-close" onClick={() => setErrorBackend(null)}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="pos-main-layout">
        {/* ZONA IZQUIERDA: Catálogo e Inventario */}
        <section className="pos-catalog-section">
          <div className="pos-filters-panel glass-panel">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por marca o referencia..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="clear-search" onClick={() => setBusqueda("")}>
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="filters-row">
              <select
                value={marcaFiltro}
                onChange={(e) => setMarcaFiltro(e.target.value)}
                className="pos-select"
              >
                <option value="">Todas las Marcas</option>
                {marcasUnicas.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={tallaFiltro}
                onChange={(e) => setTallaFiltro(e.target.value)}
                className="pos-select"
              >
                <option value="">Todas las Tallas</option>
                {ORDEN_TALLAS.map((t) => (
                  <option key={t} value={t}>
                    EUR {t}
                  </option>
                ))}
              </select>

              {(marcaFiltro || tallaFiltro || busqueda) && (
                <button
                  className="btn-clear-filters"
                  onClick={() => {
                    setMarcaFiltro("");
                    setTallaFiltro("");
                    setBusqueda("");
                  }}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {cargando ? (
            <div className="pos-loading-container">
              <div className="pos-spinner"></div>
              <p>Cargando catálogo...</p>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="pos-empty-catalog glass-panel">
              <PackageOpen size={48} className="empty-icon" />
              <p>No se encontraron productos con stock en este momento.</p>
            </div>
          ) : (
            <div className="pos-products-grid">
              {productosFiltrados.map((prod) => {
                const seleccion = seleccionTallas[prod.id];
                return (
                  <div key={prod.id} className="pos-product-card glass-panel">
                    <div className="product-image-container">
                      {prod.foto ? (
                        <img
                          src={prod.foto}
                          alt={`${prod.marca} ${prod.referencia}`}
                          className="product-image"
                        />
                      ) : (
                        <div className="product-image-placeholder">Sin Foto</div>
                      )}
                      <span className="product-price-badge">
                        {formatearPesos(prod.precio_sugerido)}
                      </span>
                    </div>

                    <div className="product-info">
                      <span className="product-brand">{prod.marca}</span>
                      <h3 className="product-reference">{prod.referencia}</h3>

                      <div className="product-sizes-section">
                        <span className="section-label">Tallas disponibles:</span>
                        <div className="product-sizes-list">
                          {prod.tallas
                            .filter((t) => t.cantidad > 0)
                            .sort((a, b) => {
                              const idxA = ORDEN_TALLAS.indexOf(a.talla_eur);
                              const idxB = ORDEN_TALLAS.indexOf(b.talla_eur);
                              return idxA - idxB;
                            })
                            .map((t) => {
                              const isSelected = seleccion?.talla?.id === t.id;
                              return (
                                <button
                                  key={t.id}
                                  className={`size-btn ${isSelected ? "active" : ""}`}
                                  onClick={() => seleccionarTalla(prod.id, t, prod.precio_sugerido)}
                                  title={`EUR ${t.talla_eur} (COL ${t.talla_col}) - Stock: ${t.cantidad}`}
                                >
                                  {t.talla_eur}
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      {/* Configuración de selección inline */}
                      {seleccion && seleccion.talla && (
                        <div className="pos-inline-add-panel">
                          <div className="inline-details">
                            <span className="inline-stock">
                              EUR {seleccion.talla.talla_eur} (COL {seleccion.talla.talla_col}) |
                              Stock: <strong>{seleccion.talla.cantidad}</strong>
                            </span>
                          </div>

                          <div className="inline-inputs-row">
                            <div className="price-input-wrapper">
                              <label>Precio Unitario</label>
                              <input
                                type="number"
                                value={seleccion.precio || ""}
                                onChange={(e) =>
                                  cambiarPrecioSeleccion(prod.id, Number(e.target.value))
                                }
                              />
                            </div>

                            <div className="quantity-controller">
                              <label>Cant.</label>
                              <div className="qty-controls">
                                <button
                                  onClick={() => cambiarCantidadSeleccion(prod.id, -1, seleccion.talla!.cantidad)}
                                  disabled={seleccion.cantidad <= 1}
                                >
                                  <Minus size={14} />
                                </button>
                                <span>{seleccion.cantidad}</span>
                                <button
                                  onClick={() =>
                                    cambiarCantidadSeleccion(prod.id, 1, seleccion.talla!.cantidad)
                                  }
                                  disabled={seleccion.cantidad >= seleccion.talla.cantidad}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <button
                            className="btn-add-to-cart"
                            onClick={() => agregarAlCarrito(prod)}
                          >
                            <ShoppingCart size={16} />
                            <span>Agregar al Carrito</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ZONA DERECHA: Carrito de Compras & Checkout (Escritorio) */}
        <aside className="pos-cart-aside glass-panel desktop-only">
          <div className="cart-header">
            <ShoppingCart size={20} />
            <h2>Detalle de Venta</h2>
            {carrito.length > 0 && (
              <span className="cart-badge">{resumenCarrito.unidades}</span>
            )}
          </div>

          <div className="cart-items-wrapper">
            {carrito.length === 0 ? (
              <div className="cart-empty-message">
                <ShoppingCart size={40} className="empty-cart-icon" />
                <p>El carrito de compras está vacío.</p>
                <p className="subtext">Haz clic en una talla para agregar calzado.</p>
              </div>
            ) : (
              carrito.map((item) => (
                <div key={item.inventario_talla_id} className="cart-item-card">
                  {item.producto.foto ? (
                    <img
                      src={item.producto.foto}
                      alt={item.producto.referencia}
                      className="item-thumb"
                    />
                  ) : (
                    <div className="item-thumb-placeholder">鞋</div>
                  )}

                  <div className="item-details">
                    <div className="item-title-row">
                      <h4>
                        {item.producto.marca} <span className="ref">{item.producto.referencia}</span>
                      </h4>
                      <button
                        className="btn-remove-item"
                        onClick={() => eliminarItemCarrito(item.inventario_talla_id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="item-meta">
                      Talla EUR {item.talla.talla_eur} (COL {item.talla.talla_col})
                    </div>

                    <div className="item-actions-row">
                      <div className="item-qty-selector">
                        <button
                          onClick={() =>
                            actualizarCantidadCarrito(
                              item.inventario_talla_id,
                              item.cantidad - 1,
                              item.talla.cantidad
                            )
                          }
                          disabled={item.cantidad <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{item.cantidad}</span>
                        <button
                          onClick={() =>
                            actualizarCantidadCarrito(
                              item.inventario_talla_id,
                              item.cantidad + 1,
                              item.talla.cantidad
                            )
                          }
                          disabled={item.cantidad >= item.talla.cantidad}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="item-price-edit">
                        <input
                          type="number"
                          value={item.precio_unitario || ""}
                          onChange={(e) =>
                            actualizarPrecioCarrito(
                              item.inventario_talla_id,
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="item-subtotal-row">
                      Subtotal:{" "}
                      <strong>{formatearPesos(item.cantidad * item.precio_unitario)}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={procesarVentaCheckout} className="pos-checkout-form">
            <div className="checkout-inputs">
              <div className="form-group">
                <label>
                  <User size={14} /> Nombre Cliente
                </label>
                <input
                  type="text"
                  placeholder="Cliente casual"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  <Phone size={14} /> Teléfono Cliente
                </label>
                <input
                  type="text"
                  placeholder="Ej: 3001234567"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>
                  <CreditCard size={14} /> Método de Pago *
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  required
                >
                  <option value="">Seleccionar...</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta crédito">Tarjeta Crédito</option>
                  <option value="tarjeta débito">Tarjeta Débito</option>
                  <option value="Addi">Addi</option>
                  <option value="Sistecrédito">Sistecrédito</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  <FileText size={14} /> Observaciones
                </label>
                <textarea
                  placeholder="Notas adicionales..."
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>
            </div>

            <div className="checkout-summary">
              <div className="summary-row">
                <span>Líneas:</span>
                <span>{resumenCarrito.lineas}</span>
              </div>
              <div className="summary-row">
                <span>Unidades:</span>
                <span>{resumenCarrito.unidades}</span>
              </div>
              <div className="summary-total">
                <span>Total Bruto:</span>
                <span>{formatearPesos(resumenCarrito.totalBruto)}</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-submit-checkout"
              disabled={carrito.length === 0 || !metodoPago || procesandoVenta}
            >
              {procesandoVenta ? "Procesando..." : "Finalizar venta"}
            </button>
          </form>
        </aside>
      </div>

      {/* FOOTER MÓVIL: Botón flotante para ver carrito */}
      <div className="pos-mobile-footer mobile-only">
        <button
          className="btn-trigger-mobile-cart"
          onClick={() => setVerCarritoMovil(true)}
          disabled={carrito.length === 0}
        >
          <ShoppingCart size={18} />
          <span>Ver Carrito ({resumenCarrito.unidades})</span>
          <span className="mobile-total-preview">{formatearPesos(resumenCarrito.totalBruto)}</span>
        </button>
      </div>

      {/* OVERLAY CARRITO MÓVIL */}
      {verCarritoMovil && (
        <div className="pos-mobile-cart-overlay">
          <div className="mobile-cart-container glass-panel">
            <div className="mobile-cart-header">
              <h3>Carrito de Ventas ({resumenCarrito.unidades})</h3>
              <button className="btn-close-mobile-cart" onClick={() => setVerCarritoMovil(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="mobile-cart-items-list">
              {carrito.map((item) => (
                <div key={item.inventario_talla_id} className="cart-item-card">
                  {item.producto.foto ? (
                    <img
                      src={item.producto.foto}
                      alt={item.producto.referencia}
                      className="item-thumb"
                    />
                  ) : (
                    <div className="item-thumb-placeholder">鞋</div>
                  )}

                  <div className="item-details">
                    <div className="item-title-row">
                      <h4>
                        {item.producto.marca} <span className="ref">{item.producto.referencia}</span>
                      </h4>
                      <button
                        className="btn-remove-item"
                        onClick={() => eliminarItemCarrito(item.inventario_talla_id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="item-meta">
                      Talla EUR {item.talla.talla_eur} (COL {item.talla.talla_col})
                    </div>

                    <div className="item-actions-row">
                      <div className="item-qty-selector">
                        <button
                          onClick={() =>
                            actualizarCantidadCarrito(
                              item.inventario_talla_id,
                              item.cantidad - 1,
                              item.talla.cantidad
                            )
                          }
                          disabled={item.cantidad <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <span>{item.cantidad}</span>
                        <button
                          onClick={() =>
                            actualizarCantidadCarrito(
                              item.inventario_talla_id,
                              item.cantidad + 1,
                              item.talla.cantidad
                            )
                          }
                          disabled={item.cantidad >= item.talla.cantidad}
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      <div className="item-price-edit">
                        <input
                          type="number"
                          value={item.precio_unitario || ""}
                          onChange={(e) =>
                            actualizarPrecioCarrito(
                              item.inventario_talla_id,
                              Number(e.target.value)
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="item-subtotal-row">
                      Subtotal:{" "}
                      <strong>{formatearPesos(item.cantidad * item.precio_unitario)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={procesarVentaCheckout} className="pos-checkout-form">
              <div className="checkout-inputs">
                <div className="form-group">
                  <label>
                    <User size={14} /> Nombre Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Cliente casual"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <Phone size={14} /> Teléfono Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 3001234567"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <CreditCard size={14} /> Método de Pago *
                  </label>
                  <select
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta crédito">Tarjeta Crédito</option>
                    <option value="tarjeta débito">Tarjeta Débito</option>
                    <option value="Addi">Addi</option>
                    <option value="Sistecrédito">Sistecrédito</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <FileText size={14} /> Observaciones
                  </label>
                  <textarea
                    placeholder="Notas adicionales..."
                    rows={2}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              <div className="checkout-summary">
                <div className="summary-row">
                  <span>Unidades:</span>
                  <span>{resumenCarrito.unidades}</span>
                </div>
                <div className="summary-total">
                  <span>Total Bruto:</span>
                  <span>{formatearPesos(resumenCarrito.totalBruto)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="btn-submit-checkout"
                disabled={carrito.length === 0 || !metodoPago || procesandoVenta}
              >
                {procesandoVenta ? "Procesando..." : "Finalizar venta"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default POS;
