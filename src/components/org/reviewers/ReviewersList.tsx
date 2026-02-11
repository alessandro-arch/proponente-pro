import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Plus, Search, Eye, MoreVertical, Ban, RefreshCw, UserCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

function formatArea(a: any): string {
  if (typeof a === "string") return a;
  if (a?.name) return a.name;
  if (a?.code) return a.code;
  return "";
}

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
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("reviewers").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
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
    mutationFn: async (reviewer: { id: string }) => {
      const { error } = await supabase.functions.invoke("send-reviewer-invite", {
        body: { reviewerId: reviewer.id, orgId },
      });
      if (error) throw error;
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
    <TooltipProvider delayDuration={300}>
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
          <div className="divide-y divide-border border border-border rounded-lg bg-card">
            {filtered.map((r) => {
              const areas: any[] = Array.isArray(r.areas) ? r.areas : [];
              const primaryArea = areas.length > 0 ? formatArea(areas[0]) : null;
              const extraCount = areas.length > 1 ? areas.length - 1 : 0;

              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Name + Email */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                  </div>

                  {/* Institution */}
                  <div className="hidden md:block w-40 min-w-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs text-muted-foreground truncate">{r.institution}</p>
                      </TooltipTrigger>
                      <TooltipContent side="top">{r.institution}</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Area */}
                  <div className="hidden lg:flex items-center gap-1.5 w-52 min-w-0">
                    {primaryArea ? (
                      <>
                        <span className="text-xs text-muted-foreground truncate">{primaryArea}</span>
                        {extraCount > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap cursor-default">
                                +{extraCount} {extraCount === 1 ? "área" : "áreas"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <ul className="space-y-0.5 text-xs">
                                {areas.slice(1).map((a, i) => (
                                  <li key={i}>{formatArea(a)}</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 italic">Sem área</span>
                    )}
                  </div>

                  {/* Status */}
                  <Badge variant={STATUS_VARIANTS[r.status] || "outline"} className="text-[10px] shrink-0">
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => onViewReviewer(r.id)}>
                        <Eye className="w-3.5 h-3.5 mr-2" /> Ver detalhes
                      </DropdownMenuItem>
                      {(r.status === "INVITED" || r.status === "PENDING") && (
                        <DropdownMenuItem onClick={() => resendInviteMutation.mutate({ id: r.id })}>
                          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reenviar convite
                        </DropdownMenuItem>
                      )}
                      {r.status === "ACTIVE" && (
                        <DropdownMenuItem
                          onClick={() => toggleStatusMutation.mutate({ id: r.id, newStatus: "SUSPENDED" })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Ban className="w-3.5 h-3.5 mr-2" /> Suspender
                        </DropdownMenuItem>
                      )}
                      {r.status === "SUSPENDED" && (
                        <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: r.id, newStatus: "ACTIVE" })}>
                          <UserCheck className="w-3.5 h-3.5 mr-2" /> Reativar
                        </DropdownMenuItem>
                      )}
                      {r.status !== "DISABLED" && (
                        <DropdownMenuItem
                          onClick={() => toggleStatusMutation.mutate({ id: r.id, newStatus: "DISABLED" })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Desativar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        <NewReviewerModal open={showNewModal} onOpenChange={setShowNewModal} orgId={orgId} />
      </div>
    </TooltipProvider>
  );
};

export default ReviewersList;
