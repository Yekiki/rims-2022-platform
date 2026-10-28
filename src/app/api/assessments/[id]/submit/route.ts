import {NextRequest,NextResponse} from 'next/server';
import {requireProfile,fail,HttpError,audit,transaction,txQuery,txExecute} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
function maturityLevel(score:number){if(score<1||score>5)return null;if(score<2)return 'سطح یک';if(score<3)return 'سطح دو';if(score<4)return 'سطح سه';if(score<4.5)return 'سطح چهار';return 'سطح پنج';}
export async function POST(req:NextRequest,{params}:{params:{id:string}}){try{
 const {user}=await requireProfile(req);
 const result=await transaction(async conn=>{
  const records=await txQuery<RowDataPacket[]>(conn,'SELECT * FROM assessments WHERE id=? FOR UPDATE',[params.id]);const assessment=records[0];
  if(!assessment||assessment.respondent_id!==user.id||assessment.status!=='draft')throw new HttpError('ارزیابی متعلق به شما نیست یا قبلاً ثبت نهایی شده است.',400);
  const answers=await txQuery<RowDataPacket[]>(conn,'SELECT a.question_id,a.selected_index,q.kind,q.dimension_key,q.questionnaire_version FROM answers a INNER JOIN questions q ON q.id=a.question_id WHERE a.assessment_id=?',[params.id]);
  if(answers.length!==42)throw new HttpError(`برای ثبت نهایی باید ۴۲ پاسخ وجود داشته باشد؛ تعداد فعلی ${answers.length} است.`,400);
  if(answers.filter(a=>a.kind==='attribute').length!==35)throw new HttpError('تمام ۳۵ شاخص اصلی باید پاسخ داده شوند.',400);
  if(answers.some(a=>a.questionnaire_version!==assessment.questionnaire_version))throw new HttpError('نسخه پرسش‌نامه با ارزیابی مطابقت ندارد.',400);
  const dimensions=await txQuery<RowDataPacket[]>(conn,'SELECT `key`,weight,item_count FROM dimensions ORDER BY position');let total=0;
  for(const dim of dimensions){
   const vals=answers.filter(a=>a.kind==='attribute'&&a.dimension_key===dim.key);if(vals.length!==Number(dim.item_count))throw new HttpError(`تعداد پاسخ‌های رکن ${dim.key} کامل نیست.`,400);
   const mean=vals.reduce((sum,a)=>sum+Number(a.selected_index)+1,0)/vals.length;const weighted=mean*Number(dim.weight);total+=weighted;
   await txExecute(conn,'INSERT INTO dimension_scores (assessment_id,dimension_key,average_score,weighted_score,item_count,algorithm_version,calculated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))',[params.id,dim.key,mean,weighted,vals.length,'rims-2022-weighted-v1']);
  }
  total=Number(total.toFixed(8));const tier=maturityLevel(total);
  await txExecute(conn,'INSERT INTO maturity_results (assessment_id,total_score,tier,scoring_rules_id,algorithm_version,calculated_at) VALUES (?,?,?,NULL,?,CURRENT_TIMESTAMP(3))',[params.id,total,tier,'rims-2022-weighted-v1-fixed-levels-v1']);
  await txExecute(conn,"UPDATE assessments SET status='submitted',submitted_at=CURRENT_TIMESTAMP(3) WHERE id=?",[params.id]);return {score:total,tier};
 });
 await audit(null,user.id,'assessment_submitted',params.id,{score:result.score});return NextResponse.json({ok:true,result});
}catch(e){return fail(e);}}
