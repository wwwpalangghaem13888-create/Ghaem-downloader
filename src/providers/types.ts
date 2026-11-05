export type ProviderId = "youtube"|"instagram"|"tiktok"|"x"|"facebook"|"pinterest"|"reddit"|"soundcloud"|"unknown";
export interface ProviderCapabilities {
 metadataInspection: boolean; directMediaDownload: boolean; transcoding: boolean; reason: string;
}
export interface MediaProvider { id: ProviderId; capabilities: ProviderCapabilities; classify(url: URL): boolean }
const unavailable = (reason: string): ProviderCapabilities => ({
 metadataInspection:false, directMediaDownload:false, transcoding:false, reason
});
export const providers: MediaProvider[] = [
 {id:"youtube",classify:u=>u.hostname==="youtube.com"||u.hostname.endsWith(".youtube.com")||u.hostname==="youtu.be",capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"instagram",classify:u=>u.hostname==="instagram.com"||u.hostname.endsWith(".instagram.com"),capabilities:unavailable("No approved free Workers-compatible provider API is configured.")},
 {id:"tiktok",classify:u=>u.hostname==="tiktok.com"||u.hostname.endsWith(".tiktok.com"),capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"x",classify:u=>u.hostname==="x.com"||u.hostname==="twitter.com",capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"facebook",classify:u=>u.hostname==="facebook.com"||u.hostname.endsWith(".facebook.com"),capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"pinterest",classify:u=>u.hostname==="pinterest.com"||u.hostname.endsWith(".pinterest.com"),capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"reddit",classify:u=>u.hostname==="reddit.com"||u.hostname.endsWith(".reddit.com"),capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")},
 {id:"soundcloud",classify:u=>u.hostname==="soundcloud.com"||u.hostname.endsWith(".soundcloud.com"),capabilities:unavailable("No verified Workers-native, free and terms-compliant adapter.")}
];
export function getProvider(url: URL): MediaProvider {
 return providers.find(p=>p.classify(url)) ?? {id:"unknown",classify:()=>true,capabilities:unavailable("Domain is not registered.")};
}