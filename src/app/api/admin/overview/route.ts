import {NextRequest,NextResponse} from 'next/server';
import {requireAdmin,fail,noStore,query} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
export async function GET(req:NextRequest){try{
 await requireAdmin(req);
 const [orgs,people,completed,draft,records,scores]=await Promise.all([
  query<RowDataPacket[]>("SELECT * FROM organizations WHERE name<>? ORDER BY created_at DESC LIMIT 300",['مدیریت پژوهش (سیستمی)']),
  query<RowDataPacket[]>("SELECT id,full_name,job_title,organization_id,experience_years,risk_experience_years,erm_familiarity,created_at FROM profiles WHERE role='respondent' LIMIT 1000"),
  query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM assessments WHERE status='submitted'"),
  query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM assessments WHERE status='draft'"),
  query<RowDataPacket[]>('SELECT id,organization_id,respondent_id,status,started_at,submitted_at FROM assessments ORDER BY started_at DESC LIMIT 500'),
  query<RowDataPacket[]>('SELECT assessment_id,total_score,tier,algorithm_version,calculated_at FROM maturity_results LIMIT 500')
 ]);
 const [orgCount,personCount]=await Promise.all([
  query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM organizations WHERE name<>?",['مدیریت پژوهش (سیستمی)']),
  query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM profiles WHERE role='respondent'")
 ]);
 return NextResponse.json({statistics:{organizations:Number(orgCount[0]?.total??0),respondents:Number(personCount[0]?.total??0),completed:Number(completed[0]?.total??0),draft:Number(draft[0]?.total??0)},organizations:orgs,respondents:people,assessments:records,scores},{headers:noStore});
}catch(e){return fail(e);}}
