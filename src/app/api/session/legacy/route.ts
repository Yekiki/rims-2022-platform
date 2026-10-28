import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {query,setSessionCookie,fail,HttpError,noStore} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
const spec=z.object({accessToken:z.string().min(20).max(10000)});
/** Optional bridge: validates a still-active old Supabase session once, then issues a MySQL-app cookie. It never sends email. */
export async function POST(req:NextRequest){try{
 const {accessToken}=spec.parse(await req.json());const url=(process.env.LEGACY_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.LEGACY_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new HttpError('انتقال نشست‌های قدیمی فعال نیست.',410);
 const verified=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${accessToken}`},cache:'no-store'});
 if(!verified.ok)throw new HttpError('نشست قدیمی منقضی شده است؛ با مدیر سامانه تماس بگیرید.',401);
 const oldUser=await verified.json() as {id?:string};if(!oldUser.id||!/^[0-9a-f-]{36}$/i.test(oldUser.id))throw new HttpError('نشست قدیمی معتبر نیست.',401);
 const rows=await query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1',[oldUser.id]);if(!rows.length)throw new HttpError('حساب قبلی در انتقال پایگاه داده پیدا نشد.',401);
 const res=NextResponse.json({ok:true},{headers:noStore});setSessionCookie(res,oldUser.id);return res;
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'نشست قدیمی معتبر نیست.'},{status:400});return fail(e);}}
