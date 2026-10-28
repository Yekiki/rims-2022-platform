import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {query,verifyPassword,setSessionCookie,fail,HttpError,noStore} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
const spec=z.object({username:z.string().trim().min(1).max(100),password:z.string().min(1).max(200)});
export async function POST(req:NextRequest){try{
 const body=spec.parse(await req.json());
 const rows=await query<RowDataPacket[]>('SELECT u.id, u.password_hash FROM users u INNER JOIN profiles p ON p.id=u.id WHERE u.username=? AND p.role=\'admin\' LIMIT 1',[body.username]);
 const row=rows[0];if(!row?.password_hash||!(await verifyPassword(body.password,String(row.password_hash))))throw new HttpError('نام کاربری یا رمز عبور صحیح نیست.',401);
 const res=NextResponse.json({ok:true},{headers:noStore});setSessionCookie(res,String(row.id));return res;
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'نام کاربری و رمز عبور را وارد کنید.'},{status:400});return fail(e);}}
