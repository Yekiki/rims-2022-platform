import mysql from 'mysql2/promise';
import {readFileSync,existsSync} from 'node:fs';
for(const file of ['.env.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const {MYSQL_HOST,MYSQL_PORT,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE}=process.env;
if(!MYSQL_HOST||!MYSQL_USER||!MYSQL_DATABASE)throw Error('Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE in the environment.');
const db=await mysql.createConnection({host:MYSQL_HOST,port:Number(MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD||'',database:MYSQL_DATABASE,charset:'utf8mb4',timezone:'Z'});
try{
 const catalog=JSON.parse(readFileSync('src/data/questionnaire.json','utf8'));
 const dimensions=[
  {key:'strategy',title:'هم‌راستایی با راهبرد',position:1,weight:0.25,item_count:6},
  {key:'culture',title:'فرهنگ و پاسخ‌گویی',position:2,weight:0.30,item_count:7},
  {key:'capability',title:'قابلیت‌های مدیریت ریسک',position:3,weight:0.20,item_count:7},
  {key:'governance',title:'حاکمیت ریسک',position:4,weight:0.13,item_count:7},
  {key:'analytics',title:'تحلیل‌گری',position:5,weight:0.12,item_count:8}
 ];
 const questions=[],options=[];
 for(const [ci,c] of catalog.categories.entries())for(const q of c.questions){
  const dim=ci===0?null:dimensions[ci-1].key;const kind=q.type==='target'?'target':ci===0?'baseline':'attribute';
  questions.push({id:q.id,questionnaire_version:'rims-2022-fa-v1',position:questions.length+1,dimension_key:dim,kind,text:q.text,original_number:q.number??null});
  for(const [i,opt] of q.options.entries())options.push({question_id:q.id,option_index:i,label:opt.label,text:opt.text});
 }
 if(questions.length!==42||questions.filter(q=>q.kind==='attribute').length!==35||options.length!==210)throw Error('Questionnaire count mismatch');
 const [[{total:assessmentCount}]] = await db.query('SELECT COUNT(*) AS total FROM assessments');
 if(Number(assessmentCount)>0)throw Error('Assessments exist: do not replace the research catalog after data collection has started.');
 await db.beginTransaction();
 try{
  for(const d of dimensions)await db.execute('INSERT INTO dimensions (`key`,title,position,weight,item_count) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title),position=VALUES(position),weight=VALUES(weight),item_count=VALUES(item_count)',[d.key,d.title,d.position,d.weight,d.item_count]);
  for(const q of questions)await db.execute('INSERT INTO questions (id,questionnaire_version,position,dimension_key,kind,text,original_number) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE questionnaire_version=VALUES(questionnaire_version),position=VALUES(position),dimension_key=VALUES(dimension_key),kind=VALUES(kind),text=VALUES(text),original_number=VALUES(original_number)',[q.id,q.questionnaire_version,q.position,q.dimension_key,q.kind,q.text,q.original_number]);
  for(const o of options)await db.execute('INSERT INTO answer_options (question_id,option_index,label,text) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE label=VALUES(label),text=VALUES(text)',[o.question_id,o.option_index,o.label,o.text]);
  await db.commit();
 }catch(e){await db.rollback();throw e;}
 console.log(`Catalog ready: ${dimensions.length} dimensions, ${questions.length} questions, ${options.length} options; 35 scored attributes; weights sum to 1.`);
}finally{await db.end();}
