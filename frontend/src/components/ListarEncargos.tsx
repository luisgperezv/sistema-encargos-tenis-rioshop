import { useEffect, useState } from "react";
import {
  listarEncargosRequest,
  actualizarEstadoEncargoRequest,
  agregarAbonoEncargoRequest,
  editarEncargoRequest,
  listarProveedoresRequest,
} from "../services/api";

const colorEstado = (estado: string) => {
  if (estado === "pendiente") return "#ffd6d6";
  if (estado === "despachado") return "#fff3bf";
  if (estado === "entregado") return "#d3f9d8";
  if (estado === "pedido") return "#d0ebff";
  if (estado === "en_local") return "#e5dbff";
  if (estado === "cancelado") return "#dee2e6";

  return "#ffffff";
};

const formatearPesos = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

function ListarEncargos() {
  const [encargos, setEncargos] = useState<any[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [abonos, setAbonos] = useState<{ [key: number]: string }>({});
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [encargoEditando, setEncargoEditando] = useState<any | null>(null);
  const [proveedores, setProveedores] = useState<any[]>([]);

  const [editReferencia, setEditReferencia] = useState("");
  const [editTallaCol, setEditTallaCol] = useState("");
  const [editTallaEur, setEditTallaEur] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [editFechaEntrega, setEditFechaEntrega] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const [editProveedorId, setEditProveedorId] = useState("");

  const cargarEncargos = async () => {
    const data = await listarEncargosRequest(buscar, estadoFiltro);

    if (Array.isArray(data)) {
      setEncargos(data);
    } else {
      setMensaje("❌ Error al cargar encargos");
    }
  };

  const cambiarEstado = async (encargoId: number, nuevoEstado: string) => {
    const respuesta = await actualizarEstadoEncargoRequest(
      encargoId,
      nuevoEstado,
    );

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === encargoId ? respuesta : encargo)),
      );
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al actualizar estado");
    }
  };

  const agregarAbono = async (encargoId: number) => {
    const valor = Number(abonos[encargoId]);

    if (!valor || valor <= 0) {
      alert("Ingresa un abono válido");
      return;
    }

    const respuesta = await agregarAbonoEncargoRequest(encargoId, valor);

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === encargoId ? respuesta : encargo)),
      );

      setAbonos((prev) => ({
        ...prev,
        [encargoId]: "",
      }));
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al agregar abono");
    }
  };

  const abrirEdicion = (encargo: any) => {
    setEncargoEditando(encargo);

    setEditReferencia(encargo.referencia);
    setEditTallaCol(encargo.talla_col);
    setEditTallaEur(encargo.talla_eur);
    setEditPrecio(String(encargo.precio));
    setEditFechaEntrega(encargo.fecha_entrega_estimada || "");
    setEditObservaciones(encargo.observaciones || "");
    setEditProveedorId(
      encargo.proveedor_id ? String(encargo.proveedor_id) : "",
    );
  };
  const guardarEdicion = async () => {
    if (!encargoEditando) return;

    const respuesta = await editarEncargoRequest(encargoEditando.id, {
      proveedor_id: editProveedorId ? Number(editProveedorId) : null,
      referencia: editReferencia,
      talla_col: editTallaCol,
      talla_eur: editTallaEur,
      foto: encargoEditando.foto || null,
      precio: Number(editPrecio),
      fecha_entrega_estimada: editFechaEntrega || null,
      observaciones: editObservaciones || null,
    });

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) =>
          encargo.id === respuesta.id ? respuesta : encargo,
        ),
      );

      setEncargoEditando(null);
      setMensaje("✅ Encargo actualizado correctamente");
    } else if (respuesta.detail) {
      setMensaje(`❌ ${respuesta.detail}`);
    } else {
      setMensaje("❌ Error al actualizar encargo");
    }
  };

  useEffect(() => {
    cargarEncargos();

    const cargarProveedores = async () => {
      const data = await listarProveedoresRequest();

      if (Array.isArray(data)) {
        setProveedores(data);
      }
    };

    cargarProveedores();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Listado de Encargos</h1>

      <input
        placeholder="Buscar por cliente, referencia o ID"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
      />

      <select
        value={estadoFiltro}
        onChange={(e) => setEstadoFiltro(e.target.value)}
      >
        <option value="">Todos los estados</option>
        <option value="pendiente">Pendiente</option>
        <option value="pedido">Pedido</option>
        <option value="despachado">Despachado</option>
        <option value="en_local">En local</option>
        <option value="entregado">Entregado</option>
        <option value="cancelado">Cancelado</option>
      </select>

      <button onClick={cargarEncargos}>Buscar</button>

      <br />
      <br />

      {mensaje && <p>{mensaje}</p>}
      {encargoEditando && (
        <div
          style={{
            border: "2px solid #000",
            padding: "15px",
            marginBottom: "20px",
          }}
        >
          <h2>Editando encargo #{encargoEditando.id}</h2>

          <label>Proveedor</label>
          <br />
          <select
            value={editProveedorId}
            onChange={(e) => setEditProveedorId(e.target.value)}
          >
            <option value="">Sin proveedor</option>
            {proveedores.map((proveedor) => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombre} - {proveedor.telefono}
              </option>
            ))}
          </select>

          <br />
          <br />

          <label>Referencia</label>
          <br />
          <input
            value={editReferencia}
            onChange={(e) => setEditReferencia(e.target.value)}
          />

          <br />
          <br />

          <label>Talla COL</label>
          <br />
          <input
            value={editTallaCol}
            onChange={(e) => setEditTallaCol(e.target.value)}
          />

          <br />
          <br />

          <label>Talla EUR</label>
          <br />
          <input
            value={editTallaEur}
            onChange={(e) => setEditTallaEur(e.target.value)}
          />

          <br />
          <br />

          <label>Precio</label>
          <br />
          <input
            value={editPrecio}
            onChange={(e) => setEditPrecio(e.target.value)}
          />

          <br />
          <br />

          <label>Fecha estimada</label>
          <br />
          <input
            type="date"
            value={editFechaEntrega}
            onChange={(e) => setEditFechaEntrega(e.target.value)}
          />

          <br />
          <br />

          <label>Observaciones</label>
          <br />
          <textarea
            value={editObservaciones}
            onChange={(e) => setEditObservaciones(e.target.value)}
          />

          <br />
          <br />

          <button onClick={guardarEdicion}>
            Guardar cambios
          </button>

          <button onClick={() => setEncargoEditando(null)}>Cancelar</button>
        </div>
      )}
      {encargos.map((encargo) => (
        <div
          key={encargo.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            backgroundColor: colorEstado(encargo.estado),
            borderRadius: "8px",
          }}
        >
          <h3>
            #{encargo.id} - {encargo.referencia}
          </h3>

          <p>
            <strong>Cliente:</strong> {encargo.cliente?.nombre}
          </p>
          <p>
            <strong>Proveedor:</strong> {encargo.proveedor?.nombre}
          </p>
          <p>
            <strong>Talla:</strong> COL {encargo.talla_col} / EUR{" "}
            {encargo.talla_eur}
          </p>
          <p>
            <strong>Precio:</strong> {formatearPesos(encargo.precio)}
          </p>
          <p>
            <strong>Abono:</strong> {formatearPesos(encargo.abono)}
          </p>
          <p>
            <strong>Saldo:</strong> {formatearPesos(encargo.saldo)}
          </p>
          <p>
            <strong>Estado:</strong> {encargo.estado}
          </p>

          <button onClick={() => abrirEdicion(encargo)}>Editar encargo</button>

          <br />
          <br />

          {encargo.saldo > 0 && (
            <>
              <input
                placeholder="Nuevo abono"
                value={abonos[encargo.id] || ""}
                onChange={(e) =>
                  setAbonos((prev) => ({
                    ...prev,
                    [encargo.id]: e.target.value,
                  }))
                }
              />

              <button onClick={() => agregarAbono(encargo.id)}>
                Agregar abono
              </button>
            </>
          )}

          <br />
          <br />

          <select
            value={encargo.estado}
            onChange={(e) => cambiarEstado(encargo.id, e.target.value)}
          >
            <option value="pendiente">Pendiente</option>
            <option value="pedido">Pedido</option>
            <option value="despachado">Despachado</option>
            <option value="en_local">En local</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <p>
            <strong>Fecha:</strong> {encargo.fecha_creacion}
          </p>

          {encargo.foto && (
            <img
              src={`${import.meta.env.VITE_API_URL}${encargo.foto}`}
              alt={encargo.referencia}
              style={{ width: "120px", borderRadius: "8px" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default ListarEncargos;
