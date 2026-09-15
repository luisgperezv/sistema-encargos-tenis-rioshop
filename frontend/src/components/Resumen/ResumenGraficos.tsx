import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import type { GraficosResumen } from "../../services/resumen";

interface Props {
  data: GraficosResumen;
}

const formatCOP = (val: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(val);
};

const COLOR_MAP: Record<string, string> = {
  ingreso: "#3b82f6",
  costo: "#f87171",
  utilidad_bruta: "#10b981",
  gasto: "#ef4444",
  utilidad_neta: "#8b5cf6",
};

const PALETA_CATEGORIAS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export default function ResumenGraficos({ data }: Props) {
  const tieneGastos = data.gastos_por_categoria && data.gastos_por_categoria.length > 0;

  return (
    <div className="resumen-graficos-grid">
      {/* Gráfico 1: Cascada Financiera */}
      <div className="resumen-grafico-box">
        <div className="grafico-header">
          <h4>Flujo Financiero del Período</h4>
          <span className="grafico-sub">De Ingresos hasta Utilidad Neta Real</span>
        </div>
        <div className="grafico-body">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data.flujo_financiero}
              margin={{ top: 15, right: 10, left: 10, bottom: 25 }}
            >
              <XAxis
                dataKey="etiqueta"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                interval={0}
                angle={-12}
                textAnchor="end"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(val) => `$${Math.round(val / 1000)}k`}
              />
              <Tooltip
                formatter={(val: any) => [formatCOP(Number(val)), "Monto"]}
                contentStyle={{
                  backgroundColor: "#1e293b",
                  borderColor: "#334155",
                  borderRadius: "8px",
                  color: "#ffffff",
                }}
              />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                {data.flujo_financiero.map((item, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={COLOR_MAP[item.tipo] || "#3b82f6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gráfico 2: Desglose de Gastos por Categoría */}
      <div className="resumen-grafico-box">
        <div className="grafico-header">
          <h4>Distribución de Gastos Operativos</h4>
          <span className="grafico-sub">Destino de los egresos en el período</span>
        </div>
        <div className="grafico-body">
          {tieneGastos ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.gastos_por_categoria}
                  dataKey="total"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {data.gastos_por_categoria.map((_, idx) => (
                    <Cell
                      key={`cat-cell-${idx}`}
                      fill={PALETA_CATEGORIAS[idx % PALETA_CATEGORIAS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatCOP(Number(val)), "Gasto"]}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: "#cbd5e1", fontSize: "0.8rem" }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grafico-empty-state">
              <p>Sin gastos registrados en este período.</p>
              <small>Los egresos ingresados en Gastos se reflejarán automáticamente aquí.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
