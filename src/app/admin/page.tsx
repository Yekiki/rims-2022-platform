'use client';
import {useCallback,useEffect,useState} from 'react';
import {api,getJson,postJson,clearLegacySession} from '@/lib/browser';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Download,
  FileText,
  ShieldCheck,
  Users,
  LogOut
} from 'lucide-react';

type Tab='overview'|'organizations'|'invites'|'results'|'export';
const tabs: [Tab, string][] = [
  ['overview', 'نمای کلی'],
  ['organizations', 'سازمان‌ها'],
  ['invites', 'کدهای دعوت'],
  ['results', 'ارزیابی‌ها'],
  ['export', 'دریافت Excel'],
];
export default function Admin(){const router=useRouter();const [tab,setTab]=useState<Tab>('overview'),[data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[msg,setMsg]=useState('');
 const [org,setOrg]=useState({name:'',activityType:'پیمانکار',sector:'ساختمان',size:'',yearsActive:''});
 const [inviteOrg,setInviteOrg]=useState(''),[inviteDays,setInviteDays]=useState(14),[generated,setGenerated]=useState('');
 const [exportOrg,setExportOrg]=useState(''),[identifiable,setIdentifiable]=useState(false);const [filterOrg,setFilterOrg]=useState(''),[filterStatus,setFilterStatus]=useState(''),[filterName,setFilterName]=useState('');
 const load = useCallback(async () => {
  try {
    const overview = await getJson('/api/admin/overview');
    setData(overview);
  } catch (e) {
    setErr(e instanceof Error ? e.message : String(e));
  }
}, []);
useEffect(() => {
  load();
}, [load]);
 async function run(action:()=>Promise<any>,success:string){setErr('');setMsg('');setBusy(true);try{await action();setMsg(success);await load();}catch(e){setErr(e instanceof Error?e.message:String(e));}finally{setBusy(false)}}
 function orgName(id:string){return data?.organizations?.find((o:any)=>o.id===id)?.name??'سازمان ثبت نشده';}
 function personName(id:string){return data?.respondents?.find((o:any)=>o.id===id)?.full_name??'پاسخ‌دهنده';}
 const stats=data?.statistics;
 async function exportXlsx(){setBusy(true);setErr('');try{const query=new URLSearchParams();if(exportOrg)query.set('organizationId',exportOrg);if(identifiable)query.set('identifiable','1');const res=await api('/api/admin/export?'+query.toString());const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`RIMS-research-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);setMsg('فایل Excel تولید و دریافت شد.');}catch(e){setErr(e instanceof Error?e.message:String(e));}finally{setBusy(false)}}
 
 if(!data&&!err)return <div className="container section"><div className="card">در حال بارگذاری پنل پژوهشگر...</div></div>;
 return <div className="container section"><div className="flex justify-between flex-wrap gap-2 items-center mb-5"><div><span className="badge mb-2">دسترسی ویژه پژوهشگر</span><h1 className="h2">پنل مدیریت پژوهش</h1></div><div className="flex gap-2"><button className="btn" onClick={()=>router.push('/assessment')}>بازگشت به سامانه</button><button className="btn" onClick={async()=>{try{await api('/api/auth/logout',{method:'POST'})}finally{clearLegacySession();router.push('/admin-login')}}}><LogOut size={16}/> خروج</button></div></div>
 {err&&<div className="alert alert-error mb-5" role="alert">{err}</div>}{msg&&<div className="alert alert-ok mb-5">{msg}</div>}
 {!data?<div className="card">دسترسی ممکن نیست. برای دسترسی مدیر، حساب خود را طبق راهنما به نقش پژوهشگر ارتقا دهید.</div>:<>
 <div className="flex flex-wrap gap-2 mb-6">{tabs.map(([key,label])=><button key={key} onClick={()=>{setTab(key);setErr('');setMsg('')}} className={`tab ${tab===key?'active':''}`}>{label}</button>)}</div>
 {tab==='overview'&&<><div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[
 [<Building2 key="o"/>,stats.organizations,'سازمان‌ها'],[<Users key="u"/>,stats.respondents,'پاسخ‌دهندگان'],[<ShieldCheck key="s"/>,stats.completed,'تکمیل‌شده'],[<FileText key="f"/>,stats.draft,'ناقص']
 ].map(([icon,count,label],i)=><div className="card" key={i}><div className="text-[#317461] mb-2">{icon}</div><strong className="text-4xl block">{count as number}</strong><span className="text-xs muted">{label as string}</span></div>)}</div><div className="card"><h2 className="h3 mb-4">گزارش خلاصه</h2><p className="muted text-sm">نرخ تکمیل پرسش‌نامه: {stats.completed+stats.draft?((stats.completed/(stats.completed+stats.draft))*100).toFixed(1):'۰'}٪</p><p className="muted text-sm mt-2">میانگین امتیاز ارزیابی‌های تکمیل‌شده (در داده‌های بارگذاری‌شده): {data.scores.length?(data.scores.reduce((a:number,b:any)=>a+Number(b.total_score),0)/data.scores.length).toFixed(2):'—'}</p><p className="text-xs muted mt-3">فهرست پنل برای نمایش سریع تا ۵۰۰ ارزیابی محدود است؛ فایل Excel خروجی کامل داده‌ها را ارائه می‌کند. میانگین کل را برای گزارش علمی از خروجی کامل محاسبه کنید.</p></div></>}
 {tab==='organizations'&&<div className="grid lg:grid-cols-[380px_1fr] gap-5"><form className="card" onSubmit={e=>{e.preventDefault();run(()=>postJson('/api/admin/organizations',{name:org.name,activityType:org.activityType,sector:org.sector,size:org.size,yearsActive:org.yearsActive?Number(org.yearsActive):null}),'سازمان ثبت شد.');}}><h2 className="h3 mb-4">افزودن سازمان جدید</h2>{([['name','نام سازمان'],['sector','حوزه اصلی فعالیت'],['size','اندازه سازمان (اختیاری)']] as const).map(([k,title])=><label className="block mb-3" key={k}><span className="label">{title}</span><input className="input" required={k!=='size'} value={org[k]} onChange={e=>setOrg(v=>({...v,[k]:e.target.value}))}/></label>)}<label className="block mb-3"><span className="label">نوع فعالیت</span><select className="select" value={org.activityType} onChange={e=>setOrg(v=>({...v,activityType:e.target.value}))}>{['پیمانکار','مشاور','کارفرما','توسعه‌دهنده','مدیریت طرح','سایر'].map(x=><option key={x}>{x}</option>)}</select></label><label className="block mb-4"><span className="label">سابقه فعالیت (سال، اختیاری)</span><input className="input" type="number" min={0} max={200} value={org.yearsActive} onChange={e=>setOrg(v=>({...v,yearsActive:e.target.value}))}/></label><button className="btn btn-primary w-full" disabled={busy}>ثبت سازمان</button></form><div className="card"><h2 className="h3 mb-4">سازمان‌های ثبت‌شده</h2><div className="table-box"><table className="rims-table"><thead><tr><th>سازمان</th><th>نوع فعالیت</th><th>حوزه</th></tr></thead><tbody>{data.organizations.map((o:any)=><tr key={o.id}><td>{o.name}<br/><small className="muted">{o.id.slice(0,8)}</small></td><td>{o.activity_type}</td><td>{o.construction_sector}</td></tr>)}</tbody></table></div></div></div>}
 {tab==='invites'&&<div className="grid lg:grid-cols-[450px_1fr] gap-5"><div className="card"><h2 className="h3 mb-4">صدور کد دعوت یک‌بارمصرف</h2><label className="label">سازمان مقصد</label><select className="select mb-4" value={inviteOrg} onChange={e=>setInviteOrg(e.target.value)}><option value="">انتخاب سازمان</option>{data.organizations.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select><label className="label">اعتبار کد (روز)</label><input type="number" className="input mb-4" min={1} max={90} value={inviteDays} onChange={e=>setInviteDays(Number(e.target.value))}/><button className="btn btn-primary w-full" disabled={busy||!inviteOrg} onClick={()=>run(async()=>{const r=await postJson('/api/admin/invites',{organizationId:inviteOrg,days:inviteDays});setGenerated(r.code)},'کد دعوت ایجاد شد. آن را اکنون در جای امن کپی کنید.')}>تولید کد دعوت</button>{generated&&<div className="alert mt-4"><p className="font-bold mb-2">کد فقط همین بار نمایش داده می‌شود:</p><code dir="ltr" className="block break-all bg-white rounded p-2 select-all">{generated}</code><button className="btn btn-sm mt-2" onClick={()=>navigator.clipboard.writeText(generated)}>کپی کد</button></div>}</div><div className="card"><h2 className="h3 mb-3">راهنمای دعوت</h2><p className="muted text-sm">ابتدا سازمان را ثبت کنید. برای هر مدیر یا کارشناس یک کد متفاوت بسازید. شخص بدون ایمیل و با هویت ناشناس موقت وارد می‌شود، کد را در فرم ثبت‌نام وارد می‌کند و به همان سازمان متصل خواهد شد.</p><p className="alert mt-5">کد دعوت از نظر امنیتی فقط یک بار قابل مصرف است؛ کد خام در پایگاه داده ذخیره نمی‌شود.</p></div></div>}
 {tab==='results'&&<div className="card"><h2 className="h3 mb-4">فهرست پاسخ‌نامه‌ها (۵۰۰ مورد اخیر)</h2><div className="grid sm:grid-cols-3 gap-3 mb-4"><input className="input" placeholder="جستجوی نام پاسخ‌دهنده" value={filterName} onChange={e=>setFilterName(e.target.value)}/><select className="select" value={filterOrg} onChange={e=>setFilterOrg(e.target.value)}><option value="">همه سازمان‌ها</option>{data.organizations.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select><select className="select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">همه وضعیت‌ها</option><option value="draft">ناقص</option><option value="submitted">تکمیل‌شده</option></select></div><div className="table-box"><table className="rims-table"><thead><tr><th>پاسخ‌دهنده</th><th>سازمان</th><th>وضعیت</th><th>تاریخ</th><th>امتیاز</th><th>جزئیات</th></tr></thead><tbody>{data.assessments.filter((a:any)=>(!filterOrg||a.organization_id===filterOrg)&&(!filterStatus||a.status===filterStatus)&&(!filterName||personName(a.respondent_id).includes(filterName))).map((a:any)=>{const score=data.scores.find((s:any)=>s.assessment_id===a.id);return <tr key={a.id}><td>{personName(a.respondent_id)}</td><td>{orgName(a.organization_id)}</td><td>{a.status==='submitted'?'تکمیل‌شده':'ناقص'}</td><td>{new Date(a.started_at).toLocaleDateString('fa-IR')}</td><td>{score?Number(score.total_score).toFixed(2):'—'}</td><td><Link className="btn btn-sm" href={`/results/${a.id}`}>مشاهده پاسخ‌ها</Link></td></tr>})}</tbody></table></div><p className="text-xs muted mt-4">برای تحلیل کامل، از خروجی Excel استفاده کنید. اطلاعات فردی به‌طور خودکار به بلوغ سازمان تبدیل نمی‌شوند.</p></div>}
 {tab==='export'&&<div className="card max-w-2xl"><h2 className="h3 mb-2"><Download className="inline ml-1" size={20}/> دریافت فایل پژوهشی Excel</h2><p className="text-sm muted mb-5">فایل حاوی ۹ کاربرگ شامل داده‌های خام، امتیازها، جداول سازمانی و داده‌های آماده SPSS است.</p><label className="label">محدوده سازمان</label><select className="select mb-5" value={exportOrg} onChange={e=>setExportOrg(e.target.value)}><option value="">تمام سازمان‌ها</option>{data.organizations.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}</select><label className="flex gap-3 items-start mb-6"><input type="checkbox" checked={identifiable} onChange={e=>setIdentifiable(e.target.checked)} className="mt-2"/><span>خروجی شامل نام افراد و سازمان‌ها باشد (صرفاً با مجوز و برای نیاز پژوهشی ضروری؛ حالت پیش‌فرض بدون نام است).</span></label><button className="btn btn-primary" disabled={busy} onClick={exportXlsx}><Download size={17}/>{busy?'در حال تولید Excel...':'دریافت داده‌های پژوهش در قالب Excel'}</button></div>}
  </>}</div>;
}
