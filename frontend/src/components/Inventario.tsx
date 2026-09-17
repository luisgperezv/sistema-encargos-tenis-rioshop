import { useEffect, useState } from "react";
import {
  listarInventarioRequest,
  crearItemInventarioRequest,
  actualizarItemInventarioRequest,
  eliminarItemInventarioRequest,
  subirImagenRequest,
  obtenerSugerenciasMarcasRequest,
  obtenerSugerenciasReferenciasRequest,
  registrarEntradaStockRequest,
} from "../services/api";
import { PlusCircle, Edit, Trash2, Search, Image as ImageIcon, Plus, PackagePlus } from "lucide-react";
import "./Inventario.css";


type TallaInventario = {
  id: number;
  inventario_id: number;
  talla_eur: string;
  talla_col: string;
  cantidad: number;
  
  esNueva?: boolean;
  fecha_registro: string;
};

type ArticuloInventario = {
  id: number;
  marca: string;
  referencia: string;
  talla_eur?: string;
  talla_col?: string;
  foto: string | null;
  costo: number;
  precio_sugerido: number;
  cantidad?: number;
  cantidad_total: number;
  estado: "disponible" | "agotado" | "reservado";
  fecha_ingreso: string;
  observaciones: string | null;
  fecha_registro: string;
  tallas: TallaInventario[];
};

type TallaFormItem = {
  key: string;
  talla_eur: string;
  talla_col: string;
  cantidad: number;
  esNueva?: boolean;
};

type EntradaTallaFila = {
  key: string;
  talla_eur: string;
  talla_col: string;
  cantidad: number;
  costo_unitario: number;
};

const formatearPesos = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

