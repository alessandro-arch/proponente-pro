import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";

const ReviewerInvitePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [invite, setInvite] = useState<any>(null);
  const [reviewer, setReviewer] = useState<any>(null);

  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptConflict, setAcceptConflict] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token de convite não fornecido.");
        setLoading(false);
        return;
      }

      try {
        // Call edge function to validate token (uses service role to read invite)
        const { data, error: fnError } = await supabase.functions.invoke("validate-reviewer-invite", {
          body: { token },
        });

        if (fnError || data?.error) {
          setError(data?.error || "Token inválido ou expirado.");
          setLoading(false);
          return;
        }

        setInvite(data.invite);
        setReviewer(data.reviewer);
      } catch {
        setError("Erro ao validar convite.");
      }
      setLoading(false);
    };

    validateToken();
  }, [token]);

  const handleSubmit = async () => {
    if (!acceptTerms || !acceptConflict) {
      toast.error("Aceite os termos para continuar.");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("accept-reviewer-invite", {
        body: {
          token,
          password,
        },
      });

      if (fnError || data?.error) {
        toast.error(data?.error || "Erro ao aceitar convite.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      toast.success("Convite aceito com sucesso! Você já pode fazer login.");
    } catch {
      toast.error("Erro inesperado ao aceitar convite.");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-bold mb-2">Convite Inválido</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-primary mb-4" />
            <h2 className="text-lg font-bold mb-2">Cadastro Realizado!</h2>
            <p className="text-muted-foreground mb-4">Seu cadastro como avaliador foi concluído. Agora você pode acessar o sistema.</p>
            <Button onClick={() => window.location.href = "/login"}>Ir para o Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mx-auto mb-2">
            <FileText className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Convite para Avaliador</CardTitle>
          <CardDescription>
            Você foi convidado(a) para atuar como avaliador(a) no SisConnecta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium">{reviewer?.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium">{reviewer?.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Instituição</p>
              <p className="text-sm font-medium">{reviewer?.institution}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Crie sua senha <span className="text-destructive">*</span></Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                Declaro que li e aceito os <strong>Termos de Avaliação e Confidencialidade</strong>, comprometendo-me a manter sigilo sobre todas as propostas avaliadas.
              </Label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="conflict"
                checked={acceptConflict}
                onCheckedChange={(v) => setAcceptConflict(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="conflict" className="text-sm leading-relaxed cursor-pointer">
                Declaro ausência de conflito de interesse geral para atuar como avaliador, ciente de que conflitos específicos poderão ser declarados por edital.
              </Label>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!acceptTerms || !acceptConflict || !password || submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Aceitar e Finalizar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewerInvitePage;
