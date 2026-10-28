/** One-time, explicit migration from Supabase Postgres/Auth to MySQL. */
import mysql from 'mysql2/promise';
import {readFileSync,existsSync} from 'node:fs';
import {randomBytes,scryptSync} from 'node:crypto';
for(const file of ['.env.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const {NEXT_PUBLIC_SUPABASE_URL:SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:SUPABASE_KEY,MYSQL_HOST,MYSQL_PORT,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE,ADMIN_USERNAME,ADMIN_PASSWORD,ADMIN_USER_ID}=process.env;
if(!SUPABASE_URL||!SUPABASE_KEY)throw Error('For this one-time migration, set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY temporarily.');
if(!MYSQL_HOST||!MYSQL_USER||!MYSQL_DATABASE)throw Error('Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE.');
const base=SUPABASE_URL.replace(/\/$/,'');
async function supabaseJson(path){const response=await fetch(`${base}${path}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});if(!response.ok)throw Error(`Supabase migration read failed (${response.status}) at ${path}: ${(await response.text()).slice(0,300)}`);return response.json();}
async function readTable(table){const rows=[];for(let offset=0;;offset+=1000){const response=await fetch(`${base}/rest/v1/${table}?select=*&order=${encodeURIComponent(table==='answers'?'assessment_id.asc,question_id.asc':table==='dimension_scores'?'assessment_id.asc,dimension_key.asc':table==='answer_options'?'question_id.asc,option_index.asc':table==='questions'?'position.asc':table==='dimensions'?'key.asc':table==='maturity_results'?'assessment_id.asc':'created_at.asc')}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Range-Unit':'items',Range:`${offset}-${offset+999}`}});if(!response.ok)throw Error(`Could not read Supabase table ${table} (${response.status}): ${(await response.text()).slice(0,300)}`);const chunk=await response.json();rows.push(...chunk);if(chunk.length<1000)break;if(offset>500000)throw Error(`Table ${table} exceeds the safe migration limit.`);}console.log(`Read ${table}: ${rows.length}`);return rows;}
function mysqlDate(value){if(value===null||value===undefined)return null;const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return value;return d.toISOString().slice(0,23).replace('T',' ');}
const dateFields=new Set(['created_at','updated_at','consent_at','expires_at','used_at','started_at','submitted_at','approved_at','calculated_at']);
function passwordHash(password){const salt=randomBytes(16);return `scrypt$${salt.toString('base64url')}$${scryptSync(password,salt,64).toString('base64url')}`;}
const db=await mysql.createConnection({host:MYSQL_HOST,port:Number(MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD||'',database:MYSQL_DATABASE,charset:'utf8mb4',timezone:'Z',multipleStatements:false});
const tables=['organizations','profiles','invites','dimensions','questions','answer_options','assessments','answers','scoring_rules','dimension_scores','maturity_results','audit_logs'];
const fields={
 organizations:['id','name','activity_type','construction_sector','size_label','years_active','created_at'],
 profiles:['id','organization_id','role','full_name','job_title','specialization','experience_years','risk_experience_years','erm_familiarity','consent_at','consent_version','created_at'],
 invites:['id','code_hash','organization_id','created_by','expires_at','used_by','used_at','created_at'],
 dimensions:['key','title','position','weight','item_count'],
 questions:['id','questionnaire_version','position','dimension_key','kind','text','original_number'],
 answer_options:['question_id','option_index','label','text'],
 assessments:['id','respondent_id','organization_id','questionnaire_version','status','started_at','submitted_at'],
 answers:['assessment_id','question_id','selected_index','question_text_snapshot','option_label_snapshot','option_text_snapshot','updated_at'],
 scoring_rules:['id','label','evidence_reference','evidence_kind','boundaries','is_active','approved_at','approved_by','created_at'],
 dimension_scores:['assessment_id','dimension_key','average_score','weighted_score','item_count','algorithm_version','calculated_at'],
 maturity_results:['assessment_id','total_score','tier','scoring_rules_id','algorithm_version','calculated_at'],
 audit_logs:['id','actor_id','action','entity_id','details','created_at']
};
try{
 const [[counts]]=await db.query('SELECT (SELECT COUNT(*) FROM users) AS users_count,(SELECT COUNT(*) FROM organizations) AS organizations_count,(SELECT COUNT(*) FROM profiles) AS profiles_count,(SELECT COUNT(*) FROM invites) AS invites_count,(SELECT COUNT(*) FROM dimensions) AS dimensions_count,(SELECT COUNT(*) FROM questions) AS questions_count,(SELECT COUNT(*) FROM answer_options) AS options_count,(SELECT COUNT(*) FROM assessments) AS assessments_count,(SELECT COUNT(*) FROM answers) AS answers_count,(SELECT COUNT(*) FROM scoring_rules) AS rules_count,(SELECT COUNT(*) FROM dimension_scores) AS dimension_scores_count,(SELECT COUNT(*) FROM maturity_results) AS maturity_results_count,(SELECT COUNT(*) FROM audit_logs) AS audit_logs_count');
 if(Object.values(counts).some(v=>Number(v)>0))throw Error('The target MySQL database is not empty. Use a new empty database; migration will not overwrite existing data.');
 const source={};for(const t of tables)source[t]=await readTable(t);
 const authUsers=[];for(let page=1;;page++){const data=await supabaseJson(`/auth/v1/admin/users?page=${page}&per_page=1000`);const chunk=Array.isArray(data)?data:data.users;if(!Array.isArray(chunk))throw Error('Unexpected response from Supabase Auth users endpoint.');authUsers.push(...chunk);if(chunk.length<1000)break;if(page>500)throw Error('Too many Supabase Auth users for this migration.');}
 console.log(`Read Supabase Auth users: ${authUsers.length}`);
 const adminIds=source.profiles.filter(p=>p.role==='admin').map(p=>p.id);let chosenAdminId=null;
 if(ADMIN_USERNAME||ADMIN_PASSWORD){if(!ADMIN_USERNAME||!ADMIN_PASSWORD)throw Error('Set both ADMIN_USERNAME and ADMIN_PASSWORD, or neither.');if(ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must be at least 12 characters.');chosenAdminId=ADMIN_USER_ID|| (adminIds.length===1?adminIds[0]:null);if(!chosenAdminId)throw Error('There are multiple or no admin profiles. Set ADMIN_USER_ID to the exact existing admin profile ID, or migrate without admin credentials and run npm run grant-admin afterwards.');if(!adminIds.includes(chosenAdminId))throw Error('ADMIN_USER_ID must identify an existing Supabase profile whose role is admin.');}
 const userMap=new Map();for(const u of authUsers)userMap.set(u.id,{id:u.id,username:null,password_hash:null,created_at:mysqlDate(u.created_at)});
 const ensureUser=id=>{if(id&&!userMap.has(id))userMap.set(id,{id,username:null,password_hash:null,created_at:mysqlDate(new Date().toISOString())});};
 for(const p of source.profiles)ensureUser(p.id);for(const i of source.invites){ensureUser(i.created_by);ensureUser(i.used_by);}for(const r of source.scoring_rules)ensureUser(r.approved_by);for(const r of source.audit_logs)ensureUser(r.actor_id);
 if(chosenAdminId){const u=userMap.get(chosenAdminId);u.username=ADMIN_USERNAME;u.password_hash=passwordHash(ADMIN_PASSWORD);}
 const normalize=(table,row)=>fields[table].map(field=>{
  let value=row[field]??null;if(dateFields.has(field))value=mysqlDate(value);if((field==='boundaries'||field==='details')&&value!==null&&typeof value!=='string')value=JSON.stringify(value);return value;
 });
 await db.beginTransaction();
 try{
  const userRows=[...userMap.values()];for(let offset=0;offset<userRows.length;offset+=200){const batch=userRows.slice(offset,offset+200);const cols=['id','username','password_hash','created_at'];const vals=batch.flatMap(r=>cols.map(c=>r[c]??null));const one='('+cols.map(()=>'?').join(',')+')';await db.execute(`INSERT INTO users (${cols.join(',')}) VALUES ${batch.map(()=>one).join(',')}`,vals);}
  for(const table of tables){const rows=source[table];const cols=fields[table];for(let offset=0;offset<rows.length;offset+=200){const batch=rows.slice(offset,offset+200);if(!batch.length)continue;const values=batch.flatMap(row=>normalize(table,row));const one='('+cols.map(()=>'?').join(',')+')';await db.execute(`INSERT INTO \`${table}\` (${cols.map(c=>c==='key'?'`key`':`\`${c}\``).join(',')}) VALUES ${batch.map(()=>one).join(',')}`,values);}console.log(`Imported ${table}: ${rows.length}`);}
  await db.commit();
 }catch(e){await db.rollback();throw e;}
 console.log('Migration completed. Verify record counts and run npm run smoke before changing production traffic.');
 if(!chosenAdminId)console.log('No admin password was assigned during migration. Configure one with npm run grant-admin.');
}catch(e){console.error('Migration stopped:',e instanceof Error?e.message:e);process.exitCode=1;}finally{await db.end();}
