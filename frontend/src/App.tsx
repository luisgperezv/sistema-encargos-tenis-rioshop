import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NuevoEncargoPage from "./pages/NuevoEncargoPage";
import EncargosPage from "./pages/EncargosPage";

import "./App.css";

function App() {
  const [logueado, setLogueado] = useState(
    !!localStorage.getItem("token")
  );

  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/login"
          element={
            logueado ? (
              <Navigate to="/dashboard" />
            ) : (
              <LoginPage onLogin={() => setLogueado(true)} />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            logueado ? (
              <DashboardPage />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/dashboard/nuevo"
          element={
            logueado ? (
              <NuevoEncargoPage />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/dashboard/encargos"
          element={
            logueado ? (
              <EncargosPage />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="*"
          element={
            <Navigate to={logueado ? "/dashboard" : "/login"} />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;