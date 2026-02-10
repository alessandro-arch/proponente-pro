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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, Send, Lock, Plus, FileText, Settings } from "lucide-react";
import FormKnowledgeAreas from "@/components/org/FormKnowledgeAreas";

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

interface FormSchema {
  id: string;
  edital_id: string;
  version: number;
  schema_json: any;
  is_active: boolean;
  created_at: string;
}

const EditalDetail = ({ edital, orgId, onBack }: { edital: Edital; orgId: string; onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState(edital.status);

  // Form schema state
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [loadingForm, setLoadingForm] = useState(true);
  const [creatingForm, setCreatingForm] = useState(false);

  // JSON editor state
  const [editing, setEditing] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [savingJson, setSavingJson] = useState(false);

  useEffect(() => {
    loadFormSchema();
  }, [edital.id]);

  const loadFormSchema = async () => {
    setLoadingForm(true);
    // Load edital_forms record
    const { data: efData } = await supabase
      .from("edital_forms")
      .select("id")
      .eq("edital_id", edital.id)
      .maybeSingle();
    setFormId(efData?.id || null);

    // Load schema
    const { data } = await supabase
      .from("edital_form_schemas")
      .select("*")
      .eq("edital_id", edital.id)
      .eq("is_active", true)
      .maybeSingle();
    setFormSchema(data as FormSchema | null);
    setLoadingForm(false);
  };

  const handleCreateForm = async () => {
    if (!user) return;
    setCreatingForm(true);

    // Create edital_forms record if not exists
    let currentFormId = formId;
    if (!currentFormId) {
      const { data: efData, error: efError } = await supabase
        .from("edital_forms")
        .insert({
          edital_id: edital.id,
          organization_id: orgId,
          status: "draft",
        })
        .select()
        .single();
      if (efError) {
        toast({ title: "Erro", description: efError.message, variant: "destructive" });
        setCreatingForm(false);
        return;
      }
      currentFormId = efData.id;
      setFormId(currentFormId);
    }

    // Create schema
    const { data, error } = await supabase
      .from("edital_form_schemas")
      .insert({
        edital_id: edital.id,
        version: 1,
        schema_json: {},
        is_active: true,
      })
      .select()
      .single();
    setCreatingForm(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setFormSchema(data as FormSchema);
      toast({ title: "Formulário criado!" });
    }
  };

  const handleOpenEditor = () => {
    if (!formSchema) return;
    setJsonText(JSON.stringify(formSchema.schema_json, null, 2));
    setJsonError(null);
    setEditing(true);
  };

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    try {
      JSON.parse(value);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const handleSaveJson = async () => {
    if (!formSchema) return;
    try {
      const parsed = JSON.parse(jsonText);
      setSavingJson(true);
      const { error } = await supabase
        .from("edital_form_schemas")
        .update({ schema_json: parsed })
        .eq("id", formSchema.id);
      setSavingJson(false);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        setFormSchema({ ...formSchema, schema_json: parsed });
        setEditing(false);
        toast({ title: "Formulário salvo!" });
      }
    } catch {
      setJsonError("JSON inválido");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from("editais")
      .update({ status: newStatus as "draft" | "published" | "closed" })
      .eq("id", edital.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setStatus(newStatus);
      toast({ title: `Edital ${newStatus === "published" ? "publicado" : newStatus === "closed" ? "encerrado" : "revertido"}!` });
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "draft": return "Rascunho";
      case "published": return "Publicado";
      case "closed": return "Encerrado";
      default: return s;
    }
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
            <Badge variant={status === "published" ? "default" : "outline"}>
              {statusLabel(status)}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {status === "draft" && (
            <Button size="sm" onClick={() => handleStatusChange("published")}>
              <Send className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
          {status === "published" && (
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
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Visão Geral - read-only */}
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
                  <p className="text-foreground">{statusLabel(status)}</p>
                </div>
                {edital.start_date && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <p className="text-foreground">{new Date(edital.start_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
                {edital.end_date && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Fim</Label>
                    <p className="text-foreground">{new Date(edital.end_date).toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulário */}
        <TabsContent value="form">
          {loadingForm ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !formSchema ? (
            /* Empty state - no form yet */
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
          ) : editing ? (
            /* JSON Editor */
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Editor de Formulário (MVP)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>schema_json</Label>
                    <Textarea
                      value={jsonText}
                      onChange={(e) => handleJsonChange(e.target.value)}
                      className="mt-1 font-mono text-sm min-h-[300px]"
                      placeholder='{"fields": []}'
                    />
                    {jsonError && (
                      <p className="text-sm text-destructive mt-1">{jsonError}</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                    <Button onClick={handleSaveJson} disabled={savingJson || !!jsonError}>
                      {savingJson && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <FormKnowledgeAreas formId={formId} />
            </>
          ) : (
            /* Form exists - show summary */
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Formulário</CardTitle>
                    <Badge variant="outline">draft</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Versão</Label>
                      <p className="text-foreground">{formSchema.version}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Última atualização</Label>
                      <p className="text-foreground">{new Date(formSchema.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button onClick={handleOpenEditor}>
                      <FileText className="w-4 h-4 mr-2" /> Editar Formulário
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <FormKnowledgeAreas formId={formId} />
            </>
          )}
        </TabsContent>

        {/* Configurações - placeholder */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" /> Configurações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configurações avançadas serão implementadas na próxima iteração.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EditalDetail;
