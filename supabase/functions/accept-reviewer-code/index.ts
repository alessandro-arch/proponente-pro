import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { invite_code, password, cpf, full_name, institution, institution_id, institution_custom_name, institution_type, areas, keywords, lattes_url } = await req.json();
    if (!invite_code || !password) throw new Error("Missing invite_code or password");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");
    if (!cpf || cpf.length !== 11) throw new Error("CPF is required (11 digits)");
    if (!full_name?.trim()) throw new Error("Full name is required");

    const code = invite_code.toUpperCase().trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate invite
    const { data: invite, error: inviteErr } = await adminClient
      .from("reviewer_invites")
      .select("*")
      .eq("invite_code", code)
      .is("used_at", null)
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Código não encontrado ou já utilizado." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Este convite expirou." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get reviewer
    const { data: reviewer, error: revErr } = await adminClient
      .from("reviewers")
      .select("*")
      .eq("id", invite.reviewer_id)
      .single();

    if (revErr || !reviewer) throw new Error("Reviewer not found");

    // Hash CPF
    const cpfHash = await hashValue(cpf);
    const cpfLast4 = cpf.slice(-4);

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === reviewer.email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: reviewer.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name.trim() },
      });
      if (createErr) throw createErr;
      userId = newUser.user.id;
    }

    // Add reviewer role in organization_members
    await adminClient
      .from("organization_members")
      .upsert({
        user_id: userId,
        organization_id: invite.org_id,
        role: "reviewer",
      }, { onConflict: "user_id,organization_id" })
      .select();

    // Add to user_roles
    await adminClient
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "reviewer",
      }, { onConflict: "user_id,role" })
      .select();

    // Update reviewer record with all data from the form
    await adminClient
      .from("reviewers")
      .update({
        user_id: userId,
        full_name: full_name.trim(),
        institution: institution?.trim() || reviewer.institution,
        institution_id: institution_id || reviewer.institution_id,
        institution_custom_name: institution_custom_name || reviewer.institution_custom_name,
        institution_type: institution_type || reviewer.institution_type,
        areas: areas && areas.length > 0 ? areas : reviewer.areas,
        keywords: keywords && keywords.length > 0 ? keywords : reviewer.keywords,
        lattes_url: lattes_url || reviewer.lattes_url,
        status: "ACTIVE",
        accepted_at: new Date().toISOString(),
        cpf_hash: cpfHash,
        cpf_last4: cpfLast4,
        first_terms_accepted_at: new Date().toISOString(),
        terms_version: "v1",
      })
      .eq("id", reviewer.id);

    // Mark invite as used
    await adminClient
      .from("reviewer_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Audit log
    await adminClient.from("audit_logs").insert({
      user_id: userId,
      organization_id: invite.org_id,
      entity: "reviewer",
      entity_id: reviewer.id,
      action: "REVIEWER_TERMS_ACCEPTED",
      metadata_json: { email: reviewer.email, method: "invite_code", terms_version: "v1", lgpd_accepted: true },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error accepting invite by code:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(handler);
