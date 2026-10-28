import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,noStore,query,transaction,txQuery,txExecute} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
import {randomUUID} from 'node:crypto';
export async function GET(req:NextRequest){try{
 const {user}=await requireProfile(req);const data=await query<RowDataPacket[]>('SELECT id,status,started_at,submitted_at FROM assessments WHERE respondent_id=? ORDER BY started_at DESC LIMIT 100',[user.id]);
 return NextResponse.json({assessments:data},{headers:noStore});
}catch(e){return fail(e);}}
export async function POST(req:NextRequest){try{
 const {user,profile}=await requireProfile(req);if(profile.role!=='respondent')throw new HttpError('حساب مدیر نمی‌تواند پاسخ‌دهنده باشد.',403);
 const result=await transaction(async conn=>{
  await txQuery<RowDataPacket[]>(conn,'SELECT id FROM users WHERE id=? FOR UPDATE',[user.id]);
  const old=await txQuery<RowDataPacket[]>(conn,"SELECT id FROM assessments WHERE respondent_id=? AND status='draft' LIMIT 1 FOR UPDATE",[user.id]);if(old.length)return {id:String(old[0].id),existing:true};
  const id=randomUUID();await txExecute(conn,'INSERT INTO assessments (id,respondent_id,organization_id,questionnaire_version,status,started_at) VALUES (?,?,?,\'rims-2022-fa-v1\',\'draft\',CURRENT_TIMESTAMP(3))',[id,user.id,profile.organization_id]);return {id,existing:false};
 });
 return NextResponse.json(result,{status:result.existing?200:201});
}catch(e){return fail(e);}}
