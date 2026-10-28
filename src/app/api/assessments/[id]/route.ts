import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,noStore,query} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
export async function GET(req:NextRequest,{params}:{params:{id:string}}){try{
 const {user,profile}=await requireProfile(req);const records=await query<RowDataPacket[]>('SELECT * FROM assessments WHERE id=? LIMIT 1',[params.id]);const a=records[0];
 if(!a)throw new HttpError('ارزیابی پیدا نشد.',404);if(a.respondent_id!==user.id&&profile.role!=='admin')throw new HttpError('دسترسی غیرمجاز.',403);
 const [answers,dimensions,results]=await Promise.all([
  query<RowDataPacket[]>('SELECT question_id,selected_index,updated_at FROM answers WHERE assessment_id=?',[params.id]),
  query<RowDataPacket[]>('SELECT dimension_key,average_score,weighted_score,item_count FROM dimension_scores WHERE assessment_id=?',[params.id]),
  query<RowDataPacket[]>('SELECT total_score,tier,scoring_rules_id,algorithm_version,calculated_at FROM maturity_results WHERE assessment_id=? LIMIT 1',[params.id])
 ]);
 return NextResponse.json({assessment:a,answers,dimensions,result:results[0]??null},{headers:noStore});
}catch(e){return fail(e);}}
