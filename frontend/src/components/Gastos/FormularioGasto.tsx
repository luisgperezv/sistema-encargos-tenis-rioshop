import { useState, useEffect, type FormEvent } from "react";
import type { Gasto, GastoForm } from "../../services/gastos";
import { AlertCircle, X, HelpCircle } from "lucide-react";

const CATEGORIAS = [
  "Publicidad",
  "Arriendo",
  "Servicios",
  "Personal",
  "Medias",
  "Empaques",
  "Transporte",
  "Mantenimiento",
  "Software",
  "Impuestos",
  "Otros",
];

const METODOS_PAGO = [
  "Efectivo",
  "Transferencia",
  "Tarjeta Débito",
  "Nequi",
  "Otro",
];

const AYUDAS_CATEGORIA: Record<string, string> = {
  Transporte: "Solo movilización general del negocio. No registrar aquí el flete de un encargo.",
  Personal: "Solo comisiones o salarios generales. No registrar aquí el costo_despachador de un encargo.",
};

const HOY = new Date().toISOString().split("T")[0];

interface FormularioGastoProps {
  gastoEditar?: Gasto | null;
  onGuardar: (data: GastoForm) => Promise<void>;
  onCerrar: () => void;
  cargando: boolean;
}

export default function FormularioGasto({
  gastoEditar,
  onGuardar,
  onCerrar,
  cargando,
}: FormularioGastoProps) {
  const [fecha, setFecha] = useState(gastoEditar ? gastoEditar.fecha : HOY);
  const [categoria, setCategoria] = useState(gastoEditar ? gastoEditar.categoria : "");
  const [descripcion, setDescripcion] = useState(gastoEditar ? gastoEditar.descripcion : "");
  const [valor, setValor] = useState<number | "">(gastoEditar ? gastoEditar.valor : "");
  const [metodoPago, setMetodoPago] = useState(gastoEditar ? gastoEditar.metodo_pago : "Efectivo");
  const [observaciones, setObservaciones] = useState(gastoEditar?.observaciones || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gastoEditar) {
      setFecha(gastoEditar.fecha);
      setCategoria(gastoEditar.categoria);
      setDescripcion(gastoEditar.descripcion);
      setValor(gastoEditar.valor);
      setMetodoPago(gastoEditar.metodo_pago);
      setObservaciones(gastoEditar.observaciones || "");
    }
  }, [gastoEditar]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fecha) {
      setError("La fecha es obligatoria");
      return;
    }
    if (fecha > HOY) {
      setError("La fecha del gasto no puede ser futura");
      return;
    }
    if (!categoria) {
      setError("Debes seleccionar una categoría");
      return;
    }
    if (!descripcion.trim() || descripcion.trim().length < 3) {
      setError("La descripción debe tener al menos 3 caracteres");
      return;
    }
    const valNumerico = typeof valor === "number" ? Math.round(valor) : parseInt(String(valor), 10);
    if (isNaN(valNumerico) || valNumerico <= 0) {
      setError("El valor debe ser un monto mayor a 0 COP");
      return;
    }
    if (!metodoPago) {
      setError("Debes seleccionar un método de pago");
      return;
    }

    try {
      await onGuardar({
        fecha,
        categoria,
        descripcion: descripcion.trim(),
        valor: valNumerico,
        metodo_pago: metodoPago,
        observaciones: observaciones.trim(),
      });
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error al guardar el gasto");
    }
  };

  return (
    <div className="gastos-modal-backdrop" onClick={onCerrar}>
      <div className="gastos-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="gastos-modal-header">
          <h3>{gastoEditar ? "Editar Gasto" : "Registrar Nuevo Gasto"}</h3>
          <button type="button" className="gastos-btn-icon" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="gastos-alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="gastos-form">
          <div className="gastos-form-grid">
            <div className="gastos-form-group">
              <label htmlFor="gasto-fecha">Fecha *</label>
              <input
                id="gasto-fecha"
                type="date"
                value={fecha}
                max={HOY}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>

            <div className="gastos-form-group">
              <label htmlFor="gasto-categoria">Categoría *</label>
              <select
                id="gasto-categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                required
              >
                <option value="">-- Seleccionar --</option>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advertencia anti-doble-conteo */}
          {categoria && AYUDAS_CATEGORIA[categoria] && (
            <div className="gastos-advertencia-doble-conteo">
              <HelpCircle size={18} />
              <span>{AYUDAS_CATEGORIA[categoria]}</span>
            </div>
          )}

          <div className="gastos-form-group">
            <label htmlFor="gasto-descripcion">Descripción *</label>
            <input
              id="gasto-descripcion"
              type="text"
              placeholder="Ej: Pauta en Instagram para campaña fin de mes"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="gastos-form-grid">
            <div className="gastos-form-group">
              <label htmlFor="gasto-valor">Valor en COP (sin decimales) *</label>
              <input
                id="gasto-valor"
                type="number"
                placeholder="150000"
                value={valor}
                min="1"
                step="1"
                onChange={(e) => {
                  const v = e.target.value;
                  setValor(v === "" ? "" : Math.floor(Number(v)));
                }}
                required
              />
            </div>

            <div className="gastos-form-group">
              <label htmlFor="gasto-metodo">Método de Pago *</label>
              <select
                id="gasto-metodo"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                required
              >
                {METODOS_PAGO.map((met) => (
                  <option key={met} value={met}>
                    {met}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="gastos-form-group">
            <label htmlFor="gasto-observaciones">Observaciones (Opcional)</label>
            <textarea
              id="gasto-observaciones"
              placeholder="Notas adicionales, número de factura o comprobante..."
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="gastos-modal-footer">
            <button
              type="button"
              className="gastos-btn-cancelar"
              onClick={onCerrar}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="gastos-btn-guardar"
              disabled={cargando}
            >
              {cargando
                ? "Guardando..."
                : gastoEditar
                ? "Guardar Cambios"
                : "Registrar Gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
