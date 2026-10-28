/** Read-only checks against the configured MySQL database. */
import mysql from 'mysql2/promise';
import {readFileSync,existsSync} from 'node:fs';
for(const file of ['.env.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const {MYSQL_HOST,MYSQL_PORT,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE}=process.env;
if(!MYSQL_HOST||!MYSQL_USER||!MYSQL_DATABASE)throw Error('Configure MySQL environment variables first.');
const db=await mysql.createConnection({host:MYSQL_HOST,port:Number(MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD||'',database:MYSQL_DATABASE,charset:'utf8mb4',timezone:'Z'});
try{
 for(const [table,expected] of [['dimensions',5],['questions',42],['answer_options',210]]){const [[row]]=await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);if(Number(row.total)!==expected)throw Error(`${table} count mismatch: expected ${expected}, got ${row.total}`);console.log(`${table}: ${row.total} OK`);}
 const [dims]=await db.query('SELECT weight,item_count FROM dimensions');const weight=dims.reduce((a,x)=>a+Number(x.weight),0),items=dims.reduce((a,x)=>a+Number(x.item_count),0);if(Math.abs(weight-1)>1e-10||items!==35)throw Error('Weights or item counts invalid');
 const [tables]=await db.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('users','profiles','organizations','invites','assessments','answers','scoring_rules','dimension_scores','maturity_results','audit_logs')");if(Number(tables[0].total)!==10)throw Error('One or more required MySQL tables are missing');
 console.log('MySQL connectivity and RIMS schema smoke checks passed. Run end-to-end tests before production.');
}finally{await db.end();}
