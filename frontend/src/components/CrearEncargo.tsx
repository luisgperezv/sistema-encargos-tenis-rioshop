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

import "./CrearEncargo.css";

// Mapeo oficial de tallas EUR a COL.
// Nota sobre nomenclatura: "D" equivale a Dama/Mujer, "H" equivale a Hombre.
const MAPPING_TALLAS: Record<string, string> = {
  "28": "27",
  "29": "28",
  "30": "29",
  "31": "30",
  "32": "31",
  "33": "32",
  "34": "33",
  "35": "34",
  "36": "35",
  "37": "36",
  "38": "37",
  "39": "38",
  "40D": "39",
  "40H": "38",
  "41D": "40",
  "41H": "39",
  "42": "40",
  "43": "41",
  "44": "42",
  "45": "43",
};

const ORDEN_TALLAS = [
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40D",
  "40H",
  "41D",
  "41H",
  "42",
  "43",
  "44",
  "45",
];

const OPCIONES_TALLA_EUR = ORDEN_TALLAS;

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

interface ProductoAgregado {
  id_temp: string;
  proveedor_id: number;
  nombreProveedor: string;
  referencia: string;
  tallaCol: string;
  tallaEur: string;
  precio: string;
  abono: string;
  fechaEntrega: string;
  foto: File | null;
  observaciones: string;
}

