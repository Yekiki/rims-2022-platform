'use client';
export async function api(path:string,init:RequestInit={}){
 const headers=new Headers(init.headers);
 if(init.body && !(init.body instanceof FormData) && !headers.has('Content-Type'))headers.set('Content-Type','application/json');
 const response=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store'});
 if(!response.ok){let msg=`خطای ${response.status}`;try{msg=(await response.json()).error??msg;}catch{}throw new Error(msg);}
 return response;
}
export async function getJson<T=any>(path:string):Promise<T>{return (await api(path)).json();}
export async function postJson<T=any>(path:string,body:unknown):Promise<T>{return (await api(path,{method:'POST',body:JSON.stringify(body)})).json();}
/** Optional one-time handoff for users who still have an old Supabase session in this browser. */
export async function tryLegacySession():Promise<boolean>{
 if(typeof window==='undefined')return false;
 const url=process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 for(let i=0;i<localStorage.length;i++){
  const storageKey=localStorage.key(i);if(!storageKey||!storageKey.startsWith('sb-')||!storageKey.endsWith('-auth-token'))continue;
  let session:any;try{session=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{continue;}
  let accessToken=session?.access_token;
  if((!accessToken||Number(session?.expires_at||0)*1000<Date.now())&&session?.refresh_token&&url&&key){
   try{const refresh=await fetch(`${url.replace(/\/$/,'')}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token}),cache:'no-store'});if(refresh.ok){const updated=await refresh.json();accessToken=updated.access_token;if(accessToken){session={...session,...updated};localStorage.setItem(storageKey,JSON.stringify(session));}}}catch{}
  }
  if(!accessToken)continue;
  try{const result=await fetch('/api/session/legacy',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({accessToken})});if(result.ok){localStorage.removeItem(storageKey);return true;}}catch{}
 }
 return false;
}

export function clearLegacySession(){if(typeof window==='undefined')return;for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith('sb-')&&key.endsWith('-auth-token'))localStorage.removeItem(key);}}
