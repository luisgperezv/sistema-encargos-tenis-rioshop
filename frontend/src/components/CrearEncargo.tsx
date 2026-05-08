import { useEffect, useState } from "react";
import {
  crearClienteRequest,
  crearEncargoRequest,
  editarClienteRequest,
  listarClientesRequest,
  subirImagenRequest,
  listarProveedoresRequest,
  editarProveedorRequest,
  crearProveedorRequest,
} from "../services/api";

type Cliente = {
  id: number;
  nombre: string;
  telefono: string;
};

type Proveedor = {
  id: number;
  nombre: string;
  telefono: string;
};

function CrearEncargo() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<Proveedor | null>(null);

  const [nombreProveedor, setNombreProveedor] = useState("");
  const [telefonoProveedor, setTelefonoProveedor] = useState("");

 
  const [referencia, setReferencia] = useState("");
  const [tallaCol, setTallaCol] = useState("");
  const [tallaEur, setTallaEur] = useState("");
  const [precio, setPrecio] = useState("");
  const [abono, setAbono] = useState("0");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargarClientes = async () => {
  const data = await listarClientesRequest();

  if (Array.isArray(data)) {
    setClientes(data);
  }
};

const cargarProveedores = async () => {
  const data = await listarProveedoresRequest();

  if (Array.isArray(data)) {
    setProveedores(data);
  }
};