function CrearEncargo() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<Cliente | null>(null);

  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] =
    useState<Proveedor | null>(null);

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

  const [productosAgregados, setProductosAgregados] = useState<ProductoAgregado[]>([]);

  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [erroresCampos, setErroresCampos] = useState<Record<string, boolean>>({});

  const limpiarError = (campo: string) => {
    if (erroresCampos[campo]) {
      setErroresCampos((prev) => ({ ...prev, [campo]: false }));
    }
  };

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
    cliente.nombre.toLowerCase().includes(nombreCliente.toLowerCase()),
  );

  const seleccionarCliente = (cliente: Cliente) => {
    setClienteSeleccionado(cliente);
    setNombreCliente(cliente.nombre);
    setTelefonoCliente(cliente.telefono);
    limpiarError("nombreCliente");
    limpiarError("telefonoCliente");
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

  const validarCamposProductoActual = (): { valido: boolean; errores: Record<string, boolean>; faltantes: string[] } => {
    const errores: Record<string, boolean> = {};
    const faltantes: string[] = [];

    if (!proveedorSeleccionado) {
      errores["proveedor"] = true;
      faltantes.push("Proveedor");
    }
    if (!referencia.trim()) {
      errores["referencia"] = true;
      faltantes.push("Referencia del producto");
    }
    if (!tallaEur.trim()) {
      errores["tallaEur"] = true;
      faltantes.push("Talla EUR");
    }
    if (!tallaCol.trim()) {
      errores["tallaCol"] = true;
      faltantes.push("Talla COL");
    }

    const numPrecio = Number(precio);
    if (!precio || isNaN(numPrecio) || numPrecio <= 0) {
      errores["precio"] = true;
      faltantes.push("Precio (debe ser un número mayor a 0)");
    }

    const numAbono = Number(abono);
    if (abono === "" || abono === null || abono === undefined || isNaN(numAbono)) {
      errores["abono"] = true;
      faltantes.push("Abono (ingresa 0 o el valor abonado)");
    } else if (numAbono < 0) {
      errores["abono"] = true;
      faltantes.push("Abono no puede ser negativo");
    } else if (!isNaN(numPrecio) && numPrecio > 0 && numAbono > numPrecio) {
      errores["abono"] = true;
      faltantes.push("El abono no puede ser mayor que el precio");
    }

    if (!fechaEntrega || !fechaEntrega.trim()) {
      errores["fechaEntrega"] = true;
      faltantes.push("Fecha estimada de entrega");
    }

    if (!foto) {
      errores["foto"] = true;
      faltantes.push("Foto del producto");
    }

    return { valido: faltantes.length === 0, errores, faltantes };
  };

  const agregarProductoLista = () => {
    const { valido, errores, faltantes } = validarCamposProductoActual();
    setErroresCampos(errores);

    if (!valido) {
      setMensaje(`❌ Faltan datos obligatorios para agregar este producto:\n• ${faltantes.join("\n• ")}`);
      const primerErrorId = Object.keys(errores)[0];
      if (primerErrorId) {
        const el = document.getElementById(`input-${primerErrorId}`);
        if (el) el.focus();
      }
      return;
    }

    const nuevoProducto: ProductoAgregado = {
      id_temp: Date.now().toString() + Math.random().toString(36).substring(7),
      proveedor_id: proveedorSeleccionado!.id,
      nombreProveedor: proveedorSeleccionado!.nombre,
      referencia: referencia.trim(),
      tallaCol,
      tallaEur,
      precio,
      abono,
      fechaEntrega,
      foto,
      observaciones,
    };

    setProductosAgregados([...productosAgregados, nuevoProducto]);

    // Limpiar campos según requerimiento
    setReferencia("");
    setTallaCol("");
    setTallaEur("");
    setPrecio("");
    setAbono("0");
    setFechaEntrega("");
    setFoto(null);
    setObservaciones("");
    setErroresCampos({});
    setMensaje("✅ Producto agregado a la lista");
  };

  const eliminarProductoLista = (id_temp: string) => {
    setProductosAgregados(productosAgregados.filter((p) => p.id_temp !== id_temp));
  };

  const crearEncargo = async () => {
    try {
      setMensaje("");
      const nuevosErrores: Record<string, boolean> = {};
      const listaFaltantes: string[] = [];

      if (!nombreCliente.trim()) {
        nuevosErrores["nombreCliente"] = true;
        listaFaltantes.push("Nombre del cliente");
      }

      if (!telefonoCliente.trim()) {
        nuevosErrores["telefonoCliente"] = true;
        listaFaltantes.push("Teléfono del cliente");
      }

      const tieneFormularioLleno = referencia.trim() !== "" || foto !== null || fechaEntrega.trim() !== "" || precio.trim() !== "";

      if (productosAgregados.length === 0 && !tieneFormularioLleno) {
        nuevosErrores["referencia"] = true;
        nuevosErrores["tallaEur"] = true;
        nuevosErrores["precio"] = true;
        nuevosErrores["fechaEntrega"] = true;
        nuevosErrores["foto"] = true;
        nuevosErrores["proveedor"] = true;
        setErroresCampos(nuevosErrores);
        setMensaje("❌ Debes completar todos los datos del encargo y adjuntar la foto antes de enviar.");
        return;
      }

      if (tieneFormularioLleno) {
        const prodVal = validarCamposProductoActual();
        Object.assign(nuevosErrores, prodVal.errores);
        listaFaltantes.push(...prodVal.faltantes);
      }

      setErroresCampos(nuevosErrores);

      if (listaFaltantes.length > 0) {
        setMensaje(`❌ Faltan datos obligatorios o hay campos inválidos:\n• ${listaFaltantes.join("\n• ")}`);
        const primerErrorKey = Object.keys(nuevosErrores)[0];
        if (primerErrorKey) {
          const el = document.getElementById(`input-${primerErrorKey}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus();
          }
        }
        return;
      }

      setCargando(true);

      let cliente = clienteSeleccionado;

      if (!cliente) {
        setMensaje("⏳ Creando cliente...");

        const clienteCreado = await crearClienteRequest({
          nombre: nombreCliente.trim(),
          telefono: telefonoCliente.trim(),
        });

        if (!clienteCreado.id) {
          setMensaje(`❌ Error al crear cliente: ${clienteCreado.detail || "Datos inválidos"}`);
          setCargando(false);
          return;
        }

        cliente = clienteCreado;
        await cargarClientes();
      }

      const listaFinal: ProductoAgregado[] = [...productosAgregados];
      if (tieneFormularioLleno && proveedorSeleccionado) {
        listaFinal.push({
          id_temp: "current",
          proveedor_id: proveedorSeleccionado.id,
          nombreProveedor: proveedorSeleccionado.nombre,
          referencia: referencia.trim(),
          tallaCol,
          tallaEur,
          precio,
          abono,
          fechaEntrega,
          foto,
          observaciones,
        });
      }

      setMensaje(`⏳ Creando ${listaFinal.length} encargo(s)...`);

      let creados = 0;
      let conErrores = 0;
      let ultimoMensajeError = "";
      const advertencias: string[] = [];

      for (const prod of listaFinal) {
        let rutaFoto = null;

        if (prod.foto) {
          const imagenSubida = await subirImagenRequest(prod.foto);
          if (imagenSubida.ruta) {
            rutaFoto = imagenSubida.ruta;
          } else {
            conErrores++;
            ultimoMensajeError = "No se pudo subir la foto del producto a Cloudinary.";
            continue;
          }
        }

        const data = {
          cliente_id: cliente!.id,
          proveedor_id: prod.proveedor_id,
          referencia: prod.referencia,
          talla_col: prod.tallaCol,
          talla_eur: prod.tallaEur,
          foto: rutaFoto,
          precio: Number(prod.precio),
          abono: Number(prod.abono),
          fecha_entrega_estimada: prod.fechaEntrega,
          observaciones: prod.observaciones || null,
        };

        const respuesta = await crearEncargoRequest(data);

        if (respuesta.id) {
          creados++;
          if (respuesta.mensaje_advertencia) {
            advertencias.push(respuesta.mensaje_advertencia);
          }
        } else {
          conErrores++;
          if (respuesta.detail) {
            ultimoMensajeError = Array.isArray(respuesta.detail) ? respuesta.detail[0].msg : respuesta.detail;
          }
          console.error("Error creando encargo:", respuesta);
        }
      }

      if (creados > 0 && conErrores === 0) {
        if (advertencias.length > 0) {
          setMensaje(`⚠️ ${creados} encargo(s) creado(s) con advertencia:\n• ${advertencias.join("\n• ")}`);
        } else {
          setMensaje(`✅ ${creados} encargo(s) creado(s) correctamente`);
        }

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
        setProductosAgregados([]);
        setErroresCampos({});
      } else if (creados > 0 && conErrores > 0) {
        setMensaje(`⚠️ Se crearon ${creados} encargos, pero ${conErrores} fallaron. Último error: ${ultimoMensajeError}`);
      } else {
        setMensaje(`❌ Error al crear los encargos: ${ultimoMensajeError}`);
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión al crear encargos");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="crear-container">
      <h1 className="crear-title">Crear Encargo</h1>

      <div className="seccion">
        <h3>Cliente</h3>

        <div className="grid-form">
          <div className={`campo ${erroresCampos.nombreCliente ? "campo-invalid" : ""}`}>
            <label>Nombre del cliente *</label>

            <input
              id="input-nombreCliente"
              placeholder="Ej: Luis Pérez"
              value={nombreCliente}
              onChange={(e) => {
                setNombreCliente(e.target.value);
                setClienteSeleccionado(null);
                limpiarError("nombreCliente");
              }}
            />

            {nombreCliente &&
              !clienteSeleccionado &&
              sugerenciasClientes.length > 0 && (
                <div className="sugerencias">
                  {sugerenciasClientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      onClick={() => seleccionarCliente(cliente)}
                      className="sugerencia-item"
                    >
                      {cliente.nombre} - {cliente.telefono}
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div className={`campo ${erroresCampos.telefonoCliente ? "campo-invalid" : ""}`}>
            <label>Teléfono del cliente *</label>

            <input
              id="input-telefonoCliente"
              placeholder="Ej: 3242697263"
              value={telefonoCliente}
              onChange={(e) => {
                setTelefonoCliente(e.target.value);
                limpiarError("telefonoCliente");
              }}
            />
          </div>
        </div>

        {clienteSeleccionado && (
          <div className="botones">
            <button
              className="btn btn-secondary"
              disabled={cargando}
              onClick={editarClienteSeleccionado}
            >
              Guardar cambios del cliente
            </button>
          </div>
        )}
      </div>

      <div className="seccion">
        <h3>Encargo</h3>

        <div className="grid-form">
          <div className={`campo ${erroresCampos.proveedor ? "campo-invalid" : ""}`}>
            <label>Proveedor *</label>

            <select
              id="input-proveedor"
              value={proveedorSeleccionado?.id || ""}
              onChange={(e) => {
                const proveedor = proveedores.find(
                  (p) => p.id === Number(e.target.value),
                );

                if (proveedor) {
                  setProveedorSeleccionado(proveedor);

                  setNombreProveedor(proveedor.nombre);
                  setTelefonoProveedor(proveedor.telefono);
                  limpiarError("proveedor");
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
          </div>

          <div className="campo">
            <label>Nombre proveedor</label>

            <input
              placeholder="Nombre proveedor"
              value={nombreProveedor}
              onChange={(e) => setNombreProveedor(e.target.value)}
            />
          </div>

          <div className="campo">
            <label>Teléfono proveedor</label>

            <input
              placeholder="Teléfono proveedor"
              value={telefonoProveedor}
              onChange={(e) => setTelefonoProveedor(e.target.value)}
            />
          </div>

          <div className={`campo ${erroresCampos.referencia ? "campo-invalid" : ""}`}>
            <label>Referencia *</label>

            <input
              id="input-referencia"
              placeholder="Ej: Nike Panda"
              value={referencia}
              onChange={(e) => {
                setReferencia(e.target.value);
                limpiarError("referencia");
              }}
            />
          </div>

          <div className="campo">
            <label>Talla Colombia (Auto)</label>

            <input
              placeholder="COL automático"
              value={tallaCol}
              readOnly
              style={{ backgroundColor: "#f3f4f6", color: "#374151", cursor: "not-allowed" }}
            />
          </div>

          <div className={`campo ${erroresCampos.tallaEur ? "campo-invalid" : ""}`}>
            <label>Talla EUR *</label>

            <select
              id="input-tallaEur"
              value={tallaEur}
              onChange={(e) => {
                const val = e.target.value;
                setTallaEur(val);
                setTallaCol(MAPPING_TALLAS[val] || "");
                limpiarError("tallaEur");
                limpiarError("tallaCol");
              }}
            >
              <option value="">Selecciona talla EUR</option>
              {OPCIONES_TALLA_EUR.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className={`campo ${erroresCampos.precio ? "campo-invalid" : ""}`}>
            <label>Precio *</label>

            <input
              id="input-precio"
              placeholder="Ej: 250000"
              value={precio}
              onChange={(e) => {
                setPrecio(e.target.value);
                limpiarError("precio");
              }}
            />
          </div>

          <div className={`campo ${erroresCampos.abono ? "campo-invalid" : ""}`}>
            <label>Abono *</label>

            <input
              id="input-abono"
              placeholder="Ej: 50000 (0 para sin abono)"
              value={abono}
              onChange={(e) => {
                setAbono(e.target.value);
                limpiarError("abono");
              }}
            />
          </div>

          <div className={`campo ${erroresCampos.fechaEntrega ? "campo-invalid" : ""}`}>
            <label>Fecha estimada de entrega *</label>

            <input
              id="input-fechaEntrega"
              type="date"
              value={fechaEntrega}
              onChange={(e) => {
                setFechaEntrega(e.target.value);
                limpiarError("fechaEntrega");
              }}
            />
          </div>

          <div className={`campo ${erroresCampos.foto ? "campo-invalid" : ""}`}>
            <label>Foto del producto *</label>

            <input
              id="input-foto"
              type="file"
              accept="image/*"
              key={`foto-${productosAgregados.length}`}
              onChange={(e) => {
                setFoto(e.target.files?.[0] || null);
                limpiarError("foto");
              }}
            />
          </div>

          <div className="campo">
            <label>Observaciones</label>

            <textarea
              placeholder="Ej: Cliente quiere caja original"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
        </div>

        <div className="botones botones-acciones-producto">
          <button
            className="btn btn-outline"
            disabled={cargando}
            onClick={agregarProductoLista}
          >
            Agregar otro producto
          </button>
        </div>

        <div className="botones botones-proveedor">
          <button
            className="btn btn-secondary"
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
            <button
              className="btn btn-secondary"
              disabled={cargando}
              onClick={async () => {
                try {
                  setCargando(true);

                  const respuesta = await editarProveedorRequest(
                    proveedorSeleccionado.id,
                    {
                      nombre: nombreProveedor,
                      telefono: telefonoProveedor,
                    },
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
          )}
        </div>
      </div>

      {productosAgregados.length > 0 && (
        <div className="seccion">
          <h3>Productos a crear ({productosAgregados.length + (referencia.trim() ? 1 : 0)})</h3>
          
          <div className="lista-productos">
            {productosAgregados.map((prod, index) => (
              <div key={prod.id_temp} className="producto-item">
                <div className="producto-info">
                  <strong>{index + 1}. {prod.referencia}</strong> - Tallas: COL {prod.tallaCol} / EUR {prod.tallaEur} <br />
                  <small>Proveedor: {prod.nombreProveedor} | Precio: ${prod.precio}</small>
                </div>
                <button
                  className="btn btn-danger btn-eliminar-producto"
                  onClick={() => eliminarProductoLista(prod.id_temp)}
                  disabled={cargando}
                >
                  🗑
                </button>
              </div>
            ))}
            {referencia.trim() && (
              <div className="producto-item producto-actual">
                <div className="producto-info">
                  <strong>+ {referencia} (En formulario)</strong> - Tallas: COL {tallaCol} / EUR {tallaEur} <br />
                  <small>Se incluirá al guardar</small>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="seccion seccion-final">
        <button
          className="btn btn-primary btn-crear-encargos"
          disabled={cargando}
          onClick={crearEncargo}
        >
          {cargando ? "Procesando..." : (productosAgregados.length > 0 ? "Crear todos los encargos" : "Crear encargo")}
        </button>
      </div>

      <p className="mensaje">{mensaje}</p>
    </div>
  );
}

export default CrearEncargo;
