import type { Gasto } from "../../services/gastos";
import { Edit2, Trash2, Calendar, CreditCard, FileText } from "lucide-react";

interface TablaGastosProps {
  gastos: Gasto[];
  onEditar: (gasto: Gasto) => void;
  onEliminar: (gasto: Gasto) => void;
}

const formatearCOP = (valor: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

export default function TablaGastos({
  gastos,
  onEditar,
  onEliminar,
}: TablaGastosProps) {
  if (gastos.length === 0) {
    return (
      <div className="gastos-empty-state">
        <FileText size={48} className="gastos-empty-icon" />
        <h4>No se encontraron gastos</h4>
        <p>No hay gastos registrados en el período o con los filtros seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="gastos-tabla-container">
      {/* Vista Desktop: Tabla completa */}
      <div className="gastos-desktop-view">
        <table className="gastos-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Método</th>
              <th className="text-right">Valor (COP)</th>
              <th>Observaciones</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((gasto) => (
              <tr key={gasto.id}>
                <td className="gastos-td-fecha">
                  <span className="gastos-badge-fecha">{gasto.fecha}</span>
                </td>
                <td>
                  <span className="gastos-categoria-badge">{gasto.categoria}</span>
                </td>
                <td className="gastos-td-desc">
                  <div className="gastos-desc-text" title={gasto.descripcion}>
                    {gasto.descripcion}
                  </div>
                </td>
                <td>
                  <span className="gastos-metodo-tag">{gasto.metodo_pago}</span>
                </td>
                <td className="text-right gastos-td-valor">
                  {formatearCOP(gasto.valor)}
                </td>
                <td className="gastos-td-obs">
                  <span className="gastos-obs-text" title={gasto.observaciones || "-"}>
                    {gasto.observaciones || "-"}
                  </span>
                </td>
                <td className="text-center">
                  <div className="gastos-acciones-cell">
                    <button
                      type="button"
                      className="gastos-btn-accion gastos-btn-edit"
                      onClick={() => onEditar(gasto)}
                      title="Editar gasto"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      className="gastos-btn-accion gastos-btn-delete"
                      onClick={() => onEliminar(gasto)}
                      title="Eliminar gasto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil: Tarjetas compactas sin overflow horizontal */}
      <div className="gastos-mobile-view">
        {gastos.map((gasto) => (
          <div key={gasto.id} className="gastos-card-mobile">
            <div className="gastos-card-header">
              <div className="gastos-card-fecha-cat">
                <span className="gastos-card-cat">{gasto.categoria}</span>
                <span className="gastos-card-fecha">
                  <Calendar size={13} />
                  {gasto.fecha}
                </span>
              </div>
              <div className="gastos-card-monto">
                {formatearCOP(gasto.valor)}
              </div>
            </div>

            <div className="gastos-card-desc">
              {gasto.descripcion}
            </div>

            {gasto.observaciones && (
              <div className="gastos-card-obs">
                <small>Nota: {gasto.observaciones}</small>
              </div>
            )}

            <div className="gastos-card-footer">
              <span className="gastos-card-metodo">
                <CreditCard size={13} />
                {gasto.metodo_pago}
              </span>
              <div className="gastos-card-actions">
                <button
                  type="button"
                  className="gastos-mobile-btn gastos-mobile-edit"
                  onClick={() => onEditar(gasto)}
                >
                  <Edit2 size={14} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  className="gastos-mobile-btn gastos-mobile-del"
                  onClick={() => onEliminar(gasto)}
                >
                  <Trash2 size={14} />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
