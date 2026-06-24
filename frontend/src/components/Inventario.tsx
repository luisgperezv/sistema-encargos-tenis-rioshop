import { useEffect, useState } from "react";
import {
  listarInventarioRequest,
  crearItemInventarioRequest,
  actualizarItemInventarioRequest,
  eliminarItemInventarioRequest,
  subirImagenRequest,
} from "../services/api";
import { Package, PlusCircle, Edit, Trash2, Search, Image as ImageIcon } from "lucide-react";
import "./Inventario.css";

type ArticuloInventario = {
  id: number;
  marca: string;
  referencia: string;
  talla_eur: string;
  talla_col: string;
  foto: string | null;
  costo: number;
  precio_sugerido: number;
  cantidad: number;
  estado: "disponible" | "agotado" | "reservado";
  fecha_ingreso: string;
  observaciones: string | null;
  fecha_registro: string;
};

const formatearPesos = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

const comprimirImagen = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto 2D del canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("No se pudo comprimir la imagen"));
            }
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

function Inventario() {
  const [articulos, setArticulos] = useState<ArticuloInventario[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  // Filtros
  const [buscar, setBuscar] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tallaEurFiltro, setTallaEurFiltro] = useState("");
  const [tallaColFiltro, setTallaColFiltro] = useState("");

  // Modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [articuloEditando, setArticuloEditando] = useState<ArticuloInventario | null>(null);

  // Formulario
  const [marcaInput, setMarcaInput] = useState("");
  const [referenciaInput, setReferenciaInput] = useState("");
  const [tallaEurInput, setTallaEurInput] = useState("");
  const [tallaColInput, setTallaColInput] = useState("");
  const [fotoInput, setFotoInput] = useState("");
  const [costoInput, setCostoInput] = useState("");
  const [precioSugeridoInput, setPrecioSugeridoInput] = useState("");
  const [cantidadInput, setCantidadInput] = useState("1");
  const [estadoInput, setEstadoInput] = useState("disponible");
  const [fechaIngresoInput, setFechaIngresoInput] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observacionesInput, setObservacionesInput] = useState("");

  // Errores del formulario
  const [errorForm, setErrorForm] = useState("");
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const cargarInventario = async () => {
    setCargando(true);
    try {
      const params = {
        buscar: buscar.trim() || undefined,
        marca: marcaFiltro.trim() || undefined,
        estado: estadoFiltro || undefined,
        talla_eur: tallaEurFiltro.trim() || undefined,
        talla_col: tallaColFiltro.trim() || undefined,
      };
      const data = await listarInventarioRequest(params);
      if (Array.isArray(data)) {
        setArticulos(data);
      } else {
        setMensaje("❌ Error al cargar el inventario");
      }
    } catch (error) {
      console.error(error);
      setMensaje("❌ Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInventario();
  }, [buscar, marcaFiltro, estadoFiltro, tallaEurFiltro, tallaColFiltro]);

  const abrirCrear = () => {
    setArticuloEditando(null);
    setMarcaInput("");
    setReferenciaInput("");
    setTallaEurInput("");
    setTallaColInput("");
    setFotoInput("");
    setImagenSeleccionada(null);
    setImagePreview("");
    setCostoInput("");
    setPrecioSugeridoInput("");
    setCantidadInput("1");
    setEstadoInput("disponible");
    setFechaIngresoInput(new Date().toISOString().split("T")[0]);
    setObservacionesInput("");
    setErrorForm("");
    setShowFormModal(true);
  };

  const abrirEditar = (item: ArticuloInventario) => {
    setArticuloEditando(item);
    setMarcaInput(item.marca);
    setReferenciaInput(item.referencia);
    setTallaEurInput(item.talla_eur);
    setTallaColInput(item.talla_col);
    setFotoInput(item.foto || "");
    setImagenSeleccionada(null);
    setImagePreview(item.foto || "");
    setCostoInput(String(item.costo));
    setPrecioSugeridoInput(String(item.precio_sugerido));
    setCantidadInput(String(item.cantidad));
    setEstadoInput(item.estado);
    setFechaIngresoInput(item.fecha_ingreso);
    setObservacionesInput(item.observaciones || "");
    setErrorForm("");
    setShowFormModal(true);
  };

  const guardarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm("");

    // Validaciones
    if (!marcaInput.trim()) return setErrorForm("La marca es obligatoria.");
    if (!referenciaInput.trim()) return setErrorForm("La referencia es obligatoria.");
    if (!tallaEurInput.trim()) return setErrorForm("La talla EUR es obligatoria.");
    if (!tallaColInput.trim()) return setErrorForm("La talla COL es obligatoria.");
    
    const costo = Number(costoInput);
    const precio = Number(precioSugeridoInput);
    const cantidad = Number(cantidadInput);

    if (isNaN(costo) || costo < 0) return setErrorForm("El costo debe ser mayor o igual a 0.");
    if (isNaN(precio) || precio < 0) return setErrorForm("El precio sugerido debe ser mayor o igual a 0.");
    if (isNaN(cantidad) || cantidad < 0) return setErrorForm("La cantidad debe ser mayor o igual a 0.");
    if (!fechaIngresoInput) return setErrorForm("La fecha de ingreso es obligatoria.");

    let rutaFoto = fotoInput.trim() || null;

    try {
      setCargando(true);

      if (imagenSeleccionada) {
        try {
          setErrorForm("⏳ Comprimiendo y subiendo imagen...");
          const blob = await comprimirImagen(imagenSeleccionada);
          const compressedFile = new File([blob], imagenSeleccionada.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          const uploadRes = await subirImagenRequest(compressedFile);
          if (uploadRes.ruta) {
            rutaFoto = uploadRes.ruta;
          } else {
            setErrorForm("❌ Error al subir la foto a Cloudinary.");
            setCargando(false);
            return;
          }
        } catch (err) {
          console.error("Error subiendo foto:", err);
          setErrorForm("❌ Error al procesar y subir la foto.");
          setCargando(false);
          return;
        }
      }

      const body = {
        marca: marcaInput.trim(),
        referencia: referenciaInput.trim(),
        talla_eur: tallaEurInput.trim(),
        talla_col: tallaColInput.trim(),
        foto: rutaFoto,
        costo,
        precio_sugerido: precio,
        cantidad,
        estado: estadoInput,
        fecha_ingreso: fechaIngresoInput,
        observaciones: observacionesInput.trim() || null,
      };

      let respuesta;
      if (articuloEditando) {
        respuesta = await actualizarItemInventarioRequest(articuloEditando.id, body);
      } else {
        respuesta = await crearItemInventarioRequest(body);
      }

      if (respuesta.id) {
        setShowFormModal(false);
        cargarInventario();
      } else if (respuesta.detail) {
        setErrorForm(Array.isArray(respuesta.detail) ? respuesta.detail[0].msg : respuesta.detail);
      } else {
        setErrorForm("Ocurrió un error al guardar el artículo.");
      }
    } catch (error) {
      console.error(error);
      setErrorForm("Error al conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  const eliminarArticulo = async (id: number, ref: string) => {
    const confirmacion = window.confirm(`¿Estás seguro de eliminar el artículo "${ref}" del inventario?`);
    if (!confirmacion) return;

    try {
      setCargando(true);
      const respuesta = await eliminarItemInventarioRequest(id);
      if (respuesta.mensaje) {
        cargarInventario();
      } else {
        alert(respuesta.detail || "Error al eliminar el artículo");
      }
    } catch (error) {
      console.error(error);
      alert("Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="inventario-container">
      <div className="inventario-header-section">
        <h1 className="inventario-title">Inventario Físico</h1>
        <button className="btn-agregar" onClick={abrirCrear}>
          <PlusCircle size={20} />
          <span>Agregar Producto</span>
        </button>
      </div>

      {mensaje && <div className="mensaje-banner">{mensaje}</div>}

      {/* Sección de Filtros */}
      <div className="filtros-inventario">
        <div className="filtro-buscar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por referencia o marca..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>

        <div className="filtros-selects">
          <input
            type="text"
            placeholder="Marca"
            value={marcaFiltro}
            onChange={(e) => setMarcaFiltro(e.target.value)}
          />

          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            <option value="">Cualquier estado</option>
            <option value="disponible">Disponible</option>
            <option value="agotado">Agotado</option>
            <option value="reservado">Reservado</option>
          </select>

          <input
            type="text"
            placeholder="Talla EUR"
            className="talla-input"
            value={tallaEurFiltro}
            onChange={(e) => setTallaEurFiltro(e.target.value)}
          />

          <input
            type="text"
            placeholder="Talla COL"
            className="talla-input"
            value={tallaColFiltro}
            onChange={(e) => setTallaColFiltro(e.target.value)}
          />
        </div>
      </div>

      {/* Grid de Artículos */}
      {cargando && articulos.length === 0 ? (
        <div className="cargando-spinner">Cargando inventario...</div>
      ) : articulos.length === 0 ? (
        <div className="no-data">No se encontraron artículos en el inventario.</div>
      ) : (
        <div className="inventario-grid">
          {articulos.map((item) => {
            const utilidad = item.precio_sugerido - item.costo;
            return (
              <div key={item.id} className={`inventario-card card-estado-${item.estado}`}>
                <div className="card-imagen-wrapper">
                  {item.foto ? (
                    <img src={item.foto} alt={item.referencia} className="card-imagen" />
                  ) : (
                    <div className="card-imagen-placeholder">
                      <ImageIcon size={40} className="placeholder-icon" />
                      <span>Sin imagen</span>
                    </div>
                  )}
                  <span className={`badge-estado estado-${item.estado}`}>
                    {item.estado.toUpperCase()}
                  </span>
                </div>

                <div className="card-info">
                  <div className="card-header-info">
                    <span className="card-marca">{item.marca}</span>
                    <span className="card-id">#Inv-{item.id}</span>
                  </div>
                  <h3 className="card-referencia">{item.referencia}</h3>

                  <div className="card-tallas">
                    <div className="talla-badge">EUR: {item.talla_eur}</div>
                    <div className="talla-badge">COL: {item.talla_col}</div>
                  </div>

                  <div className="card-desglose-financiero">
                    <div className="finanza-item">
                      <span className="finanza-lbl">Costo</span>
                      <span className="finanza-val">{formatearPesos(item.costo)}</span>
                    </div>
                    <div className="finanza-item">
                      <span className="finanza-lbl">Precio Sugerido</span>
                      <span className="finanza-val val-precio">{formatearPesos(item.precio_sugerido)}</span>
                    </div>
                    <div className="finanza-item">
                      <span className="finanza-lbl">Utilidad</span>
                      <span className={`finanza-val val-utilidad ${utilidad >= 0 ? "utilidad-positiva" : "utilidad-negativa"}`}>
                        {formatearPesos(utilidad)}
                      </span>
                    </div>
                  </div>

                  <div className="card-meta">
                    <div className="meta-item">
                      <span className="meta-lbl">Disponibles</span>
                      <span className="meta-val val-cantidad">{item.cantidad} und.</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-lbl">Ingreso</span>
                      <span className="meta-val">{item.fecha_ingreso}</span>
                    </div>
                  </div>

                  {item.observaciones && (
                    <p className="card-observaciones" title={item.observaciones}>
                      {item.observaciones}
                    </p>
                  )}

                  <div className="card-acciones">
                    <button className="btn-accion btn-edit" onClick={() => abrirEditar(item)}>
                      <Edit size={16} />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn-accion btn-delete"
                      onClick={() => eliminarArticulo(item.id, item.referencia)}
                    >
                      <Trash2 size={16} />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal del Formulario (Crear/Editar) */}
      {showFormModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{articuloEditando ? "Editar Producto" : "Nuevo Producto de Inventario"}</h2>
              <button className="modal-close-btn" onClick={() => setShowFormModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={guardarArticulo} className="modal-form">
              {errorForm && <div className="error-mensaje">{errorForm}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label>Marca *</label>
                  <input
                    type="text"
                    placeholder="Ej: Nike"
                    value={marcaInput}
                    onChange={(e) => setMarcaInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Referencia *</label>
                  <input
                    type="text"
                    placeholder="Ej: Jordan Retro 4"
                    value={referenciaInput}
                    onChange={(e) => setReferenciaInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Talla EUR *</label>
                  <input
                    type="text"
                    placeholder="Ej: 40"
                    value={tallaEurInput}
                    onChange={(e) => setTallaEurInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Talla COL *</label>
                  <input
                    type="text"
                    placeholder="Ej: 38"
                    value={tallaColInput}
                    onChange={(e) => setTallaColInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Costo *</label>
                  <input
                    type="number"
                    placeholder="Ej: 120000"
                    value={costoInput}
                    onChange={(e) => setCostoInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Precio Sugerido *</label>
                  <input
                    type="number"
                    placeholder="Ej: 220000"
                    value={precioSugeridoInput}
                    onChange={(e) => setPrecioSugeridoInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cantidad *</label>
                  <input
                    type="number"
                    placeholder="Ej: 5"
                    value={cantidadInput}
                    onChange={(e) => setCantidadInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <select value={estadoInput} onChange={(e) => setEstadoInput(e.target.value)}>
                    <option value="disponible">Disponible</option>
                    <option value="agotado">Agotado</option>
                    <option value="reservado">Reservado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Fecha de Ingreso *</label>
                  <input
                    type="date"
                    value={fechaIngresoInput}
                    onChange={(e) => setFechaIngresoInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group full-width form-group-foto">
                  <label>Foto del Producto</label>
                  <div className="foto-input-container">
                    <button
                      type="button"
                      className="btn-select-foto"
                      onClick={() => document.getElementById("file-input-inv")?.click()}
                    >
                      Seleccionar foto / Tomar foto
                    </button>
                    <input
                      id="file-input-inv"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImagenSeleccionada(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    {imagenSeleccionada && (
                      <span className="file-name-label">{imagenSeleccionada.name}</span>
                    )}
                  </div>
                  
                  {imagePreview && (
                    <div className="image-preview-wrapper">
                      <img src={imagePreview} alt="Preview" className="image-preview" />
                      <button
                        type="button"
                        className="btn-remove-preview"
                        onClick={() => {
                          setImagenSeleccionada(null);
                          setImagePreview("");
                          setFotoInput("");
                        }}
                      >
                        Remover foto
                      </button>
                    </div>
                  )}

                  <details className="details-url-manual">
                    <summary>Opciones avanzadas (URL manual de foto)</summary>
                    <div className="form-group" style={{ marginTop: "0.5rem" }}>
                      <label>Pegar URL manual de imagen</label>
                      <input
                        type="text"
                        placeholder="Ej: https://cloudinary.com/mi-imagen.jpg"
                        value={fotoInput}
                        onChange={(e) => {
                          setFotoInput(e.target.value);
                          if (!imagenSeleccionada) {
                            setImagePreview(e.target.value);
                          }
                        }}
                      />
                    </div>
                  </details>
                </div>

                <div className="form-group full-width">
                  <label>Observaciones</label>
                  <textarea
                    placeholder="Detalles sobre el calzado, color, estado..."
                    value={observacionesInput}
                    onChange={(e) => setObservacionesInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secundario" onClick={() => setShowFormModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primario" disabled={cargando}>
                  {articuloEditando ? "Guardar Cambios" : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventario;
