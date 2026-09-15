import { DollarSign, TrendingUp, ShoppingBag, Receipt, PieChart, ShieldAlert } from "lucide-react";
import type { MetricasFinancieras } from "../../services/resumen";

interface Props {
  data: MetricasFinancieras;
}

const formatCOP = (val: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function ResumenKpis({ data }: Props) {
  const netaPositiva = data.utilidad_neta >= 0;

  return (
    <div className="resumen-kpis-grid">
      {/* 1. Ingresos por Ventas */}
      <div className="resumen-kpi-card">
        <div className="resumen-kpi-header">
          <span className="resumen-kpi-title">Ventas Realizadas</span>
          <div className="resumen-kpi-icon icon-ingresos">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="resumen-kpi-value">{formatCOP(data.ingresos_totales)}</div>
        <div className="resumen-kpi-sub">
          <span>{data.transacciones_totales} transacciones</span>
          <span>•</span>
          <span>{data.pares_vendidos} pares entregados</span>
        </div>
      </div>

      {/* 2. Costos Directos */}
      <div className="resumen-kpi-card">
        <div className="resumen-kpi-header">
          <span className="resumen-kpi-title">Costos Directos</span>
          <div className="resumen-kpi-icon icon-costos">
            <ShoppingBag size={20} />
          </div>
        </div>
        <div className="resumen-kpi-value">{formatCOP(data.costos_directos)}</div>
        <div className="resumen-kpi-sub">
          <span>Base + fletes + despachos</span>
        </div>
      </div>

      {/* 3. Utilidad Bruta */}
      <div className="resumen-kpi-card">
        <div className="resumen-kpi-header">
          <span className="resumen-kpi-title">Utilidad Bruta</span>
          <div className="resumen-kpi-icon icon-bruta">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="resumen-kpi-value" style={{ color: "#34d399" }}>
          {formatCOP(data.utilidad_bruta)}
        </div>
        <div className="resumen-kpi-sub">
          <span className="badge-margen">Margen {data.margen_bruto}%</span>
          <span>Ticket prom: {formatCOP(data.ticket_promedio)}</span>
        </div>
      </div>

      {/* 4. Gastos Operativos */}
      <div className="resumen-kpi-card">
        <div className="resumen-kpi-header">
          <span className="resumen-kpi-title">Gastos Operativos</span>
          <div className="resumen-kpi-icon icon-gastos">
            <Receipt size={20} />
          </div>
        </div>
        <div className="resumen-kpi-value" style={{ color: "#f87171" }}>
          {formatCOP(data.gastos_operativos)}
        </div>
        <div className="resumen-kpi-sub">
          <span>Egresos generales del período</span>
        </div>
      </div>

      {/* 5. Utilidad Neta */}
      <div className={`resumen-kpi-card kpi-destacado ${netaPositiva ? "neta-positiva" : "neta-negativa"}`}>
        <div className="resumen-kpi-header">
          <span className="resumen-kpi-title">Utilidad Neta Real</span>
          <div className="resumen-kpi-icon icon-neta">
            {netaPositiva ? <PieChart size={20} /> : <ShieldAlert size={20} />}
          </div>
        </div>
        <div className="resumen-kpi-value">
          {formatCOP(data.utilidad_neta)}
        </div>
        <div className="resumen-kpi-sub">
          <span className={`badge-margen ${netaPositiva ? "margen-positivo" : "margen-negativo"}`}>
            Margen Neto {data.margen_neto}%
          </span>
          <span className="text-explicativo">Bruta − Gastos</span>
        </div>
      </div>
    </div>
  );
}
