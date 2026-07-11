const API_URL = import.meta.env.VITE_API_URL;

export const loginRequest = async (username: string, password: string) => {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  return res.json();
};

export const crearEncargoRequest = async (data: any) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/encargos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

export const crearClienteRequest = async (cliente: {
  nombre: string;
  telefono: string;
}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/clientes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cliente),
  });

  return res.json();
};

export const subirImagenRequest = async (file: File) => {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return res.json();
};
export const listarClientesRequest = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/clientes`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const editarClienteRequest = async (
  clienteId: number,
  cliente: {
    nombre: string;
    telefono: string;
  }
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/clientes/${clienteId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(cliente),
  });

  return res.json();
};

export const listarProveedoresRequest = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/proveedores`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const crearProveedorRequest = async (proveedor: {
  nombre: string;
  telefono: string;
}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/proveedores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(proveedor),
  });

  return res.json();
};

export const editarProveedorRequest = async (
  proveedorId: number,
  proveedor: {
    nombre: string;
    telefono: string;
  }
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/proveedores/${proveedorId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(proveedor),
  });

  return res.json();
};

export const listarEncargosRequest = async (
  buscar?: string,
  estado?: string
) => {
  const token = localStorage.getItem("token");

  const params = new URLSearchParams();

  if (buscar) params.append("buscar", buscar);
  if (estado) params.append("estado", estado);

  const res = await fetch(`${API_URL}/encargos?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const actualizarEstadoEncargoRequest = async (
  encargoId: number,
  estado: string,
  extras?: {
    costo_base?: number;
    costo_envio?: number;
    costo_despachador?: number;
    motivo_cancelacion?: string;
    metodo_pago?: string;
  }
) => {
  const token = localStorage.getItem("token");
  const body = extras ? { estado, ...extras } : { estado };

  const res = await fetch(
    `${API_URL}/encargos/${encargoId}/estado`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
  );

  return res.json();
};

export const agregarAbonoEncargoRequest = async (
  encargoId: number,
  abono: number
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/encargos/${encargoId}/abono`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ abono }),
  });

  return res.json();
};

export const editarEncargoRequest = async (
  encargoId: number,
  data: {
    proveedor_id: number | null;
    referencia: string;
    talla_col: string;
    talla_eur: string;
    foto: string | null;
    precio: number;
    fecha_entrega_estimada: string | null;
    observaciones: string | null;
  }
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/encargos/${encargoId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

export const reenviarEncargoProveedorRequest = async (encargoId: number, proveedorId?: number) => {
  const token = localStorage.getItem("token");

  const body = proveedorId ? JSON.stringify({ proveedor_id: proveedorId }) : undefined;

  const res = await fetch(`${API_URL}/encargos/${encargoId}/reenviar-proveedor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  return res.json();
};

export const listarConversacionesProveedoresRequest = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/mensajes-proveedores/conversaciones`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const obtenerMensajesProveedorRequest = async (telefono: string) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/mensajes-proveedores/${telefono}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const enviarMensajeProveedorRequest = async (telefono: string, contenido: string) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/mensajes-proveedores/enviar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ telefono, contenido }),
  });

  return res.json();
};

