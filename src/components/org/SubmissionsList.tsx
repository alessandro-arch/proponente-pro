import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Eye, Download, FileText, ArrowLeft, Users } from "lucide-react";
import ReviewerAssignment from "@/components/org/ReviewerAssignment";

interface SubmissionsListProps {
  editalId: string;
  editalTitle: string;
  orgId?: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Rascunho", variant: "outline" },
  submitted: { label: "Submetida", variant: "default" },
  under_review: { label: "Em Avaliação", variant: "secondary" },
  evaluated: { label: "Avaliada", variant: "secondary" },
  approved: { label: "Aprovada", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
};

const SubmissionsList = ({ editalId, editalTitle, orgId }: SubmissionsListProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [assignDialog, setAssignDialog] = useState<{ proposalId: string; blindCode: string } | null>(null);

  const { data: submissions, isLoading, refetch } = useQuery({
    queryKey: ["admin-submissions", editalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edital_submissions")
        .select("*")
        .eq("edital_id", editalId)
        .in("status", ["submitted", "under_review", "evaluated", "approved", "rejected"])
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch proposals linked to submissions for reviewer assignment
  const { data: proposals } = useQuery({
    queryKey: ["proposals-for-submissions", editalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, blind_code, proponente_user_id, status")
        .eq("edital_id", editalId);
      if (error) throw error;
      return data;
    },
  });

  // Load profiles for proponent names
  const userIds = submissions?.map((s: any) => s.user_id) || [];
  const { data: profiles } = useQuery({
    queryKey: ["submission-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  // Load form version snapshot for viewer
  const { data: formVersion } = useQuery({
    queryKey: ["form-version-for-edital", editalId],
    queryFn: async () => {
      const { data: formData } = await supabase
        .from("edital_forms")
        .select("id")
        .eq("edital_id", editalId)
        .maybeSingle();
      if (!formData) return null;
      const { data: versions } = await supabase
        .from("form_versions")
        .select("id, snapshot")
        .eq("form_id", formData.id)
        .order("version", { ascending: false })
        .limit(1);
      return versions && versions.length > 0 ? versions[0] : null;
    },
  });

  const filtered = (submissions || []).filter((s: any) => {
    const profile = profileMap.get(s.user_id);
    const name = (profile as any)?.full_name || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || (s.protocol || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Submission viewer
  if (selectedSubmission) {
    const profile = profileMap.get(selectedSubmission.user_id);
    const snapshot = (formVersion as any)?.snapshot;
    const answers = selectedSubmission.answers || {};

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar às submissões
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Proposta — {selectedSubmission.protocol}</CardTitle>
              <Badge variant={(STATUS_LABELS[selectedSubmission.status] || STATUS_LABELS.draft).variant}>
                {(STATUS_LABELS[selectedSubmission.status] || STATUS_LABELS.draft).label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Proponente</Label>
                <p className="text-foreground font-medium">{(profile as any)?.full_name || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="text-foreground">{(profile as any)?.email || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Protocolo</Label>
                <p className="text-foreground font-mono">{selectedSubmission.protocol}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data de submissão</Label>
                <p className="text-foreground">{selectedSubmission.submitted_at ? new Date(selectedSubmission.submitted_at).toLocaleString("pt-BR") : "—"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const printWindow = window.open("", "_blank");
                if (!printWindow || !snapshot) return;
                const sectionsHtml = (snapshot.sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((s: any) => {
                  const questionsHtml = (s.questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((q: any) => {
                    let answerDisplay = answers[q.id] || "—";
                    if (Array.isArray(answerDisplay)) answerDisplay = answerDisplay.join(", ");
                    return `<div style="margin-bottom:12px"><strong>${q.label}</strong><br/><span>${answerDisplay}</span></div>`;
                  }).join("");
                  return `<h2 style="color:#333;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:20px">${s.title}</h2>${questionsHtml}`;
                }).join("");
                printWindow.document.write(`<!DOCTYPE html><html><head><title>Proposta - ${selectedSubmission.protocol}</title>
                  <style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#222}
                  .header{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}
                  .footer{margin-top:40px;border-top:1px solid #ccc;padding-top:12px;font-size:11px;color:#888;text-align:center}</style></head>
                  <body>
                    <div class="header">
                      <h1 style="font-size:18px;margin-bottom:8px">${editalTitle}</h1>
                      <p><strong>Proponente:</strong> ${(profile as any)?.full_name || "—"}</p>
                      <p><strong>Protocolo:</strong> ${selectedSubmission.protocol}</p>
                      <p><strong>Data:</strong> ${selectedSubmission.submitted_at ? new Date(selectedSubmission.submitted_at).toLocaleString("pt-BR") : "—"}</p>
                    </div>
                    ${sectionsHtml}
                    <div class="footer">
                      <p>Documento gerado automaticamente pela plataforma SisConnecta</p>
                      <p>ID: ${selectedSubmission.id}</p>
                    </div>
                  </body></html>`);
                printWindow.document.close();
                printWindow.print();
              }}>
                <Download className="w-4 h-4 mr-1" /> Baixar PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => {
                // Find proposal for this submission
                const proposal = (proposals || []).find((p: any) => p.proponente_user_id === selectedSubmission.user_id);
                if (proposal && orgId) {
                  setAssignDialog({ proposalId: proposal.id, blindCode: proposal.blind_code || selectedSubmission.protocol });
                }
              }} disabled={!orgId}>
                <Users className="w-4 h-4 mr-1" /> Enviar para avaliação
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Render answers by section */}
        {snapshot && (snapshot.sections || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((section: any) => (
          <Card key={section.id}>
            <CardHeader>
              <CardTitle className="text-base">{section.title}</CardTitle>
              {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
            </CardHeader>
            <CardContent className="space-y-4">
              {(section.questions || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((q: any) => {
                let answerDisplay = answers[q.id] || "—";
                if (Array.isArray(answerDisplay)) answerDisplay = answerDisplay.join(", ");
                if (q.options_source === "knowledge_areas" && snapshot.knowledge_areas) {
                  const ka = snapshot.knowledge_areas.find((k: any) => k.id === answerDisplay);
                  if (ka) answerDisplay = ka.name;
                }
                if (q.options_source === "manual" && q.manual_options) {
                  const opt = q.manual_options.find((o: any) => o.value === answerDisplay);
                  if (opt) answerDisplay = opt.label;
                }
                return (
                  <div key={q.id}>
                    <Label className="text-xs text-muted-foreground">{q.label}{q.is_required ? " *" : ""}</Label>
                    <p className="text-foreground">{answerDisplay}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou protocolo..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="submitted">Submetida</SelectItem>
            <SelectItem value="under_review">Em Avaliação</SelectItem>
            <SelectItem value="evaluated">Avaliada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground">{filtered.length} submissão(ões) encontrada(s)</p>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma submissão encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub: any) => {
            const profile = profileMap.get(sub.user_id);
            const st = STATUS_LABELS[sub.status] || STATUS_LABELS.draft;
            return (
              <Card key={sub.id} className="hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => setSelectedSubmission(sub)}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-mono text-sm font-medium text-foreground">{sub.protocol || "—"}</p>
                        <p className="text-sm text-muted-foreground">{(profile as any)?.full_name || "Proponente"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString("pt-BR") : "—"}
                      </span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <Button size="icon" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {assignDialog && orgId && (
        <ReviewerAssignment
          open={!!assignDialog}
          onClose={() => setAssignDialog(null)}
          proposalId={assignDialog.proposalId}
          proposalBlindCode={assignDialog.blindCode}
          editalId={editalId}
          orgId={orgId}
          onAssigned={() => { refetch(); }}
        />
      )}
    </div>
  );
};

export default SubmissionsList;
