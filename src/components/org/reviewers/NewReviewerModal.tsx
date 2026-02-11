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
import InstitutionSelector from "@/components/InstitutionSelector";

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
    cpf: "",
    lattes_url: "",
    orcid: "",
    bio: "",
    sendInvite: true,
  });
  const [institution, setInstitution] = useState({
    institution_id: null as string | null,
    institution_name: "",
    institution_custom_name: null as string | null,
    institution_type: null as string | null,
  });
  const [areas, setAreas] = useState<{ code: string; name: string }[]>([]);
  const [currentArea, setCurrentArea] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  const resetForm = () => {
    setForm({ full_name: "", email: "", cpf: "", lattes_url: "", orcid: "", bio: "", sendInvite: true });
    setInstitution({ institution_id: null, institution_name: "", institution_custom_name: null, institution_type: null });
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

  const hashCpf = async (cpf: string): Promise<string> => {
    const clean = cpf.replace(/\D/g, "");
    const encoder = new TextEncoder();
    const data = encoder.encode(clean);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const validateCpf = (cpf: string): boolean => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    if (rest !== parseInt(clean[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10) rest = 0;
    return rest === parseInt(clean[10]);
  };

  const formatCpf = (value: string): string => {
    const clean = value.replace(/\D/g, "").slice(0, 11);
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const email = form.email.toLowerCase().trim();
      const cpfClean = form.cpf.replace(/\D/g, "");

      if (!validateCpf(cpfClean)) throw new Error("CPF inválido.");

      const cpfHashed = await hashCpf(cpfClean);
      const cpfLast4 = cpfClean.slice(-4);

      const { data: reviewer, error } = await supabase
        .from("reviewers")
        .insert({
          org_id: orgId,
          full_name: form.full_name.trim(),
          email,
          cpf_hash: cpfHashed,
          cpf_last4: cpfLast4,
          institution: institution.institution_name.trim(),
          institution_id: institution.institution_id || null,
          institution_custom_name: institution.institution_custom_name || null,
          institution_type: institution.institution_type || null,
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

  const institutionValid = !!institution.institution_id || (!!institution.institution_custom_name?.trim() && !!institution.institution_type);
  const cpfClean = form.cpf.replace(/\D/g, "");
  const isValid = form.full_name.trim() && form.email.trim() && cpfClean.length === 11 && institutionValid && areas.length > 0;

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
            <Label>CPF <span className="text-destructive">*</span></Label>
            <Input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })}
              placeholder="000.000.000-00"
              maxLength={14}
            />
            {cpfClean.length === 11 && !validateCpf(cpfClean) && (
              <p className="text-xs text-destructive">CPF inválido</p>
            )}
          </div>

          <InstitutionSelector
            label="Instituição de vínculo"
            required
            value={institution}
            onChange={setInstitution}
          />

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
