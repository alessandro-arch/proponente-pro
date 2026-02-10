import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, ScrollText, Search } from "lucide-react";
import EditalDetail from "@/components/org/EditalDetail";

interface Edital {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

const EditaisList = ({ orgId }: { orgId: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [editais, setEditais] = useState<Edital[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedEdital, setSelectedEdital] = useState<Edital | null>(null);

  const fetchEditais = async () => {
    setLoading(true);
    let query = supabase.from("editais").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter as "draft" | "published" | "closed");
    if (search.trim()) query = query.ilike("title", `%${search.trim()}%`);
    const { data } = await query;
    setEditais((data || []) as Edital[]);
    setLoading(false);
  };

  useEffect(() => { fetchEditais(); }, [orgId, filter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    const { error } = await supabase.from("editais").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      organization_id: orgId,
      created_by: user.id,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Edital criado!" });
      setNewTitle("");
      setNewDesc("");
      setDialogOpen(false);
      fetchEditais();
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "draft": return <Badge variant="outline">Rascunho</Badge>;
      case "published": return <Badge className="bg-primary/10 text-primary border-primary/20">Publicado</Badge>;
      case "closed": return <Badge variant="secondary">Encerrado</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  if (selectedEdital) {
    return <EditalDetail edital={selectedEdital} orgId={orgId} onBack={() => { setSelectedEdital(null); fetchEditais(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-heading text-foreground">Editais</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Edital</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Edital</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título do edital" className="mt-1" required />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descrição..." className="mt-1" rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Criar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar edital..." className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="closed">Encerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : editais.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum edital encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {editais.map((e) => (
            <Card key={e.id} className="cursor-pointer hover:shadow-card transition-shadow" onClick={() => setSelectedEdital(e)}>
              <CardContent className="p-5 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{e.title}</p>
                    {statusBadge(e.status)}
                  </div>
                  {e.description && <p className="text-sm text-muted-foreground line-clamp-1">{e.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    Criado em {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    {e.start_date && ` · Início: ${new Date(e.start_date).toLocaleDateString("pt-BR")}`}
                    {e.end_date && ` · Fim: ${new Date(e.end_date).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditaisList;
