import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bcd-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedReactions = new Set(["👍", "❤️", "😂", "😮", "😢", "😡"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

async function trustedWorker(admin: ReturnType<typeof createClient>, req: Request) {
  const supplied = req.headers.get("x-bcd-worker-secret") || "";
  if (supplied.length < 32) return false;
  const { data, error } = await admin
    .from("karaoke_worker_secrets")
    .select("secret_hash")
    .eq("worker_name", "house-guide-vision")
    .maybeSingle();
  if (error || !data?.secret_hash) return false;
  return (await sha256(supplied)) === data.secret_hash;
}

async function cleanExpiredAnalysis(admin: ReturnType<typeof createClient>) {
  const { error } = await admin
    .from("karaoke_chat_image_analysis")
    .delete()
    .lte("expires_at", new Date().toISOString());
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const body = await req.json();
    const action = String(body.action || "edit");

    if (action === "worker_image_context") {
      if (!(await trustedWorker(admin, req))) return json({ error: "Worker authorization failed" }, 403);
      await cleanExpiredAnalysis(admin);
      const messageIds = Array.isArray(body.messageIds)
        ? body.messageIds.map(String).filter((id: string) => id.length > 0 && id.length <= 120).slice(0, 80)
        : [];
      if (!messageIds.length) return json({ analyses: [] });
      const { data, error } = await admin
        .from("karaoke_chat_image_analysis")
        .select("message_id,image_index,private_caption,safety_status,analyzed_at")
        .in("message_id", messageIds)
        .gt("expires_at", new Date().toISOString());
      if (error) throw error;
      return json({ analyses: data || [] });
    }

    if (action === "worker_write_image_analysis") {
      if (!(await trustedWorker(admin, req))) return json({ error: "Worker authorization failed" }, 403);
      await cleanExpiredAnalysis(admin);
      const id = String(body.messageId || "");
      const imageIndex = Number(body.imageIndex);
      const caption = String(body.caption || "").replace(/\s+/g, " ").trim().slice(0, 1200);
      const status = String(body.safetyStatus || "unknown");
      const score = Number.isFinite(Number(body.safetyScore)) ? Math.max(0, Math.min(1, Number(body.safetyScore))) : null;
      const labels = Array.isArray(body.detectedLabels)
        ? body.detectedLabels.map(String).map((label: string) => label.slice(0, 80)).slice(0, 20)
        : [];
      const model = String(body.visionModel || "local-vision").slice(0, 100);
      if (!id || !Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex > 3 || !caption || !["safe", "sensitive", "unknown"].includes(status)) {
        return json({ error: "Invalid image analysis" }, 400);
      }
      const { data: row, error: rowError } = await admin
        .from("karaoke_chat_messages")
        .select("id,image_urls,image_states,created_at")
        .eq("id", id)
        .maybeSingle();
      if (rowError) throw rowError;
      if (!row) return json({ error: "Message not found" }, 404);
      const images = Array.isArray(row.image_urls) ? row.image_urls : [];
      if (imageIndex >= images.length) return json({ error: "Image not found" }, 404);
      const expiresAt = new Date(new Date(row.created_at).getTime() + 60 * 60 * 1000);
      if (expiresAt.getTime() <= Date.now()) return json({ error: "Message has expired" }, 410);
      const { error: analysisError } = await admin.from("karaoke_chat_image_analysis").upsert({
        message_id: id,
        image_index: imageIndex,
        private_caption: caption,
        safety_status: status,
        safety_score: score,
        detected_labels: labels,
        vision_model: model,
        analyzed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "message_id,image_index" });
      if (analysisError) throw analysisError;
      const states = Array.from({ length: images.length }, (_, index) => {
        const previous = Array.isArray(row.image_states) ? row.image_states[index] : null;
        return ["safe", "sensitive", "unknown"].includes(previous) ? previous : "pending";
      });
      states[imageIndex] = status;
      const { error: stateError } = await admin.from("karaoke_chat_messages").update({ image_states: states }).eq("id", id);
      if (stateError) throw stateError;
      return json({ messageId: id, imageIndex, safetyStatus: status });
    }

    const id = String(body.messageId || "");
    const profileId = String(body.profileId || "");
    if (!id || !profileId) return json({ error: "Invalid request" }, 400);
    const { data: row, error } = await admin
      .from("karaoke_chat_messages")
      .select("id,profile_id,message,image_urls,image_states,reactions,created_at")
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
