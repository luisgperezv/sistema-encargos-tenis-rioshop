import Layout from "../components/Layout";
import CrearEncargo from "../components/CrearEncargo";
import ListarEncargos from "../components/ListarEncargos";

function DashboardPage() {
  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <CrearEncargo />
        <ListarEncargos />
      </div>
    </Layout>
  );
}

export default DashboardPage;