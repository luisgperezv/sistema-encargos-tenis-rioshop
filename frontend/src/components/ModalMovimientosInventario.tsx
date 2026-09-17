import { useEffect, useState } from "react";
import { obtenerMovimientosInventarioRequest } from "../services/api";
import type { InventarioMovimientosResponse } from "../services/api";
import {
  X,
  Layers,
  Calendar,
  DollarSign,
  Package,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Ban,
  Tag,
  Info,
  PackageCheck,
} from "lucide-react";

interface ModalMovimientosInventarioProps {
  inventarioId: number | null;
  onClose: () => void;
}

const formatearPesos = (valor: number | undefined | null) => {
  const v = valor || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
};

const formatearFecha = (fechaStr?: string | null) => {
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

export const ModalMovimientosInventario = ({
  inventarioId,
  onClose,
}: ModalMovimientosInventarioProps) => {
  const [data, setData] = useState<InventarioMovimientosResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabActivo, setTabActivo] = useState<"tallas" | "lotes">("tallas");
  const [lotesExpandidos, setLotesExpandidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!inventarioId) return;

    let isMounted = true;
    setCargando(true);
    setError(null);

    obtenerMovimientosInventarioRequest(inventarioId)
      .then((res) => {
        if (!isMounted) return;
        if (res.detail) {
          setError(res.detail);
        } else {
          setData(res);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Error al cargar movimientos");
      })
      .finally(() => {
        if (isMounted) setCargando(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inventarioId]);

  // Cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!inventarioId) return null;

  const toggleExpandirLote = (loteId: number) => {
    setLotesExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(loteId)) {
        next.delete(loteId);
      } else {
        next.add(loteId);
      }
      return next;
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-movimientos-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="modal-header modal-movimientos-header">
          <div className="mov-header-info-wrap">
            <div className="mov-header-top-row">
              <span className="mov-badge-modulo">
                <Layers size={13} /> Movimientos y Lotes FIFO
              </span>
              <span className="mov-badge-inv-id">#Inv-{inventarioId}</span>
            </div>
            <h2 className="mov-header-title">
              {data?.producto.marca} - {data?.producto.referencia}
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Cerrar modal">
            <X size={20} />
          </button>
        </div>

        {/* Resumen KPI Superior */}
        {data && (
          <div className="mov-kpis-banner">
            {data.producto.foto && (
              <img
                src={data.producto.foto}
                alt={data.producto.referencia}
                className="mov-producto-thumb"
              />
            )}
            <div className="mov-kpi-chip">
              <span className="mov-kpi-lbl">
                <Package size={14} /> Stock Total
              </span>
              <span className="mov-kpi-val mov-val-stock">
                {data.producto.stock_total} {data.producto.stock_total === 1 ? "par" : "pares"}
              </span>
            </div>
            <div className="mov-kpi-chip">
              <span className="mov-kpi-lbl">
                <DollarSign size={14} /> Valorización en Bodega
              </span>
              <span className="mov-kpi-val mov-val-dinero">
                {formatearPesos(data.producto.valor_inventario_total)}
              </span>
            </div>
            <div className="mov-kpi-chip">
              <span className="mov-kpi-lbl">
                <Tag size={14} /> Precio Sugerido
              </span>
              <span className="mov-kpi-val">
                {formatearPesos(data.producto.precio_sugerido)}
              </span>
            </div>
          </div>
        )}

        {/* Selector de Pestañas */}
        <div className="mov-tabs-bar">
          <button
            type="button"
            className={`mov-tab-btn ${tabActivo === "tallas" ? "mov-tab-active" : ""}`}
            onClick={() => setTabActivo("tallas")}
          >
            <PackageCheck size={16} />
            <span>Resumen por Talla</span>
            {data && <span className="mov-tab-count">{data.resumen_tallas.length}</span>}
          </button>
          <button
            type="button"
            className={`mov-tab-btn ${tabActivo === "lotes" ? "mov-tab-active" : ""}`}
            onClick={() => setTabActivo("lotes")}
          >
            <Calendar size={16} />
            <span>Historial de Lotes y Entradas</span>
            {data && <span className="mov-tab-count">{data.historial_lotes.length}</span>}
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="modal-body mov-modal-body">
          {cargando ? (
            <div className="mov-loading">
              <div className="mov-spinner"></div>
              <p>Cargando capas y trazabilidad de lotes...</p>
            </div>
          ) : error ? (
            <div className="mov-error-box">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button className="btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : data ? (
            <>
              {/* TAB 1: RESUMEN POR TALLA */}
              {tabActivo === "tallas" && (
                <div className="mov-tallas-container">
                  <div className="mov-section-help">
                    <Info size={15} />
                    <span>
                      Stock físico actual por talla y desglose de capas de costos activas en bodega.
                    </span>
                  </div>

                  <div className="mov-tallas-grid">
                    {data.resumen_tallas.map((t) => (
                      <div
                        key={t.talla_id}
                        className={`mov-talla-card ${t.stock_actual === 0 ? "mov-talla-agotada" : ""}`}
                      >
                        <div className="mov-talla-card-header">
                          <div className="mov-talla-titulos">
                            <span className="mov-talla-eur">EUR {t.talla_eur}</span>
                            <span className="mov-talla-col">COL {t.talla_col}</span>
                          </div>
                          <div className="mov-talla-stock-badge">
                            <span className="mov-stock-num">{t.stock_actual}</span>
                            <span className="mov-stock-lbl">
                              {t.stock_actual === 1 ? "und" : "unds"}
                            </span>
                          </div>
                        </div>

                        <div className="mov-talla-val-row">
                          <span className="mov-talla-val-lbl">Valor en stock:</span>
                          <span className="mov-talla-val-num">
                            {formatearPesos(t.valor_stock)}
                          </span>
                        </div>

                        {/* Capas activas */}
                        <div className="mov-talla-capas">
                          <span className="mov-capas-title">Capas de costo disponibles:</span>
                          {t.capas_activas.length === 0 ? (
                            <span className="mov-capas-empty">
                              Sin unidades disponibles (Agotada)
                            </span>
                          ) : (
                            <div className="mov-capas-list">
                              {t.capas_activas.map((capa) => (
                                <div key={capa.lote_id} className="mov-capa-pill">
                                  <span className="mov-capa-cant">
                                    {capa.cantidad_disponible} {capa.cantidad_disponible === 1 ? "und" : "unds"}
                                  </span>
                                  <span className="mov-capa-separador">@</span>
                                  <span className="mov-capa-costo">
                                    {formatearPesos(capa.costo_unitario)}
                                  </span>
                                  <span className="mov-capa-fecha">
                                    ({formatearFecha(capa.fecha_ingreso)})
                                  </span>
                                  <span className="mov-capa-lote-id">
                                    #L{capa.lote_id}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: HISTORIAL DE LOTES / ENTRADAS */}
              {tabActivo === "lotes" && (
                <div className="mov-lotes-container">
                  <div className="mov-section-help">
                    <Info size={15} />
                    <span>
                      Registro cronológico de reposiciones. Toca "Ver salidas" en cualquier lote para auditar qué ventas consumieron sus unidades.
                    </span>
                  </div>

                  {data.historial_lotes.length === 0 ? (
                    <div className="mov-empty-state">
                      <Package size={36} />
                      <p>No hay lotes registrados para este artículo.</p>
                    </div>
                  ) : (
                    <div className="mov-lotes-lista">
                      {data.historial_lotes.map((lote) => {
                        const expandido = lotesExpandidos.has(lote.lote_id);
                        const esActivo = lote.estado === "activo";
                        return (
                          <div
                            key={lote.lote_id}
                            className={`mov-lote-card ${esActivo ? "mov-lote-activo" : "mov-lote-agotado"}`}
                          >
                            <div className="mov-lote-main-row">
                              <div className="mov-lote-col-id">
                                <span className="mov-lote-badge">LOTE-{lote.lote_id}</span>
                                <span className="mov-lote-fecha">
                                  {formatearFecha(lote.fecha_ingreso)}
                                </span>
                              </div>

                              <div className="mov-lote-col-talla">
                                <span className="mov-lote-eur">EUR {lote.talla_eur}</span>
                                <span className="mov-lote-col-txt">COL {lote.talla_col}</span>
                              </div>

                              <div className="mov-lote-col-cantidades">
                                <div className="mov-cant-item">
                                  <span className="mov-cant-lbl">Inicial:</span>
                                  <span className="mov-cant-val">{lote.cantidad_inicial}</span>
                                </div>
                                <div className="mov-cant-item">
                                  <span className="mov-cant-lbl">Disponible:</span>
                                  <span className={`mov-cant-val ${lote.cantidad_disponible > 0 ? "mov-cant-disp" : "mov-cant-cero"}`}>
                                    {lote.cantidad_disponible}
                                  </span>
                                </div>
                                <div className="mov-cant-item">
                                  <span className="mov-cant-lbl">Consumido neto:</span>
                                  <span className="mov-cant-val mov-cant-cons">
                                    {lote.cantidad_consumida_neta}
                                  </span>
                                </div>
                              </div>

                              <div className="mov-lote-col-valores">
                                <div>
                                  <span className="mov-val-lbl">Costo unitario:</span>
                                  <span className="mov-val-num">
                                    {formatearPesos(lote.costo_unitario)}
                                  </span>
                                </div>
                                <div>
                                  <span className="mov-val-lbl">Valor disponible:</span>
                                  <span className="mov-val-num mov-val-disp-dinero">
                                    {formatearPesos(lote.valor_disponible)}
                                  </span>
                                </div>
                              </div>

                              <div className="mov-lote-col-estado">
                                {esActivo ? (
                                  <span className="mov-status-pill mov-status-activo">
                                    <CheckCircle2 size={12} /> ACTIVO
                                  </span>
                                ) : (
                                  <span className="mov-status-pill mov-status-agotado">
                                    AGOTADO
                                  </span>
                                )}
                              </div>

                              <div className="mov-lote-col-accion">
                                <button
                                  type="button"
                                  className={`mov-btn-expandir ${expandido ? "mov-btn-expandido" : ""}`}
                                  onClick={() => toggleExpandirLote(lote.lote_id)}
                                  title="Ver ventas que consumieron este lote"
                                >
                                  <span>Salidas ({lote.salidas.length})</span>
                                  {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>
                            </div>

                            {/* Observaciones si existen */}
                            {lote.observaciones && (
                              <div className="mov-lote-obs-row">
                                <span className="mov-obs-tag">Nota:</span>
                                <span className="mov-obs-text">{lote.observaciones}</span>
                              </div>
                            )}

                            {/* Acordeón de Salidas / Consumos por Venta */}
                            {expandido && (
                              <div className="mov-salidas-panel">
                                <div className="mov-salidas-header">
                                  <h4>Trazabilidad de Ventas para LOTE-{lote.lote_id}</h4>
                                  <span className="mov-salidas-sub">
                                    Consumo FIFO registrado por caja o checkout POS
                                  </span>
                                </div>

                                {lote.salidas.length === 0 ? (
                                  <div className="mov-salidas-empty">
                                    No se han registrado consumos para este lote (todas las unidades permanecen en bodega).
                                  </div>
                                ) : (
                                  <div className="mov-salidas-table-wrap">
                                    <table className="mov-salidas-table">
                                      <thead>
                                        <tr>
                                          <th>Transacción / # Venta</th>
                                          <th>Fecha</th>
                                          <th>Cliente</th>
                                          <th className="mov-text-center">Cant. Consumida</th>
                                          <th className="mov-text-right">Costo Unitario</th>
                                          <th className="mov-text-right">Costo Total</th>
                                          <th className="mov-text-center">Estado Venta</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lote.salidas.map((s) => {
                                          const esAnulada = s.estado_venta === "anulada";
                                          return (
                                            <tr
                                              key={s.consumo_id}
                                              className={esAnulada ? "mov-salida-fila-anulada" : ""}
                                            >
                                              <td>
                                                <div className="mov-salida-ticket">
                                                  <span className="mov-ticket-num">
                                                    {s.numero_venta}
                                                  </span>
                                                  <span className="mov-ticket-sub">
                                                    ID Venta #{s.venta_id}
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="mov-salida-fecha">
                                                {formatearFecha(s.fecha_venta)}
                                              </td>
                                              <td>
                                                {s.cliente_nombre || "Cliente casual"}
                                              </td>
                                              <td className="mov-text-center">
                                                <span className={`mov-salida-cant-badge ${esAnulada ? "mov-cant-anulada" : ""}`}>
                                                  {s.cantidad} {s.cantidad === 1 ? "par" : "pares"}
                                                </span>
                                              </td>
                                              <td className="mov-text-right">
                                                {formatearPesos(s.costo_unitario)}
                                              </td>
                                              <td className="mov-text-right mov-font-semibold">
                                                {formatearPesos(s.costo_total)}
                                              </td>
                                              <td className="mov-text-center">
                                                {esAnulada ? (
                                                  <div className="mov-anulada-tag-wrap">
                                                    <span className="mov-badge-venta-anulada">
                                                      <Ban size={11} /> ANULADA / REINTEGRADA
                                                    </span>
                                                    <span className="mov-anulada-subinfo">
                                                      (+{s.cantidad} devueltos al lote)
                                                    </span>
                                                    {s.motivo_anulacion && (
                                                      <span className="mov-anulada-motivo" title={s.motivo_anulacion}>
                                                        Motivo: "{s.motivo_anulacion}"
                                                      </span>
                                                    )}
                                                  </div>
                                                ) : (
                                                  <span className="mov-badge-venta-ok">
                                                    COMPLETADA
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer del Modal */}
        <div className="modal-footer mov-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
