import { createClient } from "npm:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const body=await req.json(),profileId=String(body.profileId||"");
  if(!profileId||profileId.length>80)return json({error:"Profile required"},400);
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  if(body.action==="list"){
   const {data,error}=await admin.from("karaoke_achievements").select("achievement_key,created_at,trigger_song_id").eq("profile_id",profileId).order("created_at");
   if(error)throw error;
   return json({achievements:data});
  }
  if(body.action==="award"){
   const key=String(body.achievementKey||""),songId=body.songId?String(body.songId).slice(0,100):null;
   if(!/^[a-z0-9_-]{2,80}$/.test(key))return json({error:"Invalid achievement"},400);
   const {data,error}=await admin.from("karaoke_achievements").upsert({id:crypto.randomUUID(),profile_id:profileId,achievement_key:key,trigger_song_id:songId},{onConflict:"profile_id,achievement_key",ignoreDuplicates:true}).select("achievement_key,created_at,trigger_song_id");
   if(error)throw error;
   return json({newAchievement:data?.[0]||null});
  }
  return json({error:"Unknown action"},400);
 }catch(error){console.error(error);return json({error:"Achievement service unavailable"},500)}
});
