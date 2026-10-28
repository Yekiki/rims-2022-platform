import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireAdmin,fail,audit,execute} from '@/lib/server';
const spec=z.object({name:z.string().trim().min(2).max(180),activityType:z.string().trim().min(2).max(100),sector:z.string().trim().min(2).max(160),size:z.string().max(80).optional(),yearsActive:z.number().int().min(0).max(200).nullable().optional()});
export async function POST(req:NextRequest){try{
 const {user}=await requireAdmin(req);const b=spec.parse(await req.json());const id=randomUUID();
 await execute('INSERT INTO organizations (id,name,activity_type,construction_sector,size_label,years_active,created_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))',[id,b.name,b.activityType,b.sector,b.size??null,b.yearsActive??null]);
 await audit(null,user.id,'organization_created',id,{});return NextResponse.json({id,name:b.name},{status:201});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'مشخصات سازمان معتبر نیست.'},{status:400});return fail(e);}}
