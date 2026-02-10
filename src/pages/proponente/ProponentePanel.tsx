import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const ProponentePanel = () => {
  const { user, loading, membership } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !membership) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold font-heading text-foreground mb-2">Portal do Proponente</h1>
        <p className="text-muted-foreground">Em construção — será implementado na próxima iteração.</p>
      </div>
    </div>
  );
};

export default ProponentePanel;
