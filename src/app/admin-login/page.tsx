'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {getJson,postJson,tryLegacySession} from '@/lib/browser';
type Identity={profile:{role:'admin'|'respondent'}|null};
export default function AdminLogin(){
 const router=useRouter();const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let live=true;(async()=>{try{await tryLegacySession();const me=await getJson<Identity>('/api/me');if(live&&me.profile?.role==='admin')router.replace('/admin')}catch{}})();return()=>{live=false};},[router]);
 async function login(event:React.FormEvent){event.preventDefault();setPending(true);setError('');try{await postJson('/api/auth/login',{username,password});router.replace('/admin');}catch(err){setError(err instanceof Error?err.message:'ورود انجام نشد.')}finally{setPending(false)}}
 return <div className="container section max-w-2xl"><div className="card"><span className="badge mb-5">ویژه پژوهشگر</span><h1 className="h2 mb-3">ورود مدیر سامانه</h1><p className="muted mb-6">با نام کاربری و رمز عبور وارد شوید. برای ورود به سامانه هیچ ایمیلی ارسال نمی‌شود.</p>
  <form onSubmit={login}><label className="label" htmlFor="admin-username">نام کاربری</label><input className="input" type="text" id="admin-username" required dir="ltr" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="username"/>
  <label className="label mt-4" htmlFor="admin-password">رمز عبور</label><input className="input" type="password" id="admin-password" required dir="ltr" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
  <button className="btn btn-primary w-full mt-5" disabled={pending}>{pending?'در حال ورود...':'ورود به پنل پژوهشگر'}</button></form>
  {error&&<p className="alert alert-error mt-4" role="alert">{error}</p>}
  <p className="muted mt-5 text-sm"><Link href="/login" className="underline">شروع پرسش‌نامه بدون ایمیل</Link></p>
 </div></div>;
}
