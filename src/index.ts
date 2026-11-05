import type { Env, TaskMessage } from "./types";
import { handleTelegramUpdate, telegramSend } from "./telegram";
import { validateMediaUrl } from "./security";
import { createTask } from "./tasks";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
async function api(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url);
 if(url.pathname==="/health")return json({status:"ok",runtime:"cloudflare-workers",mediaProcessing:"unsupported"});
 if(url.pathname==="/telegram/webhook"&&request.method==="POST"){
  if(!env.TELEGRAM_WEBHOOK_SECRET||request.headers.get("x-telegram-bot-api-secret-token")!==env.TELEGRAM_WEBHOOK_SECRET)return json({error:"unauthorized"},401);
  await handleTelegramUpdate(await request.json(),env);return json({ok:true});
 }
 if(!env.ADMIN_API_TOKEN||request.headers.get("authorization")!=="Bearer "+env.ADMIN_API_TOKEN)return json({error:"unauthorized"},401);
 if(url.pathname==="/api/tasks"&&request.method==="GET"){const rows=await env.DB.prepare("SELECT t.id,t.source_url,t.provider,t.status,t.error_code,t.created_at,t.updated_at,t.expires_at FROM tasks t ORDER BY t.created_at DESC LIMIT 50").all();return json(rows.results);}
 if(url.pathname==="/api/tasks"&&request.method==="POST"){
  const body=await request.json() as {source_url?:string;telegram_user_id?:string;telegram_chat_id?:string};
  if(!body.source_url||!body.telegram_user_id||!body.telegram_chat_id)return json({error:"missing_fields"},400);
  try{validateMediaUrl(body.source_url,env);}catch{return json({error:"invalid_or_disallowed_url"},400);}
  await env.DB.prepare("INSERT OR IGNORE INTO users(id,telegram_user_id,telegram_chat_id) VALUES(?,?,?)").bind(crypto.randomUUID(),body.telegram_user_id,body.telegram_chat_id).run();
  const result=await createTask(env,body.telegram_user_id,body.source_url);return json(result,result.ok?202:429);
 }
 return json({error:"not_found"},404);
}
export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith("/api/")||path==="/telegram/webhook"||path==="/health"){try{return await api(request,env);}catch(e){console.error("request_failed",e instanceof Error?e.message:"unknown");return json({error:"request_failed"},500);}}
  return env.ASSETS.fetch(request);
 },
 async queue(batch:MessageBatch<TaskMessage>,env:Env):Promise<void>{
  for(const message of batch.messages){
   const task=await env.DB.prepare("SELECT t.id,t.provider,t.user_id,u.telegram_chat_id FROM tasks t JOIN users u ON u.id=t.user_id WHERE t.id=?").bind(message.body.taskId).first<{id:string;provider:string;user_id:string;telegram_chat_id:string}>();
   if(!task){message.ack();continue;}
   await env.DB.prepare("UPDATE tasks SET status='unsupported',error_code='NO_FREE_WORKER_MEDIA_ADAPTER',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND status='queued'").bind(task.id).run();
   try{await telegramSend(env,Number(task.telegram_chat_id),"سرویس "+task.provider+" در زیرساخت رایگان فعلی دانلود واقعی را پشتیبانی نمی‌کند. هیچ فایلی ساخته نشده است.");message.ack();}catch{message.retry({delaySeconds:60});}
  }
 },
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext):Promise<void>{ctx.waitUntil(env.DB.prepare("DELETE FROM tasks WHERE expires_at < ? AND result_key IS NULL").bind(new Date().toISOString()).run());}
};