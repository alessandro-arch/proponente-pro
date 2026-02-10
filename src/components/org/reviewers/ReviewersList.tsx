import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Search, Eye, Pencil, Ban, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NewReviewerModal from "./NewReviewerModal";

interface Props {
  orgId: string;
  onViewReviewer: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  INVITED: "Convidado",
  PENDING: "Pendente",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  DISABLED: "Desativado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INVITED: "outline",
  PENDING: "secondary",
  ACTIVE: "default",
  SUSPENDED: "destructive",
  DISABLED: "outline",
};

const ReviewersList = ({ orgId, onViewReviewer }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showNewModal, setShowNewModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: reviewers, isLoading } = useQuery({
    queryKey: ["reviewers", orgId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("reviewers")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("reviewers")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        organization_id: orgId,
        entity: "reviewer",
        entity_id: id,
        action: "REVIEWER_STATUS_CHANGED",
        metadata_json: { new_status: newStatus },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Status atualizado com sucesso.");
    },
    onError: () => toast.error("Erro ao atualizar status."),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (reviewer: { id: string; email: string; full_name: string }) => {
      const { data, error } = await supabase.functions.invoke("send-reviewer-invite", {
        body: { reviewerId: reviewer.id, orgId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Convite reenviado com sucesso.");
    },
    onError: () => toast.error("Erro ao reenviar convite."),
  });

  const filtered = reviewers?.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.institution.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Avaliadores</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie o banco de avaliadores da organização.</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Avaliador
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou instituição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="INVITED">Convidado</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="SUSPENDED">Suspenso</SelectItem>
            <SelectItem value="DISABLED">Desativado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">Nenhum avaliador cadastrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro avaliador
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Áreas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const areas = Array.isArray(r.areas) ? r.areas : [];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>{r.institution}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {areas.slice(0, 2).map((a: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {typeof a === "string" ? a : a.name || a.code}
                          </Badge>
                        ))}
                        {areas.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">
                            +{areas.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[r.status] || "outline"}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Ver" onClick={() => onViewReviewer(r.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => onViewReviewer(r.id)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {r.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Suspender"
                            onClick={() => toggleStatusMutation.mutate({ id: r.id, newStatus: "SUSPENDED" })}
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        {r.status === "SUSPENDED" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ativar"
                            onClick={() => toggleStatusMutation.mutate({ id: r.id, newStatus: "ACTIVE" })}
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {(r.status === "INVITED" || r.status === "PENDING") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reenviar convite"
                            onClick={() => resendInviteMutation.mutate(r)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <NewReviewerModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        orgId={orgId}
      />
    </div>
  );
};

export default ReviewersList;
