import {NextRequest,NextResponse} from 'next/server';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireAdmin,fail,HttpError,shaCode,audit,query,execute} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
const spec=z.object({organizationId:z.string().uuid(),days:z.number().int().min(1).max(90).default(14)});
export async function POST(req:NextRequest){try{
 const {user}=await requireAdmin(req);const b=spec.parse(await req.json());const orgRows=await query<RowDataPacket[]>('SELECT id,name FROM organizations WHERE id=? LIMIT 1',[b.organizationId]);const org=orgRows[0];if(!org)throw new HttpError('سازمان پیدا نشد.',404);
 const inviteCode=randomBytes(18).toString('base64url');const expires=new Date(Date.now()+b.days*86400000);const id=randomUUID();
 await execute('INSERT INTO invites (id,code_hash,organization_id,created_by,expires_at) VALUES (?,?,?,?,?)',[id,shaCode(inviteCode),b.organizationId,user.id,expires]);
 await audit(null,user.id,'invite_created',id,{organization_id:org.id,expires_at:expires.toISOString()});
 return NextResponse.json({code:inviteCode,organization:org.name,expiresAt:expires.toISOString()},{status:201,headers:{'Cache-Control':'no-store'}});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'اطلاعات کد دعوت نامعتبر است.'},{status:400});return fail(e);}}