// Mapeo oficial de tallas EUR a COL.
// Nota sobre nomenclatura: "D" equivale a Dama/Mujer, "H" equivale a Hombre.
const MAPPING_TALLAS: Record<string, string> = {
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

const ordenarTallas = (tallas: TallaInventario[]) => {
  return [...tallas].sort((a, b) => {
    const idxA = ORDEN_TALLAS.indexOf(a.talla_eur);
    const idxB = ORDEN_TALLAS.indexOf(b.talla_eur);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
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

  // Modal Reponer Stock
  const [showReponerModal, setShowReponerModal] = useState(false);
  const [articuloReponiendo, setArticuloReponiendo] = useState<ArticuloInventario | null>(null);
  const [fechaIngresoReponer, setFechaIngresoReponer] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observacionesReponer, setObservacionesReponer] = useState("");
  const [filasReponer, setFilasReponer] = useState<EntradaTallaFila[]>([]);
  const [errorReponer, setErrorReponer] = useState("");

  // Formulario
  const [marcaInput, setMarcaInput] = useState("");
  const [referenciaInput, setReferenciaInput] = useState("");
  const [fotoInput, setFotoInput] = useState("");
  const [costoInput, setCostoInput] = useState("");
  const [precioSugeridoInput, setPrecioSugeridoInput] = useState("");
  const [estadoInput, setEstadoInput] = useState("disponible");
  const [fechaIngresoInput, setFechaIngresoInput] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [observacionesInput, setObservacionesInput] = useState("");
  const [tallasInput, setTallasInput] = useState<TallaFormItem[]>([]);

  // Errores del formulario
  const [errorForm, setErrorForm] = useState("");
  const [imagenSeleccionada, setImagenSeleccionada] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Autocompletado y validaciones visuales
  const [sugerenciasMarcas, setSugerenciasMarcas] = useState<string[]>([]);
  const [sugerenciasReferencias, setSugerenciasReferencias] = useState<string[]>([]);
  const [advertenciaDuplicado, setAdvertenciaDuplicado] = useState("");

  const normalizarTexto = (texto: string): string => {
    if (!texto) return "";
    return texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  };

  // Cargar sugerencias de marcas con debounce
  useEffect(() => {
    if (!marcaInput.trim()) {
      setSugerenciasMarcas([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await obtenerSugerenciasMarcasRequest(marcaInput);
        if (Array.isArray(data)) {
          setSugerenciasMarcas(data);
        }
      } catch (err) {
        console.error("Error cargando sugerencias de marcas", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [marcaInput]);

  // Cargar sugerencias de referencias con debounce
  useEffect(() => {
    if (!referenciaInput.trim()) {
      setSugerenciasReferencias([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await obtenerSugerenciasReferenciasRequest(referenciaInput, marcaInput);
        if (Array.isArray(data)) {
          setSugerenciasReferencias(data);
        }
      } catch (err) {
        console.error("Error cargando sugerencias de referencias", err);
      }
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [referenciaInput, marcaInput]);

  // Validar duplicado visualmente de forma pasiva
  useEffect(() => {
    const mNorm = normalizarTexto(marcaInput);
    const rNorm = normalizarTexto(referenciaInput);

    if (!mNorm || !rNorm) {
      setAdvertenciaDuplicado("");
      return;
    }

    const duplicado = articulos.find(
      (item) =>
        item.id !== articuloEditando?.id &&
        normalizarTexto(item.marca) === mNorm &&
        normalizarTexto(item.referencia) === rNorm
    );

    if (duplicado) {
      setAdvertenciaDuplicado(
        `⚠️ Nota: Ya existe el producto "${duplicado.marca} - ${duplicado.referencia}" en el inventario.`
      );
    } else {
      setAdvertenciaDuplicado("");
    }
  }, [marcaInput, referenciaInput, articulos, articuloEditando]);

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
    setFotoInput("");
    setImagenSeleccionada(null);
    setImagePreview("");
    setCostoInput("");
    setPrecioSugeridoInput("");
    setEstadoInput("disponible");
    setFechaIngresoInput(new Date().toISOString().split("T")[0]);
    setObservacionesInput("");
    setErrorForm("");
    setTallasInput([
      {
        key: `${Date.now()}-${Math.random()}`,
        talla_eur: "38",
        talla_col: "37",
        cantidad: 1,
      },
    ]);
    setShowFormModal(true);
  };

  const abrirEditar = (item: ArticuloInventario) => {
    setArticuloEditando(item);
    setMarcaInput(item.marca);
    setReferenciaInput(item.referencia);
    setFotoInput(item.foto || "");
    setImagenSeleccionada(null);
    setImagePreview(item.foto || "");
    setCostoInput(String(item.costo));
    setPrecioSugeridoInput(String(item.precio_sugerido));
    setEstadoInput(item.estado);
    setFechaIngresoInput(item.fecha_ingreso);
    setObservacionesInput(item.observaciones || "");
    setErrorForm("");

    if (item.tallas && item.tallas.length > 0) {
      setTallasInput(
        item.tallas.map((t) => ({
          key: `${t.id}-${Math.random()}`,
          talla_eur: t.talla_eur,
          talla_col: t.talla_col,
          cantidad: t.cantidad,
        }))
      );
    } else {
      setTallasInput([
        {
          key: `${Date.now()}-${Math.random()}`,
          talla_eur: item.talla_eur || "38",
          talla_col: item.talla_col || "37",
          cantidad: item.cantidad ?? 1,
        },
      ]);
    }
    setShowFormModal(true);
  };

  const agregarFilaTalla = () => {
    const yaAgregadas = tallasInput.map((t) => t.talla_eur);
    const primeraDisponible =
      OPCIONES_TALLA_EUR.find((size) => !yaAgregadas.includes(size)) || "38";
    const colAuto = MAPPING_TALLAS[primeraDisponible] || "37";

    setTallasInput((prev) => [
      {
        key: `nueva-${Date.now()}-${Math.random()}`,
        talla_eur: primeraDisponible,
        talla_col: colAuto,
        cantidad: 1,
        esNueva: true,
      },
      ...prev,
    ]);
  };

  const eliminarFilaTalla = (key: string) => {
    setTallasInput((prev) => prev.filter((t) => t.key !== key));
  };

  const handleTallaEurChange = (key: string, val: string) => {
    setTallasInput((prev) =>
      prev.map((t) => {
        if (t.key === key) {
          const colAuto = MAPPING_TALLAS[val] || "";
          return { ...t, talla_eur: val, talla_col: colAuto };
        }
        return t;
      })
    );
  };

  const handleTallaCantidadChange = (key: string, valor: string) => {
    setTallasInput((prev) =>
      prev.map((t) => {
        if (t.key === key) {
          const num = parseInt(valor, 10);
          return { ...t, cantidad: isNaN(num) ? 0 : num };
        }
        return t;
      })
    );
  };

  const guardarArticulo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm("");

    // Validaciones
    if (!marcaInput.trim()) return setErrorForm("La marca es obligatoria.");
    if (!referenciaInput.trim()) return setErrorForm("La referencia es obligatoria.");

    if (tallasInput.length === 0) {
      return setErrorForm("Debe agregar al menos una talla.");
    }

    const eurTallas = tallasInput.map((t) => t.talla_eur);
    const tieneDuplicados = eurTallas.some((val, i) => eurTallas.indexOf(val) !== i);
    if (tieneDuplicados) {
      return setErrorForm("No se permiten tallas EUR duplicadas en el mismo producto.");
    }

    for (let i = 0; i < tallasInput.length; i++) {
      const t = tallasInput[i];
      if (!t.talla_eur) {
        return setErrorForm(`Fila ${i + 1}: La talla EUR es obligatoria.`);
      }
      if (t.cantidad < 0) {
        return setErrorForm(`Fila ${i + 1}: La cantidad debe ser mayor o igual a 0.`);
      }
    }

    const costo = Number(costoInput);
    const precio = Number(precioSugeridoInput);

    if (isNaN(costo) || costo < 0) return setErrorForm("El costo debe ser mayor o igual a 0.");
    if (isNaN(precio) || precio < 0) return setErrorForm("El precio sugerido debe ser mayor o igual a 0.");
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
        foto: rutaFoto,
        costo,
        precio_sugerido: precio,
        estado: estadoInput,
        fecha_ingreso: fechaIngresoInput,
        observaciones: observacionesInput.trim() || null,
        tallas: tallasInput.map((t) => ({
          talla_eur: t.talla_eur,
          cantidad: t.cantidad,
        })),
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

  const abrirReponer = (item: ArticuloInventario) => {
    setArticuloReponiendo(item);
    setFechaIngresoReponer(new Date().toISOString().split("T")[0]);
    setObservacionesReponer("");
    setErrorReponer("");

    const primerTalla = item.tallas && item.tallas.length > 0 ? item.tallas[0].talla_eur : "40H";
    const primerCol = MAPPING_TALLAS[primerTalla] || "38";

    setFilasReponer([
      {
        key: "fila-" + Date.now(),
        talla_eur: primerTalla,
        talla_col: primerCol,
        cantidad: 1,
        costo_unitario: item.costo || 0,
      },
    ]);
    setShowReponerModal(true);
  };

  const agregarFilaReponer = () => {
    const defaultEur = "40H";
    const defaultCol = MAPPING_TALLAS[defaultEur] || "38";
    setFilasReponer((prev) => [
      ...prev,
      {
        key: "fila-" + Date.now() + "-" + Math.random(),
        talla_eur: defaultEur,
        talla_col: defaultCol,
        cantidad: 1,
        costo_unitario: articuloReponiendo?.costo || 0,
      },
    ]);
  };

  const eliminarFilaReponer = (key: string) => {
    if (filasReponer.length <= 1) return;
    setFilasReponer((prev) => prev.filter((f) => f.key !== key));
  };

  const handleReponerTallaChange = (key: string, eur: string) => {
    const col = MAPPING_TALLAS[eur] || "";
    setFilasReponer((prev) =>
      prev.map((f) => (f.key === key ? { ...f, talla_eur: eur, talla_col: col } : f))
    );
  };

  const handleReponerCantidadChange = (key: string, val: string) => {
    const num = parseInt(val, 10);
    setFilasReponer((prev) =>
      prev.map((f) => (f.key === key ? { ...f, cantidad: isNaN(num) ? 0 : Math.max(0, num) } : f))
    );
  };

  const handleReponerCostoChange = (key: string, val: string) => {
    const num = parseFloat(val);
    setFilasReponer((prev) =>
      prev.map((f) => (f.key === key ? { ...f, costo_unitario: isNaN(num) ? 0 : Math.max(0, num) } : f))
    );
  };

  const guardarEntradaStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articuloReponiendo) return;
    setErrorReponer("");

    if (filasReponer.length === 0) {
      setErrorReponer("Debe ingresar al menos una talla para reponer.");
      return;
    }

    for (const f of filasReponer) {
      if (!f.talla_eur.trim()) {
        setErrorReponer("Todas las filas deben tener una talla asignada.");
        return;
      }
      if (f.cantidad <= 0) {
        setErrorReponer(`La cantidad para la talla ${f.talla_eur} debe ser mayor a cero.`);
        return;
      }
      if (f.costo_unitario < 0) {
        setErrorReponer(`El costo unitario para la talla ${f.talla_eur} no puede ser negativo.`);
        return;
      }
    }

    try {
      setCargando(true);
      const payload = {
        fecha_ingreso: fechaIngresoReponer || new Date().toISOString().split("T")[0],
        observaciones: observacionesReponer.trim() || undefined,
        items: filasReponer.map((f) => ({
          talla_eur: f.talla_eur.trim(),
          cantidad: Number(f.cantidad),
          costo_unitario: Number(f.costo_unitario),
        })),
      };

      const res = await registrarEntradaStockRequest(articuloReponiendo.id, payload);
      if (res && res.inventario_id) {
        setShowReponerModal(false);
        setMensaje(`✅ Entrada registrada exitosamente: +${res.total_unidades_ingresadas} pares en ${articuloReponiendo.marca} - ${articuloReponiendo.referencia}.`);
        cargarInventario();
      } else {
        setErrorReponer(res?.detail || "Error al registrar la entrada de stock.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorReponer(err.message || "Error al conectar con el servidor.");
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
                    {item.tallas && item.tallas.length > 0 ? (
                      ordenarTallas(item.tallas).map((t) => (
                        <div
                          key={t.id}
                          className={`talla-badge ${t.cantidad === 0 ? "talla-agotada" : ""}`}
                        >
                          {t.talla_eur} / COL {t.talla_col}: {t.cantidad} und.
                        </div>
                      ))
                    ) : (
                      <>
                        {item.talla_eur && (
                          <div
                            className={`talla-badge ${(item.cantidad ?? 0) === 0 ? "talla-agotada" : ""}`}
                          >
                            {item.talla_eur} / COL {item.talla_col || "36"}: {item.cantidad ?? 0} und.
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="card-desglose-financiero">
                    <div className="finanza-item">
                      <span className="finanza-lbl">Costo</span>
                      <span className="finanza-val">{formatearPesos(item.costo)}</span>
                    </div>
                    <div className="finanza-item">
                      <span className="finanza-lbl">
                        <span className="finanza-lbl-precio-desktop">Precio Sugerido</span>
                        <span className="finanza-lbl-precio-mobile">Precio</span>
                      </span>
                      <span className="finanza-val val-precio">
                        {formatearPesos(item.precio_sugerido)}
                      </span>
                    </div>
                    <div className="finanza-item">
                      <span className="finanza-lbl">Utilidad</span>
                      <span
                        className={`finanza-val val-utilidad ${utilidad >= 0 ? "utilidad-positiva" : "utilidad-negativa"}`}
                      >
                        {formatearPesos(utilidad)}
                      </span>
                    </div>
                  </div>

                  <div className="card-meta">
                    <div className="meta-item">
                      <span className="meta-lbl">Disponibles</span>
                      <span className="meta-val val-cantidad">
                        {item.cantidad_total !== undefined ? item.cantidad_total : (item.cantidad ?? 0)} und.
                      </span>
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
                    <button
                      className="btn-accion btn-reponer"
                      onClick={() => abrirReponer(item)}
                      title="Ingresar o reponer stock con costo real"
                    >
                      <PackagePlus size={16} />
                      <span>Reponer</span>
                    </button>
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
              {advertenciaDuplicado && (
                <div style={{
                  color: "#d97706",
                  backgroundColor: "#fef3c7",
                  border: "1px solid #fcd34d",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  marginBottom: "15px",
                  fontSize: "13px",
                  fontWeight: 500,
                }}>
                  {advertenciaDuplicado}
                </div>
              )}

              <div className="form-grid">
                <div className="form-group">
                  <label>Marca *</label>
                  <input
                    type="text"
                    placeholder="Ej: Nike"
                    value={marcaInput}
                    onChange={(e) => setMarcaInput(e.target.value)}
                    list="marcas-sugeridas"
                    required
                  />
                  <datalist id="marcas-sugeridas">
                    {sugerenciasMarcas.map((marca) => (
                      <option key={marca} value={marca} />
                    ))}
                  </datalist>
                </div>

                <div className="form-group">
                  <label>Referencia *</label>
                  <input
                    type="text"
                    placeholder="Ej: Jordan Retro 4"
                    value={referenciaInput}
                    onChange={(e) => setReferenciaInput(e.target.value)}
                    list="referencias-sugeridas"
                    required
                  />
                  <datalist id="referencias-sugeridas">
                    {sugerenciasReferencias.map((ref) => (
                      <option key={ref} value={ref} />
                    ))}
                  </datalist>
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

                {/* Sección de Foto */}
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
                </div>

                {/* Sección de Tallas Disponibles */}
                <div className="form-group full-width tallas-seccion">
                  <div className="tallas-header">
                    <label>Tallas disponibles *</label>
                    <button
                      type="button"
                      className="btn-agregar-talla"
                      onClick={agregarFilaTalla}
                    >
                      <Plus size={16} />
                      <span>Agregar talla</span>
                    </button>
                  </div>

                  <div className="tallas-lista">
                    {tallasInput.map((talla) => (
                        <div
                          key={talla.key}
                          className={`talla-fila ${talla.esNueva ? "talla-fila-nueva" : ""}`}
                        >
                        <div className="talla-campo">
                          <label>EUR</label>
                          <select
                            value={talla.talla_eur}
                            onChange={(e) => handleTallaEurChange(talla.key, e.target.value)}
                          >
                            {OPCIONES_TALLA_EUR.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="talla-campo">
                          <label>COL (Auto)</label>
                          <input
                            type="text"
                            value={talla.talla_col}
                            readOnly
                            disabled
                            className="talla-col-readonly"
                          />
                        </div>

                        <div className="talla-campo">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Ej: 1"
                            value={talla.cantidad}
                            onChange={(e) =>
                              handleTallaCantidadChange(talla.key, e.target.value)
                            }
                            required
                          />
                        </div>

                        <button
                          type="button"
                          className="btn-eliminar-talla"
                          onClick={() => eliminarFilaTalla(talla.key)}
                          title="Eliminar talla"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
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
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setShowFormModal(false)}
                >
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

      {/* Modal Reponer / Ingresar Stock */}
      {showReponerModal && articuloReponiendo && (
        <div className="modal-overlay">
          <div className="modal-content modal-reponer">
            <div className="modal-header">
              <div>
                <h2>Ingresar / Reponer Stock</h2>
                <p className="modal-subtitulo-reponer">
                  {articuloReponiendo.marca} — {articuloReponiendo.referencia} (#Inv-{articuloReponiendo.id})
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowReponerModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={guardarEntradaStock} className="modal-form">
              {errorReponer && <div className="error-mensaje">{errorReponer}</div>}

              <div className="form-grid">
                <div className="form-group">
                  <label>Fecha de Ingreso *</label>
                  <input
                    type="date"
                    value={fechaIngresoReponer}
                    onChange={(e) => setFechaIngresoReponer(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Observaciones (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: Lote proveedor Medellín, pedido #14"
                    value={observacionesReponer}
                    onChange={(e) => setObservacionesReponer(e.target.value)}
                  />
                </div>

                <div className="form-group full-width tallas-seccion">
                  <div className="tallas-header">
                    <div>
                      <label>Tallas, Cantidades y Costos de Entrada</label>
                      <p className="tallas-helper">
                        Cada fila creará un lote con su propio costo unitario para consumo FIFO.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-agregar-talla"
                      onClick={agregarFilaReponer}
                    >
                      <Plus size={16} />
                      <span>Agregar Talla</span>
                    </button>
                  </div>

                  <div className="tallas-lista">
                    {filasReponer.map((fila) => (
                      <div key={fila.key} className="talla-fila fila-reponer">
                        <div className="talla-campo">
                          <label>Talla EUR</label>
                          <select
                            value={fila.talla_eur}
                            onChange={(e) => handleReponerTallaChange(fila.key, e.target.value)}
                          >
                            {OPCIONES_TALLA_EUR.map((eur) => (
                              <option key={eur} value={eur}>
                                EUR {eur} (COL {MAPPING_TALLAS[eur] || "?"})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="talla-campo">
                          <label>Talla COL</label>
                          <input
                            type="text"
                            value={fila.talla_col}
                            readOnly
                            className="input-disabled"
                          />
                        </div>

                        <div className="talla-campo">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="1"
                            value={fila.cantidad || ""}
                            onChange={(e) => handleReponerCantidadChange(fila.key, e.target.value)}
                            required
                          />
                        </div>

                        <div className="talla-campo">
                          <label>Costo Unitario (COP)</label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            placeholder="Ej: 85000"
                            value={fila.costo_unitario || ""}
                            onChange={(e) => handleReponerCostoChange(fila.key, e.target.value)}
                            required
                          />
                        </div>

                        {filasReponer.length > 1 && (
                          <button
                            type="button"
                            className="btn-eliminar-talla"
                            onClick={() => eliminarFilaReponer(fila.key)}
                            title="Eliminar fila"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Resumen de la entrada */}
              <div className="reponer-totales-bar">
                <div className="total-reponer-item">
                  <span>Pares a ingresar:</span>
                  <strong>{filasReponer.reduce((s, f) => s + (Number(f.cantidad) || 0), 0)} und.</strong>
                </div>
                <div className="total-reponer-item">
                  <span>Costo total entrada:</span>
                  <strong>
                    {formatearPesos(
                      filasReponer.reduce(
                        (s, f) => s + (Number(f.cantidad) || 0) * (Number(f.costo_unitario) || 0),
                        0
                      )
                    )}
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setShowReponerModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primario" disabled={cargando}>
                  {cargando ? "Registrando..." : "Registrar Entrada de Stock"}
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

