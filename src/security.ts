import type { Env } from "./types";
import { getProvider } from "./providers/types";
export function validateMediaUrl(raw: string, env: Env) {
 if(raw.length>2048) throw new Error("URL_TOO_LONG");
 let url: URL; try { url=new URL(raw); } catch { throw new Error("INVALID_URL"); }
 if(url.protocol!=="https:" && url.protocol!=="http:") throw new Error("UNSUPPORTED_SCHEME");
 if(url.username || url.password || (url.port && url.port!=="80" && url.port!=="443")) throw new Error("INVALID_URL_AUTH_OR_PORT");
 const host=url.hostname.toLowerCase().replace(/\.$/,"");
 if(!host || host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) throw new Error("HOST_NOT_ALLOWED");
 const allowed=env.ALLOWED_MEDIA_HOSTS.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowed.some(d=>host===d || host.endsWith("."+d))) throw new Error("HOST_NOT_ALLOWED");
 url.hash="";
 return {url,provider:getProvider(url)};
}