import { useState } from "react";
import { loginRequest } from "./services/api";
import CrearEncargo from "./components/CrearEncargo";
import ListarEncargos from "./components/ListarEncargos";

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [logueado, setLogueado] = useState(false);

  const login = async () => {
    try {
      const data = await loginRequest(username, password);

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        setMensaje("✅ Login exitoso");
        setLogueado(true);
      } else {
        setMensaje("❌ Credenciales incorrectas");
      }
    } catch (error) {
      setMensaje("❌ Error en login");
    }
  };

  if (logueado) {
  return (
    <>
      <CrearEncargo />
      <ListarEncargos />
    </>
  );
}

  return (
    <div style={{ padding: "20px" }}>
      <h1>🔐 Login Tenis Rio Shop</h1>

      <input
        type="text"
        placeholder="Usuario"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <br />
      <br />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />
      <br />

      <button onClick={login}>Iniciar sesión</button>

      <p>{mensaje}</p>
    </div>
  );
}

export default App;