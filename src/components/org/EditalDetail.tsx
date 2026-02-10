import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Send, Lock, Plus, Trash2, GripVertical, ShieldCheck, Settings } from "lucide-react";
import ReviewManagement from "@/components/org/ReviewManagement";
import IdentityReveal from "@/components/org/IdentityReveal";
import EditalFormBuilder from "@/components/org/EditalFormBuilder";

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

interface Criteria {
  id?: string;
  name: string;
  description: string;
  weight: number;
  max_score: number;
  sort_order: number;
}

const EditalDetail = ({ edital, orgId, onBack }: { edital: Edital; orgId: string; onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState(edital.title);
  const [description, setDescription] = useState(edital.description || "");
  const [startDate, setStartDate] = useState(edital.start_date || "");
  const [endDate, setEndDate] = useState(edital.end_date || "");
  const [reviewDeadline, setReviewDeadline] = useState(edital.review_deadline || "");
  const [minReviewers, setMinReviewers] = useState(edital.min_reviewers_per_proposal || 3);
  const [blindReview, setBlindReview] = useState(edital.blind_review_enabled);
  const [status, setStatus] = useState(edital.status);
  const [saving, setSaving] = useState(false);

  // Proposals
  const [proposals, setProposals] = useState<any[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Barema
  const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      // Load proposals
      setLoadingProposals(true);
      const { data: propData } = await supabase
        .from("proposals")
        .select("id, status, created_at, submitted_at, blind_code, knowledge_areas(name)")
        .eq("edital_id", edital.id)
        .order("created_at", { ascending: false });
      setProposals(propData || []);
      setLoadingProposals(false);

      // Load criteria
      setLoadingCriteria(true);
      const { data: critData } = await supabase
        .from("scoring_criteria")
        .select("*")
        .eq("edital_id", edital.id)
        .order("sort_order");
      setCriteriaList((critData || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        weight: Number(c.weight),
        max_score: Number(c.max_score),
        sort_order: c.sort_order,
      })));
      setLoadingCriteria(false);
    };
    loadAll();
  }, [edital.id]);

  const handleSaveDetails = async () => {
    setSaving(true);
    const { error } = await supabase.from("editais").update({
      title,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      review_deadline: reviewDeadline || null,
      min_reviewers_per_proposal: minReviewers,
      blind_review_enabled: blindReview,
    }).eq("id", edital.id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Edital atualizado!" });
  };

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase.from("editais").update({ status: newStatus as "draft" | "published" | "closed" }).eq("id", edital.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { setStatus(newStatus); toast({ title: `Edital ${newStatus === "published" ? "publicado" : newStatus === "closed" ? "encerrado" : "revertido"}!` }); }
  };

  // Criteria
  const addCriteria = () => {
    setCriteriaList((prev) => [...prev, { name: "", description: "", weight: 1, max_score: 10, sort_order: prev.length }]);
  };

  const updateCriteria = (index: number, field: Partial<Criteria>) => {
    setCriteriaList((prev) => prev.map((c, i) => i === index ? { ...c, ...field } : c));
  };

  const removeCriteria = (index: number) => setCriteriaList((prev) => prev.filter((_, i) => i !== index));

  const saveCriteria = async () => {
    setSaving(true);
    await supabase.from("scoring_criteria").delete().eq("edital_id", edital.id);
    if (criteriaList.length > 0) {
      const rows = criteriaList.map((c, i) => ({
        edital_id: edital.id,
        name: c.name,
        description: c.description || null,
        weight: c.weight,
        max_score: c.max_score,
        sort_order: i,
      }));
      await supabase.from("scoring_criteria").insert(rows);
    }
    setSaving(false);
    toast({ title: "Barema salvo!" });
  };

  const proposalStatusBadge = (s: string) => {
    switch (s) {
      case "draft": return <Badge variant="outline">Rascunho</Badge>;
      case "submitted": return <Badge className="bg-primary/10 text-primary border-primary/20">Submetida</Badge>;
      case "under_review": return <Badge variant="secondary">Em avaliação</Badge>;
      case "accepted": return <Badge className="bg-primary/10 text-primary border-primary/20">Aceita</Badge>;
      case "rejected": return <Badge variant="destructive">Rejeitada</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading text-foreground">{edital.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={status === "published" ? "default" : "outline"}>
              {status === "draft" ? "Rascunho" : status === "published" ? "Publicado" : "Encerrado"}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {status === "draft" && <Button size="sm" onClick={() => handleStatusChange("published")}><Send className="w-4 h-4 mr-1" /> Publicar</Button>}
          {status === "published" && <Button size="sm" variant="secondary" onClick={() => handleStatusChange("closed")}><Lock className="w-4 h-4 mr-1" /> Encerrar</Button>}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="form">Formulário</TabsTrigger>
          <TabsTrigger value="barema">Critérios e Barema</TabsTrigger>
          <TabsTrigger value="reviews">Avaliação</TabsTrigger>
          <TabsTrigger value="proposals">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de início</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Data de fim</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveDetails} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Proposals summary */}
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-lg">Propostas</CardTitle></CardHeader>
            <CardContent>
              {loadingProposals ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta recebida.</p>
              ) : (
                <div className="space-y-2">
                  {proposals.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-bold text-primary">{p.blind_code || p.id.slice(0, 8)}</span>
                        {p.knowledge_areas?.name && <span className="text-xs text-muted-foreground ml-2">{p.knowledge_areas.name}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {proposalStatusBadge(p.status)}
                        <span className="text-xs text-muted-foreground">
                          {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString("pt-BR") : new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulário */}
        <TabsContent value="form">
          <EditalFormBuilder editalId={edital.id} orgId={orgId} />
        </TabsContent>

        {/* Critérios e Barema */}
        <TabsContent value="barema">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Barema de Avaliação</CardTitle>
                <Button size="sm" variant="outline" onClick={addCriteria}><Plus className="w-4 h-4 mr-1" /> Critério</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCriteria ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : criteriaList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum critério configurado.</p>
              ) : (
                criteriaList.map((c, i) => (
                  <div key={i} className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Critério</Label>
                        <Input value={c.name} onChange={(e) => updateCriteria(i, { name: e.target.value })} placeholder="Ex: Mérito técnico" className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Descrição</Label>
                        <Input value={c.description} onChange={(e) => updateCriteria(i, { description: e.target.value })} placeholder="Descrição do critério" className="mt-1" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Peso</Label>
                        <Input type="number" value={c.weight} onChange={(e) => updateCriteria(i, { weight: Number(e.target.value) })} min={0.1} step={0.1} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Nota máxima</Label>
                        <Input type="number" value={c.max_score} onChange={(e) => updateCriteria(i, { max_score: Number(e.target.value) })} min={1} className="mt-1" />
                      </div>
                      <div className="flex items-end">
                        <Button size="sm" variant="ghost" onClick={() => removeCriteria(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {criteriaList.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={saveCriteria} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Save className="w-4 h-4 mr-2" /> Salvar Barema
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Avaliação */}
        <TabsContent value="reviews">
          <ReviewManagement editalId={edital.id} editalTitle={edital.title} />
          <Separator className="my-6" />
          <IdentityReveal
            editalId={edital.id}
            editalTitle={edital.title}
            editalStatus={status}
            proposals={proposals.map((p: any) => ({
              id: p.id,
              blind_code: p.blind_code || p.id.slice(0, 8),
              status: p.status,
            }))}
          />
        </TabsContent>

        {/* Relatórios (Proposals) */}
        <TabsContent value="proposals">
          <Card>
            <CardHeader><CardTitle className="text-lg">Relatórios</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Relatórios detalhados serão implementados na próxima iteração.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configurações */}
        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Settings className="w-5 h-5" /> Configurações do Edital</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prazo de avaliação</Label>
                  <Input type="date" value={reviewDeadline} onChange={(e) => setReviewDeadline(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Mín. avaliadores por proposta</Label>
                  <Input type="number" value={minReviewers} onChange={(e) => setMinReviewers(Number(e.target.value))} min={1} max={10} className="mt-1" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Avaliação cega (blind review)</Label>
                  <p className="text-xs text-muted-foreground">Ocultar identidade dos proponentes para avaliadores</p>
                </div>
                <input type="checkbox" checked={blindReview} onChange={(e) => setBlindReview(e.target.checked)} className="rounded" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveDetails} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  <Save className="w-4 h-4 mr-2" /> Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditalDetail;
