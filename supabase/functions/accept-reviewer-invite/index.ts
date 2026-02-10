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
    const { token, password } = await req.json();
    if (!token || !password) throw new Error("Missing token or password");
    if (password.length < 6) throw new Error("Password must be at least 6 characters");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await hashToken(token);

    // Validate invite
    const { data: invite, error: inviteErr } = await adminClient
      .from("reviewer_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("used_at", null)
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Convite não encontrado ou já utilizado." }),
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

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === reviewer.email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: reviewer.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: reviewer.full_name },
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

    // Also add to user_roles
    await adminClient
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: "reviewer",
      }, { onConflict: "user_id,role" })
      .select();

    // Update reviewer record
    await adminClient
      .from("reviewers")
      .update({
        user_id: userId,
        status: "ACTIVE",
        accepted_at: new Date().toISOString(),
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
      metadata_json: { email: reviewer.email },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error accepting invite:", error);
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
