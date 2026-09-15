import { Calendar, Filter } from "lucide-react";

interface Props {
  periodoActual: string;
  fechaDesde: string;
  fechaHasta: string;
  onCambiarPeriodo: (periodo: string) => void;
  onCambiarFechaDesde: (fecha: string) => void;
  onCambiarFechaHasta: (fecha: string) => void;
  onAplicarPersonalizado: () => void;
}

const OPCIONES_PERIODO = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Esta Semana" },
  { id: "mes", label: "Este Mes" },
  { id: "anio", label: "Este Año" },
  { id: "historico", label: "Histórico" },
  { id: "personalizado", label: "Personalizado" },
];

export default function ResumenFiltros({
  periodoActual,
  fechaDesde,
  fechaHasta,
  onCambiarPeriodo,
  onCambiarFechaDesde,
  onCambiarFechaHasta,
  onAplicarPersonalizado,
}: Props) {
  return (
    <div className="resumen-filtros-bar">
      <div className="filtros-chips-container">
        {OPCIONES_PERIODO.map((opc) => (
          <button
            key={opc.id}
            type="button"
            className={`filtro-chip ${periodoActual === opc.id ? "filtro-chip-activo" : ""}`}
            onClick={() => onCambiarPeriodo(opc.id)}
          >
            {opc.label}
          </button>
        ))}
      </div>

      {periodoActual === "personalizado" && (
        <div className="filtros-rango-personalizado">
          <div className="input-fecha-wrapper">
            <Calendar size={15} />
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => onCambiarFechaDesde(e.target.value)}
              placeholder="Desde"
            />
          </div>
          <span className="separador-fechas">a</span>
          <div className="input-fecha-wrapper">
            <Calendar size={15} />
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => onCambiarFechaHasta(e.target.value)}
              placeholder="Hasta"
            />
          </div>
          <button
            type="button"
            className="btn-aplicar-rango"
            onClick={onAplicarPersonalizado}
          >
            <Filter size={14} />
            <span>Consultar</span>
          </button>
        </div>
      )}
    </div>
  );
}
