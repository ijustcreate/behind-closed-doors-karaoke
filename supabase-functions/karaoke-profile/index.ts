import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...cors,"Content-Type":"application/json"}});
const cleanBase=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,30)||"singer";
const ilikeLiteral=(value:string)=>value.replace(/[\\%_]/g,match=>`\\${match}`);
const shape=(p:any)=>({id:p.id,username:p.username,name:p.display_name,isAdmin:!!p.is_admin,lastSeen:p.last_seen});
const validHash=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{64}$/i.test(value);

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const body=await req.json(), admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
  const adminActor=async()=>{const {data,error}=await admin.from("karaoke_profiles").select("id,password_hash,is_admin").eq("id",String(body.actorId||"")).maybeSingle();if(error)throw error;if(!data?.is_admin)return null;if(!data.password_hash)return "password_required";return data.password_hash===body.actorPasswordHash?data:null};

  if(body.action==="get_active_menu"){
   const {data,error}=await admin.from("karaoke_app_settings").select("setting_value,updated_at").eq("setting_key","active_drink_menu").maybeSingle();
   if(error)throw error;
   return json({menu:data?.setting_value||null,updatedAt:data?.updated_at||null});
  }
  if(body.action==="set_active_menu"){
   const actor=await adminActor();
   if(actor==="password_required")return json({error:"Add a password to your admin profile before changing the live drink menu."},403);
   if(!actor)return json({error:"Admin authorization required"},403);
   const menu=body.menu;
   if(!menu||typeof menu!=="object"||typeof menu.name!=="string"||!Array.isArray(menu.drinks))return json({error:"A valid drink menu is required"},400);
   const safeMenu={name:String(menu.name).slice(0,60),subheader:String(menu.subheader||"").slice(0,100),subheaderVisible:!!menu.subheaderVisible,drinks:menu.drinks.slice(0,100).map((drink:any)=>({id:String(drink.id||crypto.randomUUID()).slice(0,100),name:String(drink.name||"").slice(0,100),price:String(drink.price||"").slice(0,30),description:String(drink.description||"").slice(0,500),image:typeof drink.image==="string"&&drink.image.length<=1500000?drink.image:""}))};
   const {error}=await admin.from("karaoke_app_settings").upsert({setting_key:"active_drink_menu",setting_value:safeMenu,updated_at:new Date().toISOString()},{onConflict:"setting_key"});
   if(error)throw error;
   return json({status:"ok",menu:safeMenu});
  }
  if(body.action==="active_profiles"){const {data,error}=await admin.from("karaoke_profiles").select("id,display_name,last_seen").gte("last_seen",new Date(Date.now()-20*60*1000).toISOString()).order("last_seen",{ascending:false});if(error)throw error;return json({profiles:data.map((p:any)=>({id:p.id,name:p.display_name,lastSeen:p.last_seen}))});}
  if(body.action==="list_profiles"){const actor=await adminActor();if(actor==="password_required")return json({error:"Add a password to your admin profile before managing staff accounts."},403);if(!actor)return json({error:"Admin authorization required"},403);const {data,error}=await admin.from("karaoke_profiles").select("id,username,display_name,password_hash,is_admin,last_seen").order("display_name");if(error)throw error;return json({profiles:data.map((profile:any)=>({...shape(profile),hasPassword:!!profile.password_hash}))});}
  if(body.action==="set_admin"){const actor=await adminActor();if(actor==="password_required")return json({error:"Add a password to your admin profile before managing staff accounts."},403);if(!actor)return json({error:"Admin authorization required"},403);const id=String(body.profileId||"");const {data,error}=await admin.from("karaoke_profiles").update({is_admin:!!body.isAdmin}).eq("id",id).select("id,username,display_name,is_admin,last_seen").single();if(error)throw error;return json({profile:shape(data)});}
  if(body.action==="reset_password"||body.action==="clear_password"){
   const actor=await adminActor();
   if(actor==="password_required")return json({error:"Add a password to your admin profile before resetting account passwords."},403);
   if(!actor)return json({error:"Admin authorization required"},403);
   const id=String(body.profileId||""),next=body.action==="clear_password"?null:(body.newPasswordHash?String(body.newPasswordHash):null);
   if(next&&!/^[0-9a-f]{64}$/i.test(next))return json({error:"Invalid password reset"},400);
   if(id===actor.id&&!next)return json({error:"Your administrator account must keep a password."},400);
   const {data,error}=await admin.from("karaoke_profiles").update({password_hash:next,last_seen:new Date().toISOString()}).eq("id",id).select("id,username,display_name,password_hash,is_admin,last_seen").maybeSingle();
   if(error)throw error;if(!data)return json({error:"Account not found"},404);
   return json({status:"ok",profile:{...shape(data),hasPassword:!!data.password_hash}});
  }
  if(body.action==="set_password"){const id=String(body.profileId||""),{data:profile,error}=await admin.from("karaoke_profiles").select("id,password_hash").eq("id",id).maybeSingle();if(error)throw error;if(!profile)return json({error:"Account not found"},404);if(profile.password_hash&&body.currentPasswordHash!==profile.password_hash)return json({error:"Current password does not match"},401);const next=body.newPasswordHash?String(body.newPasswordHash):null;const {error:updateError}=await admin.from("karaoke_profiles").update({password_hash:next,last_seen:new Date().toISOString()}).eq("id",id);if(updateError)throw updateError;return json({status:"ok",protected:!!next});}
  if(body.action==="update_display_name"){const id=String(body.profileId||""),displayName=String(body.displayName||"").trim();if(!displayName||displayName.length>40)return json({error:"Enter a display name up to 40 characters"},400);const {data:profile,error}=await admin.from("karaoke_profiles").select("id,password_hash").eq("id",id).maybeSingle();if(error)throw error;if(!profile)return json({error:"Account not found"},404);if(profile.password_hash&&body.passwordHash!==profile.password_hash)return json({error:"Current password does not match"},401);const {data:updated,error:updateError}=await admin.from("karaoke_profiles").update({display_name:displayName,last_seen:new Date().toISOString()}).eq("id",id).select("id,username,display_name,is_admin,last_seen").single();if(updateError)throw updateError;return json({status:"ok",profile:shape(updated)});}
  if(body.action==="lookup_profile"){
   const username=String(body.username||body.input||"").trim();
   if(!username||username.length>40)return json({error:"Enter a BCDKC ID up to 40 characters"},400);
   const {data,error}=await admin.from("karaoke_profiles").select("id,username,display_name,password_hash,is_admin,last_seen").ilike("username",ilikeLiteral(username)).limit(20);
   if(error)throw error;
   const profile=data?.find((item:any)=>item.username.toLocaleLowerCase()===username.toLocaleLowerCase());
   return json(profile?{found:true,requiresPassword:!!profile.password_hash,profile:shape(profile)}:{found:false});
  }
  if(body.action==="create_profile"){
   const username=String(body.username||"").trim(),displayName=String(body.displayName||username).trim(),passwordHash=body.passwordHash;
   if(!username||username.length>40)return json({error:"Choose a BCDKC ID up to 40 characters"},400);
   if(!displayName||displayName.length>40)return json({error:"Enter a display name up to 40 characters"},400);
   if(passwordHash!==null&&passwordHash!==undefined&&passwordHash!==""&&!validHash(passwordHash))return json({error:"That password could not be saved"},400);
   const usernameTaken=async(candidate:string)=>{const {data,error}=await admin.from("karaoke_profiles").select("username").ilike("username",ilikeLiteral(candidate)).limit(20);if(error)throw error;return !!data?.some((item:any)=>item.username.toLocaleLowerCase()===candidate.toLocaleLowerCase());};
   if(await usernameTaken(username)){
    const base=cleanBase(username).slice(0,37),suggestions:string[]=[];
    for(let number=2;number<100&&suggestions.length<3;number++){const candidate=`${base}${number}`.slice(0,40);if(!(await usernameTaken(candidate)))suggestions.push(candidate);}
    return json({error:"That BCDKC ID is already taken",code:"username_taken",suggestions},409);
   }
   const {data,error}=await admin.from("karaoke_profiles").insert({id:crypto.randomUUID(),username,display_name:displayName,password_hash:validHash(passwordHash)?String(passwordHash):null,is_admin:false,last_seen:new Date().toISOString()}).select("id,username,display_name,is_admin,last_seen").single();
   if(error?.code==="23505")return json({error:"That BCDKC ID is already taken",code:"username_taken",suggestions:[]},409);
   if(error)throw error;
   return json({status:"created",profile:shape(data)});
  }
  const entered=String(body.input||"").trim();if(!entered||entered.length>40)return json({error:"Enter an account name"},400);
  const {data:matches,error:lookupError}=await admin.from("karaoke_profiles").select("id,username,display_name,password_hash,is_admin,last_seen").ilike("username",ilikeLiteral(entered)).limit(20);if(lookupError)throw lookupError;
  const existing=matches?.find((profile:any)=>profile.username.toLocaleLowerCase()===entered.toLocaleLowerCase());if(existing){if(existing.password_hash&&!body.passwordHash)return json({status:"password_required",profile:shape(existing)});if(existing.password_hash&&body.passwordHash!==existing.password_hash)return json({error:"That password does not match"},401);const {data:updated,error:updateError}=await admin.from("karaoke_profiles").update({last_seen:new Date().toISOString()}).eq("id",existing.id).select("id,username,display_name,password_hash,is_admin,last_seen").single();if(updateError)throw updateError;return json({status:"ok",profile:shape(updated)});}
  const base=cleanBase(entered);for(let number=1;number<1000;number++){const username=`${base}_${String(number).padStart(2,"0")}`,id=crypto.randomUUID();const {data,error}=await admin.from("karaoke_profiles").insert({id,username,display_name:entered,is_admin:false,last_seen:new Date().toISOString()}).select("id,username,display_name,is_admin,last_seen").single();if(!error)return json({status:"created",profile:shape(data)});if(error.code!=="23505")throw error;}return json({error:"Could not create a unique account name"},409);
 }catch(error){console.error(error);return json({error:"Profile service unavailable"},500);}
});
