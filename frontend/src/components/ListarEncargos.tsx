import { useEffect, useState } from "react";
import {
  listarEncargosRequest,
  actualizarEstadoEncargoRequest,
  agregarAbonoEncargoRequest,
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

  const cargarEncargos = async () => {
    const data = await listarEncargosRequest(buscar, estadoFiltro);

    if (Array.isArray(data)) {
      setEncargos(data);
    } else {
      setMensaje("❌ Error al cargar encargos");
    }
  };

  const cambiarEstado = async (encargoId: number, nuevoEstado: string) => {
    const respuesta = await actualizarEstadoEncargoRequest(encargoId, nuevoEstado);

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) =>
          encargo.id === encargoId ? respuesta : encargo
        )
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
        prev.map((encargo) =>
          encargo.id === encargoId ? respuesta : encargo
        )
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

  useEffect(() => {
    cargarEncargos();
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

<button onClick={cargarEncargos}>
  Buscar
</button>

<br /><br />

      {mensaje && <p>{mensaje}</p>}

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
          <h3>#{encargo.id} - {encargo.referencia}</h3>

          <p><strong>Cliente:</strong> {encargo.cliente?.nombre}</p>
          <p><strong>Proveedor:</strong> {encargo.proveedor?.nombre}</p>
          <p><strong>Talla:</strong> COL {encargo.talla_col} / EUR {encargo.talla_eur}</p>
          <p><strong>Precio:</strong> {formatearPesos(encargo.precio)}</p>
          <p><strong>Abono:</strong> {formatearPesos(encargo.abono)}</p>
          <p><strong>Saldo:</strong> {formatearPesos(encargo.saldo)}</p>
          <p><strong>Estado:</strong> {encargo.estado}</p>

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

          <p><strong>Fecha:</strong> {encargo.fecha_creacion}</p>

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