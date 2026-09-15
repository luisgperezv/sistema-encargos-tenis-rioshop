import { Clock, Truck, Store, AlertCircle, ArrowUpRight } from "lucide-react";
import type { PanelOperativo } from "../../services/resumen";

interface Props {
  data: PanelOperativo;
}

const formatCOP = (val: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function ResumenPanelOperativo({ data }: Props) {
  return (
    <div className="resumen-operativo-section">
      <div className="resumen-section-header">
        <div>
          <h3>Centro de Control Operativo (En Vivo)</h3>
          <p className="resumen-section-desc">
            Seguimiento de pedidos activos en proceso y cartera pendiente por cobrar.
          </p>
        </div>
        <div className="badge-total-activos">
          <span>{data.total_activos} encargos en curso</span>
        </div>
      </div>

      {/* Estados del calzado */}
      <div className="operativo-estados-grid">
        {/* Pendientes */}
        <div className="operativo-estado-card estado-pendiente">
          <div className="estado-card-top">
            <div className="estado-icon-wrapper">
              <Clock size={18} />
            </div>
            <span className="estado-nombre">Pendientes</span>
            <span className="estado-cant-badge">{data.pendientes.cantidad}</span>
          </div>
          <div className="estado-montos">
            <div>
              <span className="monto-label">Por cobrar:</span>
              <strong className="monto-valor">{formatCOP(data.pendientes.saldo_por_cobrar)}</strong>
            </div>
            <div>
              <span className="monto-label">Abonos:</span>
              <span className="monto-valor-sub">{formatCOP(data.pendientes.abonos_recibidos)}</span>
            </div>
          </div>
        </div>

        {/* Despachados */}
        <div className="operativo-estado-card estado-despachado">
          <div className="estado-card-top">
            <div className="estado-icon-wrapper">
              <Truck size={18} />
            </div>
            <span className="estado-nombre">Despachados</span>
            <span className="estado-cant-badge">{data.despachados.cantidad}</span>
          </div>
          <div className="estado-montos">
            <div>
              <span className="monto-label">Por cobrar:</span>
              <strong className="monto-valor">{formatCOP(data.despachados.saldo_por_cobrar)}</strong>
            </div>
            <div>
              <span className="monto-label">En camino:</span>
              <span className="monto-valor-sub">{formatCOP(data.despachados.valor_comprometido)}</span>
            </div>
          </div>
        </div>

        {/* En Local */}
        <div className="operativo-estado-card estado-local">
          <div className="estado-card-top">
            <div className="estado-icon-wrapper">
              <Store size={18} />
            </div>
            <span className="estado-nombre">En Local (Listos)</span>
            <span className="estado-cant-badge">{data.en_local.cantidad}</span>
          </div>
          <div className="estado-montos">
            <div>
              <span className="monto-label">Por recaudar:</span>
              <strong className="monto-valor" style={{ color: "#34d399" }}>
                {formatCOP(data.en_local.saldo_por_cobrar)}
              </strong>
            </div>
            <div>
              <span className="monto-label">Listos para entrega</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas de Cartera y Proyección */}
      <div className="operativo-cartera-grid">
        {/* Abonos recibidos (Anticipos) */}
        <div className="cartera-card">
          <div className="cartera-card-header">
            <span className="cartera-card-title">Abonos Recibidos</span>
            <div className="tooltip-badge">Anticipos</div>
          </div>
          <div className="cartera-card-val" style={{ color: "#60a5fa" }}>
            {formatCOP(data.abonos_recibidos_activos)}
          </div>
          <div className="cartera-card-note">
            <AlertCircle size={14} />
            <span>Anticipos de encargos activos — no son ventas realizadas aún.</span>
          </div>
        </div>

        {/* Saldo por cobrar */}
        <div className="cartera-card">
          <div className="cartera-card-header">
            <span className="cartera-card-title">Saldo por Cobrar</span>
            <div className="tooltip-badge">Cartera</div>
          </div>
          <div className="cartera-card-val" style={{ color: "#f59e0b" }}>
            {formatCOP(data.saldo_por_cobrar_activos)}
          </div>
          <div className="cartera-card-note">
            <span>Dinero por recaudar al momento de entregar el calzado.</span>
          </div>
        </div>

        {/* Utilidad proyectada */}
        <div className="cartera-card">
          <div className="cartera-card-header">
            <span className="cartera-card-title">Utilidad Bruta Proyectada</span>
            <div className="tooltip-badge proy-badge">
              <ArrowUpRight size={13} />
              <span>Proyección</span>
            </div>
          </div>
          <div className="cartera-card-val" style={{ color: "#a78bfa" }}>
            {formatCOP(data.utilidad_proyectada_total)}
          </div>
          <div className="cartera-card-note">
            <span>Expectativa de ganancia bruta ({data.cobertura_costos_activos} con costo).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
