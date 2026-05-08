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
  estado: string
) => {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${API_URL}/encargos/${encargoId}/estado`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ estado }),
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