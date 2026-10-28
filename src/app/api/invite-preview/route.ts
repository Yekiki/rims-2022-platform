import {NextRequest,NextResponse} from 'next/server';
import {actor,fail,HttpError,shaCode,query} from '@/lib/server';
import {z} from 'zod';
import {RowDataPacket} from 'mysql2/promise';
export async function POST(req:NextRequest){try{
 const {profile}=await actor(req);if(profile)throw new HttpError('حساب قبلاً ثبت شده است.',409);const b=z.object({code:z.string().min(16).max(200)}).parse(await req.json());
 const rows=await query<RowDataPacket[]>('SELECT i.organization_id,i.expires_at,i.used_by,o.name,o.activity_type,o.construction_sector FROM invites i INNER JOIN organizations o ON o.id=i.organization_id WHERE i.code_hash=? LIMIT 1',[shaCode(b.code)]);const invite=rows[0];
 if(!invite||invite.used_by||new Date(invite.expires_at)<=new Date())throw new HttpError('کد دعوت یافت نشد یا معتبر نیست.',404);
 return NextResponse.json({organization:{name:invite.name,activity_type:invite.activity_type,construction_sector:invite.construction_sector}},{headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'کد دعوت نامعتبر است.'},{status:400});return fail(e);}}
