import { useState } from "react";
import { loginRequest } from "../services/api";
import logo from "../assets/logo-header.png";
import Card from "../components/Card";
import { LogIn, User, Lock } from "lucide-react";

interface Props {
  onLogin: () => void;
}

function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!username || !password) {
      setMensaje("Por favor ingresa tus credenciales");
      return;
    }

    setLoading(true);
    try {
      const data = await loginRequest(username, password);

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        onLogin();
      } else {
        setMensaje("Credenciales incorrectas");
      }
    } catch (error) {
      setMensaje("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") login();
  };

  return (
    <div className="login-container">
      {/* Decorative background elements */}
      <div className="glow glow-1"></div>
      <div className="glow glow-2"></div>

      <Card className="login-card-premium">
        <div className="login-header">
          <div className="logo-container">
            <img src={logo} alt="TENISRioSHOP" className="login-logo-img" />
          </div>
          <h1>Bienvenido</h1>
          <p>Ingresa tus credenciales para continuar</p>
        </div>

        <div className="login-form-premium">
          <div className="input-group">
            <User size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {mensaje && (
            <div className="error-message">
              <span>⚠️</span> {mensaje}
            </div>
          )}

          <button
            className="btn-primary-gradient"
            onClick={login}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                <LogIn size={18} />
                <span>Iniciar sesión</span>
              </>
            )}
          </button>
        </div>
      </Card>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-main);
          position: relative;
          overflow: hidden;
        }
        
        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          z-index: 0;
          opacity: 0.5;
        }
        
        .glow-1 {
          width: 400px;
          height: 400px;
          background: rgba(37, 99, 235, 0.2);
          top: -100px;
          left: -100px;
        }
        
        .glow-2 {
          width: 300px;
          height: 300px;
          background: rgba(124, 58, 237, 0.2);
          bottom: -50px;
          right: -50px;
        }

        .login-card-premium {
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 10;
          padding: 2.5rem 2rem;
          margin: 1rem;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1.5rem;
        }

        .login-logo-img {
          width: 300px;
          height: auto;
          border-radius: var(--radius-lg);
        }

        .login-header h1 {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
        }

        .login-header p {
          color: var(--text-secondary);
          font-size: 0.95rem;
        }

        .login-form-premium {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 1rem;
          color: var(--text-muted);
        }

        .input-group input {
          width: 100%;
          padding-left: 2.75rem;
          height: 3rem;
          background-color: rgba(17, 24, 39, 0.8);
          border: 1px solid var(--border-color);
        }

        .input-group input:focus {
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
        }
        
        .input-group input:focus + .input-icon {
          color: var(--accent-blue);
        }

        .error-message {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          padding: 0.75rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary-gradient {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          height: 3rem;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
          color: white;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 1rem;
          transition: all var(--transition-normal);
          box-shadow: var(--shadow-md);
        }

        .btn-primary-gradient:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }

        .btn-primary-gradient:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default LoginPage;