export const listarInventarioRequest = async (params?: {
  buscar?: string;
  marca?: string;
  estado?: string;
  talla_eur?: string;
  talla_col?: string;
}) => {
  const token = localStorage.getItem("token");
  const queryParams = new URLSearchParams();

  if (params) {
    if (params.buscar) queryParams.append("buscar", params.buscar);
    if (params.marca) queryParams.append("marca", params.marca);
    if (params.estado) queryParams.append("estado", params.estado);
    if (params.talla_eur) queryParams.append("talla_eur", params.talla_eur);
    if (params.talla_col) queryParams.append("talla_col", params.talla_col);
  }

  const res = await fetch(`${API_URL}/inventario?${queryParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const obtenerSugerenciasMarcasRequest = async (q: string) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_URL}/inventario/sugerencias/marcas?q=${encodeURIComponent(q)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
};

export const obtenerSugerenciasReferenciasRequest = async (q: string, marca: string) => {
  const token = localStorage.getItem("token");
  const res = await fetch(
    `${API_URL}/inventario/sugerencias/referencias?q=${encodeURIComponent(q)}&marca=${encodeURIComponent(marca)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return res.json();
};


export const obtenerItemInventarioRequest = async (id: number) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/inventario/${id}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export type TallaInventarioInput = {
  talla_eur: string;
  cantidad: number;
};

export const crearItemInventarioRequest = async (data: {
  marca: string;
  referencia: string;
  talla_eur?: string;
  talla_col?: string;
  foto?: string | null;
  costo: number;
  precio_sugerido: number;
  cantidad?: number;
  estado: string;
  fecha_ingreso: string;
  observaciones?: string | null;
  tallas: TallaInventarioInput[];
}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/inventario`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

export const actualizarItemInventarioRequest = async (
  id: number,
  data: {
    marca?: string;
    referencia?: string;
    talla_eur?: string;
    talla_col?: string;
    foto?: string | null;
    costo?: number;
    precio_sugerido?: number;
    cantidad?: number;
    estado?: string;
    fecha_ingreso?: string;
    observaciones?: string | null;
    tallas?: TallaInventarioInput[];
  }
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/inventario/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

export const eliminarItemInventarioRequest = async (id: number) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/inventario/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export interface Venta {
  id: number;
  encargo_id?: number | null;
  inventario_id?: number | null;
  inventario_talla_id?: number | null;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  proveedor_id?: number | null;
  proveedor_nombre?: string | null;
  proveedor_telefono?: string | null;
  marca?: string | null;
  referencia?: string | null;
  talla_eur?: string | null;
  talla_col?: string | null;
  foto?: string | null;
  cantidad?: number;
  precio_unitario?: number | null;
  subtotal?: number | null;
  precio_venta?: number | null;
  costo_base?: number | null;
  costo_envio?: number | null;
  costo_despachador?: number | null;
  costo_total?: number | null;
  utilidad?: number | null;
  metodo_pago?: string | null;
  fecha_venta?: string | null;
  origen: string;
  observaciones?: string | null;
  fecha_registro: string;
}

export interface ResumenVentas {
  total_ventas: number;
  unidades_vendidas: number;
  ingresos_totales: number;
  costos_totales: number;
  utilidad_total: number;
  ticket_promedio: number;
  ventas_por_metodo_pago: Record<string, number>;
  ventas_por_origen: Record<string, number>;
}

export const registrarVentaDirectaRequest = async (data: {
  inventario_talla_id: number;
  cantidad: number;
  precio_unitario: number;
  metodo_pago: string;
  cliente_nombre?: string;
  cliente_telefono?: string;
  observaciones?: string;
}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/ventas/directa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};

export const obtenerVentasRequest = async (params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  origen?: string;
  metodo_pago?: string;
  telefono?: string;
  marca?: string;
  referencia?: string;
  talla_eur?: string;
}) => {
  const token = localStorage.getItem("token");
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val) queryParams.append(key, val);
    });
  }

  const res = await fetch(`${API_URL}/ventas?${queryParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export const obtenerResumenVentasRequest = async (params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  origen?: string;
  metodo_pago?: string;
  telefono?: string;
  marca?: string;
  referencia?: string;
  talla_eur?: string;
}) => {
  const token = localStorage.getItem("token");
  const queryParams = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val) queryParams.append(key, val);
    });
  }

  const res = await fetch(`${API_URL}/ventas/resumen?${queryParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.json();
};

export interface VentaCheckoutItem {
  inventario_talla_id: number;
  cantidad: number;
  precio_unitario: number;
}

export interface VentaCheckoutCreate {
  items: VentaCheckoutItem[];
  metodo_pago: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  observaciones?: string | null;
}

export interface VentaOperacion {
  id: number;
  numero_venta: string;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  cliente_telefono?: string | null;
  metodo_pago: string;
  total_bruto: number;
  costo_total: number;
  utilidad_total: number;
  cantidad_items: number;
  origen: string;
  observaciones?: string | null;
  fecha_venta: string;
  fecha_registro: string;
}

export interface VentaCheckoutResponse {
  operacion: VentaOperacion;
  detalles: Venta[];
  total_bruto: number;
  costo_total: number;
  utilidad_total: number;
  cantidad_items: number;
}

export const registrarCheckoutVentaRequest = async (
  data: VentaCheckoutCreate
): Promise<VentaCheckoutResponse> => {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}/ventas/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
};