import { useEffect, useState } from "react";
import { obtenerOperacionPOSRequest, anularOperacionPOSRequest } from "../../services/api";
import type { VentaCheckoutResponse } from "../../services/api";

import {
  X,
  Package,
  Calendar,
  User,
  Phone,
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  Ban,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface DetalleVentaModalProps {
  operacionId: number | null;
  esLegacy: boolean;
  onClose: () => void;
  onOperacionAnulada?: () => void;
}

const formatearPesos = (valor: number | undefined | null) => {
  const v = valor || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
};

const formatearFechaHora = (fechaStr?: string | null) => {
  if (!fechaStr) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [y, m, d] = fechaStr.split("-");
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`;
  }
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(d);
  } catch {
    return fechaStr;
  }
};

export const DetalleVentaModal = ({
  operacionId,
  esLegacy,
  onClose,
  onOperacionAnulada,
}: DetalleVentaModalProps) => {

  const [data, setData] = useState<VentaCheckoutResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de anulación
  const [confirmandoAnulacion, setConfirmandoAnulacion] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [errorAnulacion, setErrorAnulacion] = useState<string | null>(null);

  useEffect(() => {
    if (!operacionId) return;

    let isMounted = true;
    setCargando(true);
    setError(null);

    obtenerOperacionPOSRequest(operacionId, esLegacy)
      .then((res) => {
        if (!isMounted) return;
        if ((res as any).detail) {
          setError(typeof (res as any).detail === "string" ? (res as any).detail : "Error al cargar la venta");
        } else {
          setData(res);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Error al comunicarse con el servidor");
      })
      .finally(() => {
        if (isMounted) setCargando(false);
      });

    return () => {
      isMounted = false;
    };
  }, [operacionId, esLegacy]);

  // Cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmandoAnulacion) {
          if (!anulando) setConfirmandoAnulacion(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, confirmandoAnulacion, anulando]);

  if (!operacionId) return null;

  const handleEjecutarAnulacion = async () => {
    const motivoLimpio = motivoAnulacion.trim();
    if (motivoLimpio.length < 5) {
      setErrorAnulacion("El motivo debe tener al menos 5 caracteres.");
      return;
    }

    setAnulando(true);
    setErrorAnulacion(null);
    try {
      const res = await anularOperacionPOSRequest(operacionId, motivoLimpio);
      setConfirmandoAnulacion(false);
      // Actualizar estado local de la transacción
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          operacion: {
            ...prev.operacion,
            estado: "anulada",
            fecha_anulacion: res.fecha_anulacion,
            motivo_anulacion: res.motivo_anulacion,
          },
        };
      });
      // Notificar al componente padre para que actualice la lista y KPIs sin recargar
      if (onOperacionAnulada) {
        onOperacionAnulada();
      }
    } catch (err: any) {
      setErrorAnulacion(err.message || "Error al anular la operación.");
    } finally {
      setAnulando(false);
    }
  };

  const getWhatsAppLink = (tel?: string | null) => {
    if (!tel) return null;
    const digits = tel.replace(/\D/g, "");
    if (!digits) return null;
    const num = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits;
    return `https://wa.me/${num}`;
  };

  const esAnulada = data?.operacion.estado === "anulada";

  return (
    <div className="hv-modal-overlay" onClick={onClose}>
      <div className="hv-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera del Modal */}
        <div className="hv-modal-header">
          <div className="hv-modal-title-area">
            <div className="hv-modal-title-row">
              <span className="hv-badge-ticket">
                {data?.operacion.numero_venta || `V-${operacionId}`}
              </span>
              {esAnulada && (
                <span className="hv-badge-anulada">
                  <Ban size={12} /> ANULADA
                </span>
              )}
              {esLegacy ? (
                <span className="hv-badge-legacy">Venta Histórica (Directa)</span>
              ) : (
                <span className="hv-badge-pos">Punto de Venta POS</span>
              )}
            </div>
            <h2 className="hv-modal-title">Detalle de Transacción</h2>
          </div>
          <button className="hv-modal-close-btn" onClick={onClose} title="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Contenido del Modal */}
        <div className="hv-modal-body">
          {cargando ? (
            <div className="hv-modal-loading">
              <div className="hv-spinner"></div>
              <p>Cargando detalles de la venta...</p>
            </div>
          ) : error ? (
            <div className="hv-modal-error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button className="hv-btn-secundario" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : data ? (
            <>
              {/* Banner informativo si la venta está anulada */}
              {esAnulada && (
                <div className="hv-anulada-banner">
                  <div className="hv-anulada-banner-top">
                    <AlertTriangle size={18} />
                    <span>TRANSACCIÓN ANULADA</span>
                  </div>
                  <div className="hv-anulada-banner-detail">
                    <div>
                      <strong>Fecha de anulación:</strong>{" "}
                      {formatearFechaHora(data.operacion.fecha_anulacion)}
                    </div>
                    {data.operacion.motivo_anulacion && (
                      <div className="hv-anulada-banner-motivo">
                        <strong>Motivo:</strong> "{data.operacion.motivo_anulacion}"
                      </div>
                    )}
                    <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", opacity: 0.9 }}>
                      El stock consumido fue reintegrado de forma exacta a los lotes originales. Los valores financieros se preservan intactos como comprobante histórico de auditoría.
                    </div>
                  </div>
                </div>
              )}
              {/* Información General de la Operación */}
              <div className="hv-info-grid">
                <div className="hv-info-box">
                  <div className="hv-info-label">
                    <User size={15} /> Cliente
                  </div>
                  <div className="hv-info-value">
                    {data.operacion.cliente_nombre || "Cliente casual"}
                  </div>
                </div>

                <div className="hv-info-box">
                  <div className="hv-info-label">
                    <Phone size={15} /> Teléfono
                  </div>
                  <div className="hv-info-value">
                    {data.operacion.cliente_telefono ? (
                      <div className="hv-tel-wa">
                        <span>{data.operacion.cliente_telefono}</span>
                        {getWhatsAppLink(data.operacion.cliente_telefono) && (
                          <a
                            href={getWhatsAppLink(data.operacion.cliente_telefono)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hv-wa-link"
                            title="Contactar por WhatsApp"
                          >
                            <ExternalLink size={14} /> WhatsApp
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="hv-text-muted">No registrado</span>
                    )}
                  </div>
                </div>

                <div className="hv-info-box">
                  <div className="hv-info-label">
                    <Calendar size={15} /> Fecha / Hora
                  </div>
                  <div className="hv-info-value">
                    {formatearFechaHora(data.operacion.fecha_venta)}
                  </div>
                </div>

                <div className="hv-info-box">
                  <div className="hv-info-label">
                    <CreditCard size={15} /> Método de Pago
                  </div>
                  <div className="hv-info-value">
                    <span className="hv-metodo-badge">
                      {data.operacion.metodo_pago || "Efectivo"}
                    </span>
                  </div>
                </div>
              </div>

              {data.operacion.observaciones && (
                <div className="hv-observaciones-box">
                  <div className="hv-obs-label">
                    <FileText size={15} /> Observaciones:
                  </div>
                  <div className="hv-obs-text">{data.operacion.observaciones}</div>
                </div>
              )}

              {/* Lista de Productos / Líneas de Venta */}
              <div className="hv-detalles-seccion">
                <h3 className="hv-seccion-subtitulo">
                  <Package size={18} /> Artículos Vendidos ({data.detalles.length})
                </h3>

                <div className="hv-detalles-table-wrap">
                  <table className="hv-detalles-table">
                    <thead>
                      <tr>
                        <th>Artículo</th>
                        <th>Tallas</th>
                        <th className="hv-text-center">Cant.</th>
                        <th className="hv-text-right">Precio Unit.</th>
                        <th className="hv-text-right">Subtotal</th>
                        <th className="hv-text-right">Costo Directo</th>
                        <th className="hv-text-right">Utilidad Bruta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.detalles.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <div className="hv-articulo-col">
                              {d.foto ? (
                                <img
                                  src={d.foto}
                                  alt={d.referencia || "Foto"}
                                  className="hv-articulo-thumb"
                                />
                              ) : (
                                <div className="hv-articulo-thumb-placeholder">
                                  <Package size={20} />
                                </div>
                              )}
                              <div className="hv-articulo-info">
                                <span className="hv-articulo-marca">{d.marca || "Sin marca"}</span>
                                <span className="hv-articulo-ref">{d.referencia || "Sin referencia"}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="hv-tallas-tag">
                              {d.talla_eur && <span>EUR {d.talla_eur}</span>}
                              {d.talla_col && <span className="hv-col-tag">COL {d.talla_col}</span>}
                              {!d.talla_eur && !d.talla_col && <span className="hv-text-muted">-</span>}
                            </div>
                          </td>
                          <td className="hv-text-center hv-cant-cell">
                            {d.cantidad || 1}
                          </td>
                          <td className="hv-text-right">
                            {formatearPesos(d.precio_unitario || (d.subtotal && d.cantidad ? d.subtotal / d.cantidad : d.subtotal))}
                          </td>
                          <td className="hv-text-right hv-font-semibold">
                            {formatearPesos(d.subtotal || d.precio_venta)}
                          </td>
                          <td className="hv-text-right hv-text-costo">
                            {formatearPesos(d.costo_total)}
                          </td>
                          <td className="hv-text-right hv-text-utilidad">
                            {formatearPesos(d.utilidad)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista Cards para móvil */}
                <div className="hv-detalles-mobile-cards">
                  {data.detalles.map((d) => (
                    <div key={d.id} className="hv-mobile-item-card">
                      <div className="hv-mobile-item-top">
                        {d.foto ? (
                          <img
                            src={d.foto}
                            alt={d.referencia || "Foto"}
                            className="hv-articulo-thumb"
                          />
                        ) : (
                          <div className="hv-articulo-thumb-placeholder">
                            <Package size={20} />
                          </div>
                        )}
                        <div className="hv-mobile-item-meta">
                          <span className="hv-articulo-marca">{d.marca || "Sin marca"}</span>
                          <span className="hv-articulo-ref">{d.referencia || "Sin referencia"}</span>
                          <div className="hv-tallas-tag">
                            {d.talla_eur && <span>EUR {d.talla_eur}</span>}
                            {d.talla_col && <span className="hv-col-tag">COL {d.talla_col}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="hv-mobile-item-grid">
                        <div>
                          <span className="hv-mobile-label">Cantidad:</span>
                          <span className="hv-mobile-val">{d.cantidad || 1}</span>
                        </div>
                        <div>
                          <span className="hv-mobile-label">Subtotal:</span>
                          <span className="hv-mobile-val hv-font-semibold">
                            {formatearPesos(d.subtotal || d.precio_venta)}
                          </span>
                        </div>
                        <div>
                          <span className="hv-mobile-label">Costo directo:</span>
                          <span className="hv-mobile-val hv-text-costo">
                            {formatearPesos(d.costo_total)}
                          </span>
                        </div>
                        <div>
                          <span className="hv-mobile-label">Utilidad bruta:</span>
                          <span className="hv-mobile-val hv-text-utilidad">
                            {formatearPesos(d.utilidad)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tarjeta de Resumen Financiero */}
              <div className="hv-resumen-financiero-box">
                <div className="hv-resumen-kpi-item">
                  <div className="hv-resumen-kpi-label">
                    <DollarSign size={16} /> Total Cobrado
                  </div>
                  <div className="hv-resumen-kpi-val hv-val-cobrado">
                    {formatearPesos(data.total_bruto)}
                  </div>
                </div>

                <div className="hv-resumen-kpi-item">
                  <div className="hv-resumen-kpi-label">
                    <TrendingUp size={16} /> Costos Directos
                  </div>
                  <div className="hv-resumen-kpi-val hv-val-costo">
                    {formatearPesos(data.costo_total)}
                  </div>
                </div>

                <div className="hv-resumen-kpi-item">
                  <div className="hv-resumen-kpi-label">
                    <TrendingUp size={16} /> Utilidad Bruta
                  </div>
                  <div className="hv-resumen-kpi-val hv-val-utilidad">
                    {formatearPesos(data.utilidad_total)}
                  </div>
                </div>
              </div>

              <div className="hv-audit-notice">
                <ShieldCheck size={16} />
                <span>
                  {esAnulada
                    ? "Transacción anulada · Registro histórico inmutable de auditoría"
                    : esLegacy
                    ? "Venta legacy directa · Modo consulta estricto"
                    : "Punto de venta POS · Consulta y auditoría de caja"}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer del Modal */}
        <div className="hv-modal-footer">
          {!esLegacy && !esAnulada && data && (
            <button
              type="button"
              className="hv-btn-anular"
              onClick={() => {
                setConfirmandoAnulacion(true);
                setErrorAnulacion(null);
                setMotivoAnulacion("");
              }}
              title="Anular venta y restaurar inventario"
            >
              <Ban size={16} />
              <span>Anular Venta</span>
            </button>
          )}
          <button className="hv-btn-cerrar" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal de confirmación para obligar motivo */}
      {confirmandoAnulacion && data && (
        <div
          className="hv-confirm-overlay"
          onClick={() => !anulando && setConfirmandoAnulacion(false)}
        >
          <div className="hv-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="hv-confirm-header">
              <AlertTriangle size={24} />
              <h3>Confirmar Anulación de Venta</h3>
            </div>
            <div className="hv-confirm-body">
              <p>
                ¿Deseas anular la transacción{" "}
                <strong>{data.operacion.numero_venta}</strong>?
              </p>
              <div className="hv-confirm-warning">
                ⚠️ <strong>Operación irreversible:</strong> Se reintegrarán las{" "}
                {data.cantidad_items || 1} unidades a los lotes exactos de inventario
                y la venta quedará registrada como ANULADA para trazabilidad y auditoría.
              </div>
              <label
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--text-primary)",
                }}
              >
                Motivo obligatorio de la anulación (mínimo 5 caracteres):
              </label>
              <textarea
                className="hv-confirm-textarea"
                placeholder="Ej: Cliente canceló antes de despacho / Error al registrar talla en caja..."
                value={motivoAnulacion}
                onChange={(e) => {
                  setMotivoAnulacion(e.target.value);
                  if (errorAnulacion) setErrorAnulacion(null);
                }}
                disabled={anulando}
                autoFocus
              />
              {errorAnulacion && (
                <div className="hv-confirm-error">{errorAnulacion}</div>
              )}
            </div>
            <div className="hv-confirm-actions">
              <button
                type="button"
                className="hv-btn-secundario"
                disabled={anulando}
                onClick={() => setConfirmandoAnulacion(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="hv-btn-confirmar-anular"
                disabled={anulando || motivoAnulacion.trim().length < 5}
                onClick={handleEjecutarAnulacion}
              >
                {anulando ? "Anulando..." : "Confirmar Anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
