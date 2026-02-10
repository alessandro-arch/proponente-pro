import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Calendar, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  orgId: string;
  userId: string;
  onStartProposal: () => void;
}

const EditaisAbertos = ({ orgId, userId, onStartProposal }: Props) => {
  const [search, setSearch] = useState("");

  const { data: editais, isLoading } = useQuery({
    queryKey: ["proponente-editais", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editais")
        .select("*")
        .eq("organization_id", orgId)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myProposals } = useQuery({
    queryKey: ["my-proposals", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("edital_id, status")
        .eq("proponente_user_id", userId);
      if (error) throw error;
      return data;
    },
  });

  const proposalsByEdital = new Map(myProposals?.map((p) => [p.edital_id, p.status]) ?? []);

  const handleStartProposal = async (editalId: string) => {
    const { error } = await supabase.from("proposals").insert({
      edital_id: editalId,
      organization_id: orgId,
      proponente_user_id: userId,
      status: "draft",
    });
    if (error) {
      toast.error("Erro ao iniciar proposta: " + error.message);
      return;
    }
    toast.success("Rascunho criado! Acesse 'Minhas Propostas' para preencher.");
    onStartProposal();
  };

  const filtered = editais?.filter((e) => e.title.toLowerCase().includes(search.toLowerCase())) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">Editais Abertos</h1>
        <p className="text-muted-foreground mt-1">Veja os editais publicados e inicie sua submissão.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar edital..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum edital publicado encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((edital) => {
            const existingStatus = proposalsByEdital.get(edital.id);
            const isExpired = edital.end_date && new Date(edital.end_date) < new Date();

            return (
              <Card key={edital.id} className="hover:shadow-card-hover transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{edital.title}</CardTitle>
                      {edital.description && (
                        <CardDescription className="mt-1 line-clamp-2">{edital.description}</CardDescription>
                      )}
                    </div>
                    {isExpired && <Badge variant="secondary">Encerrado</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {edital.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Início: {format(new Date(edital.start_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {edital.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Fim: {format(new Date(edital.end_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>

                    {existingStatus ? (
                      <Badge variant={existingStatus === "submitted" ? "default" : "outline"}>
                        {existingStatus === "draft" ? "Rascunho" : existingStatus === "submitted" ? "Enviada" : existingStatus}
                      </Badge>
                    ) : !isExpired ? (
                      <Button size="sm" onClick={() => handleStartProposal(edital.id)}>
                        Iniciar Proposta <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    ) : null}
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

export default EditaisAbertos;
