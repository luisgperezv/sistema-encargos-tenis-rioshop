import { useState } from "react";
import { loginRequest } from "./services/api";
import CrearEncargo from "./components/CrearEncargo";
import ListarEncargos from "./components/ListarEncargos";
import "./App.css";
import logo from "./assets/logo.png";

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
      <div className="app-panel">
        <CrearEncargo />
        <ListarEncargos />
      </div>
    );
  }

  return (
    <div className="app-login">
      <div className="login-card">
        <img src={logo} alt="TENISRioSHOP" className="login-logo" />

        <h1>Sistema de Encargos</h1>

        <p>Gestión profesional de pedidos</p>

        <div className="login-form">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button onClick={login}>Iniciar sesión</button>
        </div>

        {mensaje && <p className="login-mensaje">{mensaje}</p>}
      </div>
    </div>
  );
}

export default App;
