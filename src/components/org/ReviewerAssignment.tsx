import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users } from "lucide-react";

interface ReviewerAssignmentProps {
  open: boolean;
  onClose: () => void;
  proposalId: string;
  proposalBlindCode: string;
  editalId: string;
  orgId: string;
  submissionCnpqArea?: string | null;
  onAssigned: () => void;
}

interface ReviewerOption {
  user_id: string;
  full_name: string | null;
  email: string | null;
  already_assigned: boolean;
  area_match: boolean;
  reviewer_areas: string;
}

const ReviewerAssignment = ({
  open, onClose, proposalId, proposalBlindCode, editalId, orgId, submissionCnpqArea, onAssigned,
}: ReviewerAssignmentProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewers, setReviewers] = useState<ReviewerOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      setSelected([]);

      // Get org members with reviewer role
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .eq("role", "reviewer");

      const memberIds = (members || []).map((m: any) => m.user_id);
      if (memberIds.length === 0) {
        setReviewers([]);
        setLoading(false);
        return;
      }

      // Get profiles (with research_area_cnpq)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, research_area_cnpq")
        .in("user_id", memberIds);

      // Get reviewer records from reviewers table for area info
      const { data: reviewerRecords } = await supabase
        .from("reviewers")
        .select("user_id, areas")
        .eq("org_id", orgId)
        .in("user_id", memberIds);

      // Get existing assignments for this proposal
      const { data: existing } = await supabase
        .from("review_assignments")
        .select("reviewer_user_id")
        .eq("proposal_id", proposalId);

      const assignedIds = new Set((existing || []).map((e: any) => e.reviewer_user_id));

      // Extract submission area code prefix for matching (e.g. "10000003" from "10000003 - CIÊNCIAS EXATAS...")
      const submissionAreaPrefix = submissionCnpqArea?.split(" - ")[0]?.trim() || "";

      const options: ReviewerOption[] = memberIds.map((uid: string) => {
        const profile = (profiles || []).find((p: any) => p.user_id === uid);
        const reviewerRec = (reviewerRecords || []).find((r: any) => r.user_id === uid);
        
        // Check area match: compare area code prefixes
        const profileArea = profile?.research_area_cnpq || "";
        const profileAreaCode = profileArea.split(" - ")[0]?.trim() || "";
        
        // Match if they share the same grande área (first 1-2 digits) or more specific match
        let areaMatch = false;
        if (submissionAreaPrefix && profileAreaCode) {
          // Match at grande área level (first digit group matches)
          const subGrandeArea = submissionAreaPrefix.substring(0, 1);
          const revGrandeArea = profileAreaCode.substring(0, 1);
          areaMatch = subGrandeArea === revGrandeArea;
        }

        // Also check reviewers table areas
        let reviewerAreasStr = profileArea;
        if (reviewerRec?.areas) {
          const areasArr = Array.isArray(reviewerRec.areas) ? reviewerRec.areas : [];
          if (areasArr.length > 0) {
            reviewerAreasStr = areasArr.map((a: any) => typeof a === 'string' ? a : a?.name || '').join(', ');
            if (!areaMatch && submissionAreaPrefix) {
              areaMatch = areasArr.some((a: any) => {
                const code = typeof a === 'string' ? a.split(" - ")[0]?.trim() : '';
                return code && submissionAreaPrefix.substring(0, 1) === code.substring(0, 1);
              });
            }
          }
        }

        return {
          user_id: uid,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
          already_assigned: assignedIds.has(uid),
          area_match: !submissionAreaPrefix || areaMatch, // if no area filter, all match
          reviewer_areas: reviewerAreasStr,
        };
      });

      setReviewers(options);
      setLoading(false);
    };
    load();
  }, [open, proposalId, orgId]);

  const toggle = (uid: string) => {
    setSelected(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleAssign = async () => {
    if (!user || selected.length === 0) return;
    setSubmitting(true);

    const rows = selected.map(uid => ({
      proposal_id: proposalId,
      reviewer_user_id: uid,
      assigned_by: user.id,
      status: "assigned",
    }));

    const { error } = await supabase.from("review_assignments").insert(rows);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Update proposal status to under_review
    await supabase
      .from("proposals")
      .update({ status: "under_review" as any })
      .eq("id", proposalId);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "reviewers_assigned",
      entity: "proposal",
      entity_id: proposalId,
      metadata_json: { reviewer_count: selected.length, edital_id: editalId },
    });

    toast({ title: `${selected.length} avaliador(es) atribuído(s)!` });
    setSubmitting(false);
    onAssigned();
    onClose();
  };

  const availableReviewers = reviewers.filter(r => !r.already_assigned && r.area_match);
  const outOfAreaReviewers = reviewers.filter(r => !r.already_assigned && !r.area_match);
  const assignedReviewers = reviewers.filter(r => r.already_assigned);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Atribuir Avaliadores — {proposalBlindCode}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {assignedReviewers.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Já atribuídos:</Label>
                <div className="mt-1 space-y-1">
                  {assignedReviewers.map(r => (
                    <div key={r.user_id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                      <Badge variant="secondary" className="text-xs">Atribuído</Badge>
                      <span>{r.full_name || r.email || r.user_id.slice(0, 8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableReviewers.length === 0 && outOfAreaReviewers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum avaliador disponível. Adicione membros com papel "reviewer" na organização.
              </p>
            ) : (
              <>
                {availableReviewers.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      Avaliadores da área
                      {submissionCnpqArea && <Badge variant="outline" className="text-[10px]">Compatíveis</Badge>}
                    </Label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {availableReviewers.map(r => (
                        <label
                          key={r.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selected.includes(r.user_id)}
                            onCheckedChange={() => toggle(r.user_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {r.full_name || "Sem nome"}
                            </p>
                            {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {outOfAreaReviewers.length > 0 && (
                  <div>
                    <Label className="text-xs text-destructive flex items-center gap-1">
                      Fora da área da proposta
                      <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Não recomendado</Badge>
                    </Label>
                    <div className="mt-2 space-y-2 max-h-32 overflow-y-auto opacity-70">
                      {outOfAreaReviewers.map(r => (
                        <label
                          key={r.user_id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selected.includes(r.user_id)}
                            onCheckedChange={() => toggle(r.user_id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {r.full_name || "Sem nome"}
                            </p>
                            {r.email && <p className="text-xs text-muted-foreground truncate">{r.email}</p>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleAssign}
              className="w-full"
              disabled={submitting || selected.length === 0}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Atribuir {selected.length > 0 ? `(${selected.length})` : ""} Avaliador(es)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReviewerAssignment;
