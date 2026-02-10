import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { user, loading, globalRole, membership } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Redirect based on role
  if (globalRole === "icca_admin") {
    return <Navigate to="/admin" replace />;
  }

  if (membership?.role === "org_admin" || membership?.role === "edital_manager") {
    return <Navigate to="/org" replace />;
  }

  if (membership?.role === "proponente") {
    return <Navigate to="/proponente" replace />;
  }

  // No role assigned yet
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold font-heading text-foreground mb-4">
          Bem-vindo ao SisConnecta Editais
        </h1>
        <p className="text-muted-foreground mb-6">
          Sua conta ainda não está vinculada a nenhuma organização. 
          Entre em contato com o administrador para obter acesso.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