useEffect(() => {

  cargarClientes();
  cargarProveedores();

}, []);

  const sugerenciasClientes = clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(nombreCliente.toLowerCase())
  );

  const seleccionarCliente = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setNombreCliente(cliente.nombre);
    setTelefonoCliente(cliente.telefono);
  };

  const editarClienteSeleccionado = async () => {
    if (!clienteSeleccionado) {
      setMensaje("❌ Primero selecciona un cliente existente");
      return;
    }

    try {
      setCargando(true);
      setMensaje("⏳ Actualizando cliente...");

      const respuesta = await editarClienteRequest(clienteSeleccionado.id, {
        nombre: nombreCliente,
        telefono: telefonoCliente,
      });

      if (respuesta.id) {
        setClienteSeleccionado(respuesta);
        await cargarClientes();
        setMensaje("✅ Cliente actualizado correctamente");
      } else if (respuesta.detail) {
        setMensaje(`❌ ${respuesta.detail}`);
      } else {
        setMensaje("❌ Error al actualizar cliente");
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión al editar cliente");
    } finally {
      setCargando(false);
    }
  };

  const crearEncargo = async () => {
    try {
      setCargando(true);
    if (!nombreCliente.trim()) {
      setMensaje("❌ Debes escribir el nombre del cliente");
      return;
    }

    if (!telefonoCliente.trim()) {
      setMensaje("❌ Debes escribir el teléfono del cliente");
      return;
    }

    if (!proveedorSeleccionado) {
      setMensaje("❌ Debes seleccionar o crear un proveedor");
      return;
    }

    if (!referencia.trim()) {
      setMensaje("❌ Debes escribir una referencia");
      return;
    }

    if (!tallaCol.trim()) {
      setMensaje("❌ Debes escribir talla COL");
      return;
    }

    if (!tallaEur.trim()) {
      setMensaje("❌ Debes escribir talla EUR");
      return;
    }

    if (!precio || Number(precio) <= 0) {
      setMensaje("❌ El precio debe ser mayor a 0");
      return;
    }
      if (!proveedorSeleccionado) {
        setMensaje("❌ Debes seleccionar o crear un proveedor");
        return;
      }

      let cliente = clienteSeleccionado;

      if (!cliente) {
        setMensaje("⏳ Creando cliente...");

        const clienteCreado = await crearClienteRequest({
          nombre: nombreCliente,
          telefono: telefonoCliente,
        });

        if (!clienteCreado.id) {
          setMensaje(clienteCreado.detail || "❌ Error al crear cliente");
          return;
        }

        cliente = clienteCreado;
        await cargarClientes();
      }

      let rutaFoto = null;

      if (foto) {
        setMensaje("⏳ Subiendo imagen...");
        const imagenSubida = await subirImagenRequest(foto);

        if (!imagenSubida.ruta) {
          setMensaje("❌ Error al subir imagen");
          return;
        }

        rutaFoto = imagenSubida.ruta;
      }

      setMensaje("⏳ Creando encargo...");

      const data = {
        cliente_id: cliente!.id,
        proveedor_id: proveedorSeleccionado.id,
        referencia,
        talla_col: tallaCol,
        talla_eur: tallaEur,
        foto: rutaFoto,
        precio: Number(precio),
        abono: Number(abono),
        fecha_entrega_estimada: fechaEntrega || null,
        observaciones: observaciones || null,
      };

      const respuesta = await crearEncargoRequest(data);

      console.log("RESPUESTA BACKEND:", respuesta);

      if (respuesta.id) {
        setMensaje("✅ Encargo creado correctamente");

        setReferencia("");
        setTallaCol("");
        setTallaEur("");
        setPrecio("");
        setAbono("0");
        setFechaEntrega("");
        setObservaciones("");
        setFoto(null);
        setNombreCliente("");
        setTelefonoCliente("");
        setClienteSeleccionado(null);

        setNombreProveedor("");
        setTelefonoProveedor("");
        setProveedorSeleccionado(null);
      } else if (respuesta.detail) {
        if (Array.isArray(respuesta.detail)) {
          setMensaje(`❌ ${respuesta.detail[0].msg}`);
        } else {
          setMensaje(`❌ ${respuesta.detail}`);
        }
      } else {
        setMensaje("❌ Error al crear encargo");
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Crear Encargo</h1>

      <h3>Cliente</h3>

      <label>Nombre del cliente</label>
      <br />
      <input
        placeholder="Ej: Luis Pérez"
        value={nombreCliente}
        onChange={(e) => {
          setNombreCliente(e.target.value);
          setClienteSeleccionado(null);
        }}
      />

      {nombreCliente && !clienteSeleccionado && sugerenciasClientes.length > 0 && (
        <div style={{ border: "1px solid #ccc", padding: "8px", marginTop: "5px" }}>
          {sugerenciasClientes.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => seleccionarCliente(cliente)}
              style={{ cursor: "pointer", padding: "5px" }}
            >
              {cliente.nombre} - {cliente.telefono}
            </div>
          ))}
        </div>
      )}

      <br /><br />

      <label>Teléfono del cliente</label>
      <br />
      <input
        placeholder="Ej: 3242697263"
        value={telefonoCliente}
        onChange={(e) => setTelefonoCliente(e.target.value)}
      />

      <br /><br />

      {clienteSeleccionado && (
        <>
          <p>✅ Cliente seleccionado: {clienteSeleccionado.nombre}</p>
          <button disabled={cargando} onClick={editarClienteSeleccionado}>
            Guardar cambios del cliente
          </button>
          <br /><br />
        </>
      )}

      <h3>Encargo</h3>

      <label>Proveedor</label>
<br />

<select
  value={proveedorSeleccionado?.id || ""}
  onChange={(e) => {
    const proveedor = proveedores.find(
      (p) => p.id === Number(e.target.value)
    );

    if (proveedor) {
      setProveedorSeleccionado(proveedor);
      
      setNombreProveedor(proveedor.nombre);
      setTelefonoProveedor(proveedor.telefono);
    }
  }}
>
  <option value="">Selecciona proveedor</option>

  {proveedores.map((proveedor) => (
    <option key={proveedor.id} value={proveedor.id}>
      {proveedor.nombre} - {proveedor.telefono}
    </option>
  ))}
</select>

<br /><br />

<input
  placeholder="Nombre proveedor"
  value={nombreProveedor}
  onChange={(e) => setNombreProveedor(e.target.value)}
/>

<br /><br />

<input
  placeholder="Teléfono proveedor"
  value={telefonoProveedor}
  onChange={(e) => setTelefonoProveedor(e.target.value)}
/>

<br />

<button
  disabled={cargando}
  onClick={async () => {
    try {
      setCargando(true);

      const respuesta = await crearProveedorRequest({
        nombre: nombreProveedor,
        telefono: telefonoProveedor,
      });

      if (respuesta.id) {
        setMensaje("✅ Proveedor creado correctamente");

        await cargarProveedores();

        setProveedorSeleccionado(respuesta);
        

      } else if (respuesta.detail) {
        setMensaje(`❌ ${respuesta.detail}`);
      } else {
        setMensaje("❌ Error al crear proveedor");
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión");
    } finally {
      setCargando(false);
    }
  }}
>
  Crear proveedor
</button>

{proveedorSeleccionado && (
  <>
    <br /><br />

    <button
      disabled={cargando}
      onClick={async () => {
        try {
          setCargando(true);

          const respuesta = await editarProveedorRequest(
            proveedorSeleccionado.id,
            {
              nombre: nombreProveedor,
              telefono: telefonoProveedor,
            }
          );

          if (respuesta.id) {
            setMensaje("✅ Proveedor actualizado");

            setProveedorSeleccionado(respuesta);

            await cargarProveedores();
          } else {
            setMensaje("❌ Error al actualizar proveedor");
          }
        } catch (error) {
          console.error(error);
          setMensaje("❌ Error de conexión");
        } finally {
          setCargando(false);
        }
      }}
    >
      Guardar cambios proveedor
    </button>
  </>
)}

      <br /><br />

      <label>Referencia</label>
      <br />
      <input
        placeholder="Ej: Nike Panda"
        value={referencia}
        onChange={(e) => setReferencia(e.target.value)}
      />

      <br /><br />

      <label>Talla Colombia</label>
      <br />
      <input
        placeholder="Ej: 38"
        value={tallaCol}
        onChange={(e) => setTallaCol(e.target.value)}
      />

      <br /><br />

      <label>Talla EUR</label>
      <br />
      <input
        placeholder="Ej: 39"
        value={tallaEur}
        onChange={(e) => setTallaEur(e.target.value)}
      />

      <br /><br />

      <label>Precio</label>
      <br />
      <input
        placeholder="Ej: 250000"
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
      />

      <br /><br />

      <label>Abono</label>
      <br />
      <input
        placeholder="Ej: 50000"
        value={abono}
        onChange={(e) => setAbono(e.target.value)}
      />

      <br /><br />

      <label>Fecha estimada de entrega</label>
      <br />
      <input
        type="date"
        value={fechaEntrega}
        onChange={(e) => setFechaEntrega(e.target.value)}
      />

      <br /><br />

      <label>Observaciones</label>
      <br />
      <textarea
        placeholder="Ej: Cliente quiere caja original"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
      />

      <br /><br />

      <label>Foto del producto</label>
      <br />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFoto(e.target.files?.[0] || null)}
      />

      <br /><br />

      <button disabled={cargando} onClick={crearEncargo}>
        {cargando ? "Procesando..." : "Crear encargo"}
      </button>

      <p>{mensaje}</p>
    </div>
  );
}

export default CrearEncargo;