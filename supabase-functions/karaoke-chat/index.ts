import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedReactions = new Set(["👍", "❤️", "😂", "😮", "😢", "😡"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = String(body.action || "edit");
    const id = String(body.messageId || "");
    const profileId = String(body.profileId || "");
    if (!id || !profileId) return json({ error: "Invalid request" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: row, error } = await admin
      .from("karaoke_chat_messages")
      .select("id,profile_id,message,image_urls,reactions,created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return json({ error: "Message not found" }, 404);

    if (action === "react") {
      if (row.profile_id === profileId) return json({ error: "Use message options on your own message" }, 403);
      if (Date.now() - new Date(row.created_at).getTime() > 60 * 60 * 1000) return json({ error: "That message has expired" }, 410);
      const reaction = String(body.reaction || "");
      if (!allowedReactions.has(reaction)) return json({ error: "Invalid reaction" }, 400);
      const reactions = { ...(row.reactions || {}) } as Record<string, string>;
      if (reactions[profileId] === reaction) delete reactions[profileId];
      else reactions[profileId] = reaction;
      const { data, error: updateError } = await admin.from("karaoke_chat_messages").update({ reactions }).eq("id", id).select("id,reactions").single();
      if (updateError) throw updateError;
      return json({ message: data });
    }

    const message = String(body.message || "").trim();
    const hasImages = Array.isArray(row.image_urls) && row.image_urls.length > 0;
    if (message.length > 1000 || (!message && !hasImages)) return json({ error: "Invalid message" }, 400);
    if (row.profile_id !== profileId) return json({ error: "You can only edit your own messages" }, 403);
    if (Date.now() - new Date(row.created_at).getTime() > 60 * 60 * 1000) return json({ error: "Messages can only be edited while they are in the room" }, 403);
    const { data, error: updateError } = await admin.from("karaoke_chat_messages").update({ message, edited_at: new Date().toISOString() }).eq("id", id).select("id,message,edited_at").single();
    if (updateError) throw updateError;
    return json({ message: data });
  } catch (error) {
    console.error(error);
    return json({ error: "Could not update message" }, 500);
  }
});
