import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FolderOpen, ArrowLeft, Eye } from "lucide-react";
import ProposalForm from "@/components/proponente/ProposalForm";

interface Props {
  orgId: string;
  userId: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  submitted: { label: "Enviada", variant: "default" },
  under_review: { label: "Em Avaliação", variant: "secondary" },
  accepted: { label: "Aprovada", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};

const MinhasPropostas = ({ orgId, userId }: Props) => {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

  const { data: proposals, isLoading, refetch } = useQuery({
    queryKey: ["my-proposals-full", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, editais(title, end_date)")
        .eq("proponente_user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedProposalId) {
    const proposal = proposals?.find((p) => p.id === selectedProposalId);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedProposalId(null); refetch(); }}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <ProposalForm
          proposalId={selectedProposalId}
          editalId={proposal?.edital_id ?? ""}
          orgId={orgId}
          userId={userId}
          readOnly={proposal?.status !== "draft"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Minhas Propostas</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas submissões.</p>
      </div>

      {(!proposals || proposals.length === 0) ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma proposta ainda. Acesse "Editais Abertos" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {proposals.map((p) => {
            const st = STATUS_LABELS[p.status] ?? { label: p.status, variant: "outline" as const };
            const editalTitle = (p.editais as any)?.title ?? "Edital";

            return (
              <Card key={p.id} className="hover:shadow-card-hover transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{editalTitle}</CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Criada em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      {p.submitted_at && ` · Enviada em ${new Date(p.submitted_at).toLocaleDateString("pt-BR")}`}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setSelectedProposalId(p.id)}>
                      {p.status === "draft" ? "Editar" : <><Eye className="w-4 h-4 mr-1" /> Visualizar</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MinhasPropostas;
