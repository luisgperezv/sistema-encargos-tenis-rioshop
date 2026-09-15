const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Gasto {
  id: number;
  fecha: string;
  categoria: string;
  descripcion: string;
  valor: number;
  metodo_pago: string;
  observaciones: string | null;
  fecha_registro: string;
}

export interface GastoForm {
  fecha: string;
  categoria: string;
  descripcion: string;
  valor: number | "";
  metodo_pago: string;
  observaciones: string;
}

export interface GastoResumenCategoria {
  categoria: string;
  total: number;
  cantidad: number;
}

export interface GastoResumen {
  fecha_desde: string | null;
  fecha_hasta: string | null;
  categoria: string | null;
  total_gastos: number;
  cantidad_gastos: number;
  por_categoria: GastoResumenCategoria[];
}

export interface GastoFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  categoria?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildQuery(filtros: GastoFiltros): string {
  const params = new URLSearchParams();
  if (filtros.fecha_desde) params.set("fecha_desde", filtros.fecha_desde);
  if (filtros.fecha_hasta) params.set("fecha_hasta", filtros.fecha_hasta);
  if (filtros.categoria) params.set("categoria", filtros.categoria);
  const q = params.toString();
  return q ? `?${q}` : "";
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function getCategorias(): Promise<{ categorias: string[]; metodos_pago: string[] }> {
  const res = await fetch(`${API}/gastos/categorias`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getGastos(filtros: GastoFiltros = {}): Promise<Gasto[]> {
  const res = await fetch(`${API}/gastos${buildQuery(filtros)}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getResumenGastos(filtros: GastoFiltros = {}): Promise<GastoResumen> {
  const res = await fetch(`${API}/gastos/resumen${buildQuery(filtros)}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function crearGasto(data: GastoForm): Promise<Gasto> {
  const res = await fetch(`${API}/gastos`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...data, valor: Number(data.valor) }),
  });
  return handleResponse(res);
}

export async function editarGasto(id: number, data: GastoForm): Promise<Gasto> {
  const res = await fetch(`${API}/gastos/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ ...data, valor: Number(data.valor) }),
  });
  return handleResponse(res);
}

export async function eliminarGasto(id: number): Promise<void> {
  const res = await fetch(`${API}/gastos/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}
