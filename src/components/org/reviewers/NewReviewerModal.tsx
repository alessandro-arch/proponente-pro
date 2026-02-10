import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

const NewReviewerModal = ({ open, onOpenChange, orgId }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    institution: "",
    lattes_url: "",
    orcid: "",
    bio: "",
    sendInvite: true,
  });
  const [areas, setAreas] = useState<{ code: string; name: string }[]>([]);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  const resetForm = () => {
    setForm({ full_name: "", email: "", institution: "", lattes_url: "", orcid: "", bio: "", sendInvite: true });
    setAreas([]);
    setKeywords([]);
    setKeywordInput("");
    setCurrentArea(null);
  };

  const addArea = (value: string) => {
    if (!value) return;
    const parts = value.split(" - ");
    const code = parts[0]?.trim();
    const name = parts.slice(1).join(" - ").trim();
    if (areas.find((a) => a.code === code)) return;
    setAreas([...areas, { code, name }]);
    setCurrentArea(null);
  };

  const removeArea = (code: string) => setAreas(areas.filter((a) => a.code !== code));

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const email = form.email.toLowerCase().trim();

      const { data: reviewer, error } = await supabase
        .from("reviewers")
        .insert({
          org_id: orgId,
          full_name: form.full_name.trim(),
          email,
          institution: form.institution.trim(),
          areas: areas as any,
          keywords: keywords.length > 0 ? keywords : null,
          lattes_url: form.lattes_url || null,
          orcid: form.orcid || null,
          bio: form.bio || null,
          status: form.sendInvite ? "INVITED" : "PENDING",
          invited_at: form.sendInvite ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("E-mail já cadastrado nesta organização.");
        throw error;
      }

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        organization_id: orgId,
        entity: "reviewer",
        entity_id: reviewer.id,
        action: "REVIEWER_CREATED",
        metadata_json: { email, full_name: form.full_name.trim() },
      });

      // Send invite if checked
      if (form.sendInvite) {
        try {
          await supabase.functions.invoke("send-reviewer-invite", {
            body: { reviewerId: reviewer.id, orgId },
          });
        } catch {
          console.error("Failed to send invite email");
        }
      }

      return reviewer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      toast.success("Avaliador cadastrado com sucesso!");
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao cadastrar avaliador."),
  });

  const isValid = form.full_name.trim() && form.email.trim() && form.institution.trim() && areas.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Avaliador</DialogTitle>
          <DialogDescription>Cadastre um avaliador no banco da organização.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome completo <span className="text-destructive">*</span></Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Instituição de vínculo <span className="text-destructive">*</span></Label>
            <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Áreas do Conhecimento (CNPq) <span className="text-destructive">*</span></Label>
            {areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {areas.map((a) => (
                  <Badge key={a.code} variant="secondary" className="gap-1">
                    {a.name || a.code}
                    <button type="button" onClick={() => removeArea(a.code)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <CnpqAreaSelector
              value={currentArea}
              onChange={(v) => {
                addArea(v);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Palavras-chave</Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                placeholder="Digite e pressione Enter"
              />
              <Button type="button" variant="outline" onClick={addKeyword}>Adicionar</Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="outline" className="gap-1">
                    {kw}
                    <button type="button" onClick={() => setKeywords(keywords.filter((k) => k !== kw))}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lattes URL</Label>
              <Input value={form.lattes_url} onChange={(e) => setForm({ ...form, lattes_url: e.target.value })} placeholder="http://lattes.cnpq.br/..." />
            </div>
            <div className="space-y-1.5">
              <Label>ORCID</Label>
              <Input value={form.orcid} onChange={(e) => setForm({ ...form, orcid: e.target.value })} placeholder="0000-0000-0000-0000" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mini bio</Label>
            <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="sendInvite"
              checked={form.sendInvite}
              onCheckedChange={(v) => setForm({ ...form, sendInvite: !!v })}
            />
            <Label htmlFor="sendInvite" className="cursor-pointer">Enviar convite por e-mail agora</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewReviewerModal;
