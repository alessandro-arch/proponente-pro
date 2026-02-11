import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Send, Lock, Plus, FileText, Settings, Inbox, ClipboardCheck } from "lucide-react";
import FormKnowledgeAreas from "@/components/org/FormKnowledgeAreas";
import FormSectionBuilder from "@/components/org/FormSectionBuilder";
import FormPreview from "@/components/org/FormPreview";
import SubmissionsList from "@/components/org/SubmissionsList";
import ReviewManagement from "@/components/org/ReviewManagement";
import ScoringCriteriaManager from "@/components/org/ScoringCriteriaManager";
import IdentityReveal from "@/components/org/IdentityReveal";
import { getComputedStatus, getStatusVariant, type ComputedEditalStatus } from "@/lib/edital-status";

interface Edital {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  review_deadline: string | null;
  min_reviewers_per_proposal: number | null;
  blind_review_enabled: boolean;
}

const EditalDetail = ({ edital, orgId, onBack }: { edital: Edital; orgId: string; onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dbStatus, setDbStatus] = useState(edital.status);
  const [startDate, setStartDate] = useState(edital.start_date);
  const [endDate, setEndDate] = useState(edital.end_date);
  const [editingDates, setEditingDates] = useState(false);
  const [tempStart, setTempStart] = useState("");
  const [tempEnd, setTempEnd] = useState("");

  // Form state
  const [formId, setFormId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState("draft");
  const [loadingForm, setLoadingForm] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const computedStatus = getComputedStatus(dbStatus, startDate, endDate);
  const canEditDates = computedStatus === "Agendado" || computedStatus === "Rascunho";

  useEffect(() => {
    loadForm();
  }, [edital.id]);

  const loadForm = async () => {
    setLoadingForm(true);
    const { data } = await supabase
      .from("edital_forms")
      .select("id, status")
      .eq("edital_id", edital.id)
      .maybeSingle();
    setFormId(data?.id || null);
    setFormStatus((data as any)?.status || "draft");
    setLoadingForm(false);
  };

  const handleCreateForm = async () => {
    if (!user) return;
    setCreatingForm(true);
    const { data, error } = await supabase
      .from("edital_forms")
      .insert({
        edital_id: edital.id,
        organization_id: orgId,
        status: "draft",
      })
      .select()
      .single();
    setCreatingForm(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setFormId(data.id);
      setFormStatus("draft");
      toast({ title: "Formulário criado!" });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    // Validate dates before publishing
    if (newStatus === "published") {
      if (!startDate || !endDate) {
        toast({ title: "Datas obrigatórias", description: "Defina as datas de abertura e encerramento antes de publicar.", variant: "destructive" });
        return;
      }
      if (new Date(endDate) <= new Date(startDate)) {
        toast({ title: "Datas inválidas", description: "A data de encerramento deve ser posterior à de abertura.", variant: "destructive" });
        return;
      }
    }

    const { error } = await supabase
      .from("editais")
      .update({ status: newStatus as "draft" | "published" | "closed" })
      .eq("id", edital.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setDbStatus(newStatus);
      toast({ title: `Edital ${newStatus === "published" ? "publicado" : newStatus === "closed" ? "encerrado" : "revertido"}!` });
    }
  };

  const handleSaveDates = async () => {
    if (!tempStart || !tempEnd) {
      toast({ title: "Preencha ambas as datas", variant: "destructive" });
      return;
    }
    if (new Date(tempEnd) <= new Date(tempStart)) {
      toast({ title: "Datas inválidas", description: "Encerramento deve ser posterior à abertura.", variant: "destructive" });
      return;
    }
    const newStart = new Date(tempStart).toISOString();
    const newEnd = new Date(tempEnd).toISOString();
    const { error } = await supabase
      .from("editais")
      .update({ start_date: newStart, end_date: newEnd })
      .eq("id", edital.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setStartDate(newStart);
      setEndDate(newEnd);
      setEditingDates(false);
      toast({ title: "Datas atualizadas!" });
    }
  };

  const formatDateTime = (dt: string) => new Date(dt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const toInputValue = (dt: string | null) => {
    if (!dt) return "";
    const d = new Date(dt);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading text-foreground">{edital.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={getStatusVariant(computedStatus)}>
              {computedStatus}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {dbStatus === "draft" && (
            <Button size="sm" onClick={() => handleStatusChange("published")}>
              <Send className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
          {dbStatus === "published" && computedStatus !== "Encerrado" && (
            <Button size="sm" variant="secondary" onClick={() => handleStatusChange("closed")}>
              <Lock className="w-4 h-4 mr-1" /> Encerrar
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="form">Formulário</TabsTrigger>
          <TabsTrigger value="submissions">
            <Inbox className="w-4 h-4 mr-1" /> Submissões
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <ClipboardCheck className="w-4 h-4 mr-1" /> Avaliação
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-1" /> Configurações
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo do Edital</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Título</Label>
                <p className="text-foreground font-medium">{edital.title}</p>
              </div>
              {edital.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Descrição</Label>
                  <p className="text-foreground">{edital.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data de criação</Label>
                  <p className="text-foreground">{new Date(edital.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p className="text-foreground">{computedStatus}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Abertura</Label>
                  <p className="text-foreground">{startDate ? formatDateTime(startDate) : "Não definida"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Encerramento</Label>
                  <p className="text-foreground">{endDate ? formatDateTime(endDate) : "Não definido"}</p>
                </div>
              </div>

              {/* Edit dates - only when Agendado or Rascunho */}
              {canEditDates && (
                <div className="pt-2">
                  {!editingDates ? (
                    <Button size="sm" variant="outline" onClick={() => {
                      setTempStart(toInputValue(startDate));
                      setTempEnd(toInputValue(endDate));
                      setEditingDates(true);
                    }}>
                      Editar datas
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Abertura</Label>
                          <Input type="datetime-local" value={tempStart} onChange={e => setTempStart(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                          <Label>Encerramento</Label>
                          <Input type="datetime-local" value={tempEnd} onChange={e => setTempEnd(e.target.value)} className="mt-1" />
                        </div>
                      </div>
                      {tempStart && tempEnd && new Date(tempEnd) <= new Date(tempStart) && (
                        <p className="text-sm text-destructive">Encerramento deve ser posterior à abertura.</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveDates}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingDates(false)}>Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulário */}
        <TabsContent value="form">
          {loadingForm ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !formId ? (
            <>
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhum formulário criado para este edital.</p>
                  <Button onClick={handleCreateForm} disabled={creatingForm}>
                    {creatingForm && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Plus className="w-4 h-4 mr-2" /> Criar Formulário
                  </Button>
                </CardContent>
              </Card>
              <FormKnowledgeAreas formId={null} />
            </>
          ) : showPreview ? (
            <FormPreview formId={formId} editalId={edital.id} onBack={() => setShowPreview(false)} />
          ) : (
            <div className="space-y-6">
              <FormSectionBuilder
                formId={formId}
                formStatus={formStatus}
                editalId={edital.id}
                onStatusChange={(s) => setFormStatus(s)}
                onPreview={() => setShowPreview(true)}
              />
              <FormKnowledgeAreas formId={formId} />
            </div>
          )}
        </TabsContent>

        {/* Submissões */}
        <TabsContent value="submissions">
          <SubmissionsList editalId={edital.id} editalTitle={edital.title} orgId={orgId} />
        </TabsContent>

        {/* Avaliação */}
        <TabsContent value="reviews">
          <ReviewManagement editalId={edital.id} editalTitle={edital.title} />
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <ScoringCriteriaManager editalId={edital.id} />
            <IdentityReveal
              editalId={edital.id}
              editalTitle={edital.title}
              editalStatus={dbStatus}
              proposals={[]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditalDetail;
