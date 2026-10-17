const DAYS = 30;
const GROUPS = ["Foundation", "Contender", "Advanced Practice"];
const json = (v, s=200, h={}) => new Response(JSON.stringify(v), {status:s, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...h}});
const enc = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const token = (n=24) => enc(crypto.getRandomValues(new Uint8Array(n)));
const hash = async s => enc(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
const clean = (s,n) => typeof s==="string" ? s.trim().slice(0,n) : "";
const readCookie = r => ((r.headers.get("Cookie")||"").match(/(?:^|;\s*)cl_session=([^;]*)/)||[])[1]||"";
const cookie = (v,age) => "cl_session="+v+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+age;
async function limited(req,env,route,max) {
 const ip=req.headers.get("CF-Connecting-IP")||"unknown";
 const key=await hash(ip+":"+env.AUTH_PEPPER+":"+route+":"+new Date().toISOString().slice(0,10));
 const row=await env.DB.prepare("SELECT hits FROM rate_limits WHERE rate_key=?").bind(key).first();
 if((row?.hits||0)>=max)return false;
 await env.DB.prepare("INSERT INTO rate_limits(rate_key,hits,day) VALUES(?,1,date('now')) ON CONFLICT(rate_key) DO UPDATE SET hits=hits+1").bind(key).run();
 return true;
}
async function userFor(req,env) {
 const raw=readCookie(req); if(!raw)return null;
 return await env.DB.prepare("SELECT u.id,u.cl_id,u.name,u.grade FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>datetime('now')")
 .bind(await hash(raw)).first();
}
export default {async fetch(req,env) {
 const url=new URL(req.url);
 if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(req);
 if(!env.AUTH_PEPPER)return json({error:"Service configuration is incomplete."},503);
 const origin=req.headers.get("Origin");
 if(origin&&origin!==url.origin)return json({error:"Request not allowed."},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204});
 try {
  if(url.pathname==="/api/account"&&req.method==="POST"){
   if(!await limited(req,env,"create",10))return json({error:"Please try again tomorrow."},429);
   const b=await req.json(),name=clean(b.name,60),grade=clean(b.grade,40);
   if(!name||!grade)return json({error:"Enter your name and class or grade."},400);
   const id=crypto.randomUUID(),clId="CL-"+token(8).replace(/[-_]/g,"").slice(0,10).toUpperCase();
   const accessCode=token(16),recoveryCode=token(16);
   await env.DB.prepare("INSERT INTO users(id,cl_id,name,grade,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?,datetime('now'))").bind(id,clId,name,grade,await hash(accessCode),await hash(recoveryCode)).run();
   const session=token(32);
   await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now',?))").bind(await hash(session),id,"+"+DAYS+" days").run();
   return json({ok:true,clId,accessCode,recoveryCode,user:{name,grade},notice:"Save your CL ID, access code, and recovery code privately. They are shown only once."},201,{"Set-Cookie":cookie(session,DAYS*86400)});
  }
  if(url.pathname==="/api/login"&&req.method==="POST"){
   if(!await limited(req,env,"login",30))return json({error:"Too many attempts. Try again tomorrow."},429);
   await env.DB.prepare("DELETE FROM sessions WHERE expires_at<=datetime('now')").run();
   const b=await req.json(),clId=clean(b.clId,24).toUpperCase(),code=clean(b.accessCode,100);
   const u=await env.DB.prepare("SELECT id,password_hash FROM users WHERE cl_id=?").bind(clId).first();
   if(!u||await hash(code)!==u.password_hash)return json({error:"CL ID or access code is incorrect."},401);
   const s=token(32); await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now',?))").bind(await hash(s),u.id,"+"+DAYS+" days").run();
   return json({ok:true},200,{"Set-Cookie":cookie(s,DAYS*86400)});
  }
  if(url.pathname==="/api/recover"&&req.method==="POST"){
   if(!await limited(req,env,"recover",20))return json({error:"Too many attempts. Try again tomorrow."},429);
   const b=await req.json(),clId=clean(b.clId,24).toUpperCase(),code=clean(b.recoveryCode,100);
   const u=await env.DB.prepare("SELECT id,recovery_hash FROM users WHERE cl_id=?").bind(clId).first();
   if(!u||!u.recovery_hash||await hash(code)!==u.recovery_hash)return json({error:"CL ID or recovery code is incorrect."},401);
   const accessCode=token(16);
   await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(u.id).run();
   await env.DB.prepare("UPDATE users SET password_hash=?,recovery_hash=NULL WHERE id=?").bind(await hash(accessCode),u.id).run();
   return json({ok:true,accessCode,notice:"Save the new access code. Your recovery code has been used."});
  }
  if(url.pathname==="/api/logout"&&req.method==="POST"){
   const s=readCookie(req);if(s)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await hash(s)).run();
   return json({ok:true},200,{"Set-Cookie":cookie("",0)});
  }
  if(url.pathname==="/api/me"&&req.method==="GET"){
   const u=await userFor(req,env);if(!u)return json({error:"Sign in to view saved progress."},401);
   const a=await env.DB.prepare("SELECT score,total,practice_group,created_at FROM attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(u.id).all();
   return json({user:{clId:u.cl_id,name:u.name,grade:u.grade},attempts:a.results||[]});
  }
  if(url.pathname==="/api/attempt"&&req.method==="POST"){
   const u=await userFor(req,env);if(!u)return json({error:"Sign in before submitting a challenge."},401);
   const answers=(await req.json()).answers,keys=JSON.parse(env.ANSWER_KEY_JSON||"[]");
   if(!Array.isArray(answers)||!Array.isArray(keys)||keys.length!==5||answers.length!==5||answers.some((x,i)=>!Number.isInteger(x)||x<0||x>3||!Number.isInteger(keys[i])||keys[i]<0||keys[i]>3))return json({error:"Challenge answers are incomplete or invalid."},400);
   const score=answers.reduce((sum,x,i)=>sum+(x===keys[i]?1:0),0),group=score<=2?GROUPS[0]:score<=4?GROUPS[1]:GROUPS[2];
   await env.DB.prepare("INSERT INTO attempts(id,user_id,score,total,practice_group,created_at) VALUES(?,?,?,?,?,datetime('now'))").bind(crypto.randomUUID(),u.id,score,5,group).run();
   return json({score,total:5,passed:score>=3,practiceGroup:group,official:false});
  }
  return json({error:"Not found."},404);
 }catch(e){return json({error:"The service could not complete that request. Please try again."},500);}
}};
