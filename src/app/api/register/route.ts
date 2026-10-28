import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {actor,fail,HttpError,shaCode,audit,transaction,txQuery,txExecute} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
const spec=z.object({code:z.string().min(16).max(200),name:z.string().trim().min(3).max(120),job:z.string().trim().min(2).max(120),specialization:z.string().trim().min(1).max(160),experience:z.number().min(0).max(80),riskExperience:z.number().min(0).max(80),familiarity:z.enum(['کم','متوسط','زیاد']),consent:z.literal(true)});
export async function POST(req:NextRequest){try{
 const {user,profile}=await actor(req);if(profile)throw new HttpError('اطلاعات شما قبلاً ثبت شده است.',409);const body=spec.parse(await req.json());
 const orgId=await transaction(async conn=>{
  const inviteRows=await txQuery<RowDataPacket[]>(conn,'SELECT id,organization_id,expires_at,used_by FROM invites WHERE code_hash=? FOR UPDATE',[shaCode(body.code)]);const invite=inviteRows[0];
  if(!invite||invite.used_by||new Date(invite.expires_at)<=new Date())throw new HttpError('کد دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.',400);
  await txExecute(conn,'INSERT INTO profiles (id,organization_id,role,full_name,job_title,specialization,experience_years,risk_experience_years,erm_familiarity,consent_at,consent_version) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3),\'1.0\')',[user.id,invite.organization_id,'respondent',body.name,body.job,body.specialization,body.experience,body.riskExperience,body.familiarity]);
  await txExecute(conn,'UPDATE invites SET used_by=?,used_at=CURRENT_TIMESTAMP(3) WHERE id=?',[user.id,invite.id]);return String(invite.organization_id);
 });
 await audit(null,user.id,'respondent_registration',user.id,{organization_id:orgId});return NextResponse.json({ok:true});
}catch(e){if(e instanceof z.ZodError)return NextResponse.json({error:'لطفاً اطلاعات ثبت‌نام را کامل و صحیح وارد کنید.'},{status:400});return fail(e);}}
