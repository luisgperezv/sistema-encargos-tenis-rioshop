import Header from "../components/Header";
import CrearEncargo from "../components/CrearEncargo";
import ListarEncargos from "../components/ListarEncargos";

function DashboardPage() {
  return (
    <div className="app-panel">
      <Header />

      <CrearEncargo />

      <ListarEncargos />
    </div>
  );
}

export default DashboardPage;