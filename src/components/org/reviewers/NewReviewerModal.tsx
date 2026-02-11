import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import CnpqAreaSelector from "@/components/CnpqAreaSelector";
import InstitutionSelector from "@/components/InstitutionSelector";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = [4, 4, 4];
  return segments.map(len => {
    let s = "";
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }).join("-");
}

function parseAreaValue(value: string): { code: string; name: string } | null {
  if (!value) return null;
  const parts = value.split(" - ");
  const code = parts[0]?.trim();
  const name = parts.slice(1).join(" - ").trim();
  if (!code) return null;
  return { code, name: name || code };
}

const NewReviewerModal = ({ open, onOpenChange, orgId }: Props) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    cpf: "",
    inviteCode: "",
    lattes_url: "",
    orcid: "",
    bio: "",
  });
  const [institution, setInstitution] = useState({
    institution_id: null as string | null,
    institution_name: "",
    institution_custom_name: null as string | null,
    institution_type: null as string | null,
    institution_sigla: null as string | null,
  });

  // Primary and secondary areas
  const [primaryArea, setPrimaryArea] = useState<string | null>(null);
  const [secondaryArea, setSecondaryArea] = useState<string | null>(null);

  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ code: string; link: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(prev => ({ ...prev, inviteCode: generateInviteCode() }));
      setCreatedResult(null);
    }
  }, [open]);

  const resetForm = () => {
    setForm({ full_name: "", email: "", cpf: "", inviteCode: generateInviteCode(), lattes_url: "", orcid: "", bio: "" });
    setInstitution({ institution_id: null, institution_name: "", institution_custom_name: null, institution_type: null, institution_sigla: null });
    setKeywords([]);
    setKeywordInput("");
    setPrimaryArea(null);
    setSecondaryArea(null);
    setCreatedResult(null);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setKeywordInput("");
  };

  const hashCpf = async (cpf: string): Promise<string> => {
    const clean = cpf.replace(/\D/g, "");
    const data = new TextEncoder().encode(clean);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
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

  // Build areas array from primary + secondary
  const buildAreasArray = () => {
    const result: { code: string; name: string; role: string }[] = [];
    const p = parseAreaValue(primaryArea || "");
    if (p) result.push({ ...p, role: "primary" });
    const s = parseAreaValue(secondaryArea || "");
    if (s) result.push({ ...s, role: "secondary" });
    return result;
  };

  // Check for duplicate selection
  const primaryParsed = parseAreaValue(primaryArea || "");
  const secondaryParsed = parseAreaValue(secondaryArea || "");
  const isDuplicate = primaryParsed && secondaryParsed && primaryParsed.code === secondaryParsed.code;

  const createMutation = useMutation({
    mutationFn: async () => {
      const email = form.email.toLowerCase().trim();
      const cpfClean = form.cpf.replace(/\D/g, "");
      if (!validateCpf(cpfClean)) throw new Error("CPF inválido.");
      if (form.inviteCode.length < 6) throw new Error("Código do convite deve ter pelo menos 6 caracteres.");
      if (isDuplicate) throw new Error("Área principal e secundária não podem ser iguais.");

      const cpfHashed = await hashCpf(cpfClean);
      const cpfLast4 = cpfClean.slice(-4);
      const areas = buildAreasArray();

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
          status: "INVITED",
          invited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("E-mail já cadastrado nesta organização.");
        throw error;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        organization_id: orgId,
        entity: "reviewer",
        entity_id: reviewer.id,
        action: "REVIEWER_CREATED",
        metadata_json: { email, full_name: form.full_name.trim(), invite_code: form.inviteCode },
      });

      try {
        await supabase.functions.invoke("send-reviewer-invite", {
          body: { reviewerId: reviewer.id, orgId, inviteCode: form.inviteCode.trim() },
        });
      } catch {
        console.error("Failed to send invite email");
      }

      return reviewer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviewers", orgId] });
      const activateLink = `${window.location.origin}/reviewer/activate`;
      setCreatedResult({ code: form.inviteCode, link: activateLink });
      toast.success("Avaliador cadastrado e convite gerado!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao cadastrar avaliador."),
  });

  const copyToClipboard = async (text: string, type: "code" | "link") => {
    await navigator.clipboard.writeText(text);
    if (type === "code") { setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
    else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
  };

  const customSiglaValid = institution.institution_sigla ? institution.institution_sigla.trim().length >= 2 && institution.institution_sigla.trim().length <= 10 : false;
  const institutionValid = !!institution.institution_id || (!!institution.institution_custom_name?.trim() && !!institution.institution_type && customSiglaValid);
  const cpfClean = form.cpf.replace(/\D/g, "");
  const inviteCodeValid = form.inviteCode.length >= 6 && form.inviteCode.length <= 32;
  const isValid = form.full_name.trim() && form.email.trim() && cpfClean.length === 11 && institutionValid && !!primaryArea && !isDuplicate && inviteCodeValid;

  if (createdResult) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); } onOpenChange(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convite Gerado com Sucesso</DialogTitle>
            <DialogDescription>Compartilhe o código ou link de ativação com o avaliador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Código do Convite</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg p-3 font-mono text-lg tracking-wider text-center font-bold text-foreground">
                  {createdResult.code}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdResult.code, "code")}>
                  {copiedCode ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Link de Ativação</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={createdResult.link} className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(createdResult.link, "link")}>
                  {copiedLink ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">O convite expira em 7 dias. O avaliador deve usar o código na página de ativação para criar sua conta.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => { resetForm(); onOpenChange(false); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
            onChange={(val) => setInstitution({ ...val, institution_sigla: val.institution_sigla ?? null })}
          />

          {/* Primary Area - Required */}
          <div className="space-y-1.5">
            <Label>Área do Conhecimento Principal (CNPq) <span className="text-destructive">*</span></Label>
            <CnpqAreaSelector
              value={primaryArea}
              onChange={(v) => setPrimaryArea(v)}
            />
          </div>

          {/* Secondary Area - Optional */}
          <div className="space-y-1.5">
            <Label>Área do Conhecimento Secundária (CNPq)</Label>
            <CnpqAreaSelector
              value={secondaryArea}
              onChange={(v) => setSecondaryArea(v)}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">A área secundária não pode ser igual à principal.</p>
            )}
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

          <div className="space-y-1.5">
            <Label>Código do Convite <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                value={form.inviteCode}
                onChange={(e) => setForm({ ...form, inviteCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32) })}
                placeholder="EX: EDITAL-PQ-2026-F1"
                className="font-mono tracking-wider"
                maxLength={32}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, inviteCode: generateInviteCode() })}>
                Gerar novo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Gerado automaticamente. Editável pelo gestor. A-Z, 0-9, hífen. 6 a 32 caracteres.</p>
            {form.inviteCode.length > 0 && form.inviteCode.length < 6 && (
              <p className="text-xs text-destructive">Mínimo 6 caracteres</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!isValid || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar e Gerar Convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewReviewerModal;
