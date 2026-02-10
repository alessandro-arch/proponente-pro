import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { reviewerId, orgId } = await req.json();
    if (!reviewerId || !orgId) throw new Error("Missing reviewerId or orgId");

    // Use service role to create invite
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get reviewer
    const { data: reviewer, error: revErr } = await adminClient
      .from("reviewers")
      .select("*")
      .eq("id", reviewerId)
      .eq("org_id", orgId)
      .single();
    if (revErr || !reviewer) throw new Error("Reviewer not found");

    // Get org name
    const { data: org } = await adminClient
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    // Generate token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const tokenHash = await hashToken(token);

    // Expire old invites
    await adminClient
      .from("reviewer_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("reviewer_id", reviewerId)
      .is("used_at", null);

    // Create invite
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const { error: inviteErr } = await adminClient
      .from("reviewer_invites")
      .insert({
        org_id: orgId,
        reviewer_id: reviewerId,
        email: reviewer.email,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });
    if (inviteErr) throw inviteErr;

    // Update reviewer status
    await adminClient
      .from("reviewers")
      .update({ status: "INVITED", invited_at: new Date().toISOString() })
      .eq("id", reviewerId);

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: user.id,
      organization_id: orgId,
      entity: "reviewer",
      entity_id: reviewerId,
      action: "REVIEWER_INVITE_SENT",
      metadata_json: { email: reviewer.email },
    });

    // Send email
    const appUrl = req.headers.get("origin") || "https://proponente-pro.lovable.app";
    const inviteUrl = `${appUrl}/invite/reviewer?token=${token}`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "SisConnecta <onboarding@resend.dev>",
        to: [reviewer.email],
        subject: `Convite para Avaliador — ${org?.name || "SisConnecta"}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            .header { background: #1a1a2e; color: #fff; padding: 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { padding: 32px; }
            .cta { text-align: center; margin: 32px 0 16px; }
            .cta a { background: #3b82f6; color: #fff; padding: 14px 36px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; }
            .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }
          </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h1>📋 Convite para Avaliador</h1></div>
              <div class="content">
                <p>Olá, <strong>${reviewer.full_name}</strong>,</p>
                <p>Você foi convidado(a) pela organização <strong>${org?.name || "—"}</strong> para atuar como avaliador(a) no SisConnecta.</p>
                <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>
                <div class="cta"><a href="${inviteUrl}">Aceitar Convite</a></div>
                <p style="color: #64748b; font-size: 14px;">Este convite é válido por 7 dias. Caso expire, solicite um novo convite à organização.</p>
              </div>
              <div class="footer"><p>SisConnecta Editais — Email automático, não responda.</p></div>
            </div>
          </body>
          </html>
        `,
      });
    }

    return new Response(JSON.stringify({ success: true, inviteUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending reviewer invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);
