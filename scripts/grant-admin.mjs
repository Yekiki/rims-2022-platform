import mysql from 'mysql2/promise';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
for(const file of ['.env.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
const {MYSQL_HOST,MYSQL_PORT,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE,ADMIN_USERNAME,ADMIN_PASSWORD,ADMIN_FULL_NAME}=process.env;
if(!MYSQL_HOST||!MYSQL_USER||!MYSQL_DATABASE||!ADMIN_USERNAME||!ADMIN_PASSWORD)throw Error('Set MySQL settings plus ADMIN_USERNAME and ADMIN_PASSWORD.');
if(ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must be at least 12 characters.');
const db=await mysql.createConnection({host:MYSQL_HOST,port:Number(MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD||'',database:MYSQL_DATABASE,charset:'utf8mb4',timezone:'Z'});
const salt=randomBytes(16);const passwordHash=`scrypt$${salt.toString('base64url')}$${scryptSync(ADMIN_PASSWORD,salt,64).toString('base64url')}`;
try{
 await db.beginTransaction();
 const [orgRows]=await db.execute('SELECT id FROM organizations WHERE name=? LIMIT 1',['مدیریت پژوهش (سیستمی)']);let orgId=orgRows[0]?.id;
 if(!orgId){orgId=randomUUID();await db.execute('INSERT INTO organizations (id,name,activity_type,construction_sector) VALUES (?,?,?,?)',[orgId,'مدیریت پژوهش (سیستمی)','مدیریت پژوهش','داخلی']);}
 const [byUsername]=await db.execute('SELECT u.id FROM users u JOIN profiles p ON p.id=u.id WHERE u.username=? LIMIT 1',[ADMIN_USERNAME]);
 let userId=byUsername[0]?.id;
 if(!userId){const [existingAdmin]=await db.execute("SELECT p.id FROM profiles p JOIN users u ON u.id=p.id WHERE p.role='admin' AND u.username IS NULL ORDER BY p.created_at LIMIT 1");userId=existingAdmin[0]?.id;}
 if(!userId){userId=randomUUID();await db.execute('INSERT INTO users (id,username,password_hash) VALUES (?,?,?)',[userId,ADMIN_USERNAME,passwordHash]);}
 else await db.execute('UPDATE users SET username=?,password_hash=? WHERE id=?',[ADMIN_USERNAME,passwordHash,userId]);
 const [profileRows]=await db.execute('SELECT id FROM profiles WHERE id=? LIMIT 1',[userId]);
 if(profileRows.length){await db.execute("UPDATE profiles SET role='admin',full_name=?,job_title='مدیر سامانه',specialization='مدیریت ریسک' WHERE id=?",[ADMIN_FULL_NAME||'پژوهشگر',userId]);}
 else await db.execute("INSERT INTO profiles (id,organization_id,role,full_name,job_title,specialization,consent_at,consent_version) VALUES (?,?,'admin',?,'مدیر سامانه','مدیریت ریسک',CURRENT_TIMESTAMP(3),'admin-1.0')",[userId,orgId,ADMIN_FULL_NAME||'پژوهشگر']);
 await db.commit();console.log(`Admin credentials configured for username: ${ADMIN_USERNAME}`);
}catch(e){await db.rollback();throw e;}finally{await db.end();}
