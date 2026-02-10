import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, LogOut, UserCircle, ClipboardCheck, Eye, AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/reviewer/ReviewForm";

interface Assignment {
  id: string;
  proposal_id: string;
  status: string;
  assigned_at: string;
  proposal_masked_id: string;
  edital_title: string;
  edital_id: string;
  knowledge_area: string | null;
  review_deadline: string | null;
}

const ReviewerPanel = () => {
  const { user, signOut } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const { toast } = useToast();

  const fetchAssignments = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("review_assignments")
      .select(`
        id, proposal_id, status, assigned_at, submitted_at,
        proposals!inner (
          id, edital_id, knowledge_area_id, status,
          editais!inner ( title, review_deadline ),
          knowledge_areas ( name )
        )
      `)
      .eq("reviewer_user_id", user.id)
      .order("assigned_at", { ascending: false });

    if (error) {
      console.error("Error fetching assignments:", error);
      setLoading(false);
      return;
    }

    const mapped: Assignment[] = (data || []).map((a: any, index: number) => ({
      id: a.id,
      proposal_id: a.proposal_id,
      status: a.status,
      assigned_at: a.assigned_at,
      proposal_masked_id: `PROPOSTA-${String(index + 1).padStart(5, "0")}`,
      edital_title: a.proposals?.editais?.title || "Edital",
      edital_id: a.proposals?.edital_id || "",
      knowledge_area: a.proposals?.knowledge_areas?.name || null,
      review_deadline: a.proposals?.editais?.review_deadline || null,
    }));

    setAssignments(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, [user]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "assigned": return <Badge variant="outline" className="border-accent text-accent-foreground"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "in_progress": return <Badge variant="secondary"><ClipboardCheck className="w-3 h-3 mr-1" /> Em andamento</Badge>;
      case "submitted": return <Badge className="bg-primary/10 text-primary border-primary/20"><Eye className="w-3 h-3 mr-1" /> Enviada</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (selectedAssignment) {
    return (
      <ReviewForm
        assignment={selectedAssignment}
        onBack={() => { setSelectedAssignment(null); fetchAssignments(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-heading text-foreground">SisConnecta Editais</h1>
              <p className="text-xs text-muted-foreground">Painel do Avaliador</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile"><Button variant="ghost" size="sm"><UserCircle className="w-4 h-4 mr-1" /> Cadastro</Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="w-4 h-4 mr-1" /> Sair</Button>
          </div>
        </div>
      </header>

      {/* Confidentiality notice */}
      <div className="bg-accent/30 border-b border-accent/50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-foreground flex-shrink-0" />
          <p className="text-xs text-accent-foreground">
            <strong>Avaliação cega:</strong> Esta é uma avaliação cega. Qualquer tentativa de identificação do proponente viola as regras do edital.
          </p>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Minhas Avaliações</h2>
        <p className="text-muted-foreground mb-6">Propostas atribuídas para sua avaliação</p>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma proposta atribuída no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignments.map((a) => (
              <Card key={a.id} className="hover:shadow-card transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{a.proposal_masked_id}</span>
                        {statusBadge(a.status)}
                      </div>
                      <p className="text-sm text-foreground font-medium">{a.edital_title}</p>
                      {a.knowledge_area && <p className="text-xs text-muted-foreground">Área: {a.knowledge_area}</p>}
                      {a.review_deadline && (
                        <p className="text-xs text-muted-foreground">
                          Prazo: {new Date(a.review_deadline).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div>
                      {a.status !== "submitted" ? (
                        <Button size="sm" onClick={() => setSelectedAssignment(a)}>
                          <ClipboardCheck className="w-4 h-4 mr-1" /> Avaliar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setSelectedAssignment(a)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver avaliação
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReviewerPanel;
