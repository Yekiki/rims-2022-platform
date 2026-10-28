import {NextRequest,NextResponse} from 'next/server';
import {createHash,createHmac,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import mysql,{Pool,PoolConnection,ResultSetHeader,RowDataPacket} from 'mysql2/promise';

const scrypt=promisify(scryptCallback);
const SESSION_COOKIE='rims_session';
const SESSION_TTL_SECONDS=60*60*24*7;
type AppUser={id:string;username:string|null;created_at:Date|string};
type Profile=RowDataPacket & {id:string;organization_id:string;role:'admin'|'respondent';full_name:string;job_title:string;specialization:string|null;experience_years:number|null;risk_experience_years:number|null;erm_familiarity:string|null;consent_at:Date|string;consent_version:string;created_at:Date|string};

declare global {var __rimsMysqlPool:Pool|undefined}
export function dbPool():Pool{
 if(!global.__rimsMysqlPool){
  const {MYSQL_HOST,MYSQL_PORT,MYSQL_USER,MYSQL_PASSWORD,MYSQL_DATABASE,MYSQL_SSL}=process.env;
  if(!MYSQL_HOST||!MYSQL_USER||!MYSQL_DATABASE)throw new Error('تنظیمات اتصال MySQL کامل نیست؛ متغیرهای MYSQL_HOST، MYSQL_USER و MYSQL_DATABASE را بررسی کنید.');
  global.__rimsMysqlPool=mysql.createPool({host:MYSQL_HOST,port:Number(MYSQL_PORT||3306),user:MYSQL_USER,password:MYSQL_PASSWORD||'',database:MYSQL_DATABASE,waitForConnections:true,connectionLimit:10,queueLimit:0,timezone:'Z',decimalNumbers:true,charset:'utf8mb4',ssl:MYSQL_SSL==='true'?{}:undefined});
 }
 return global.__rimsMysqlPool;
}
export async function query<T extends RowDataPacket[]=RowDataPacket[]>(sql:string,params:unknown[]=[]):Promise<T>{
 const [rows]=await dbPool().execute(sql,params as any[]);return rows as T;
}
export async function execute(sql:string,params:unknown[]=[]):Promise<ResultSetHeader>{
 const [result]=await dbPool().execute(sql,params as any[]);return result as ResultSetHeader;
}
export async function transaction<T>(fn:(conn:PoolConnection)=>Promise<T>):Promise<T>{
 const conn=await dbPool().getConnection();
 try{await conn.beginTransaction();const value=await fn(conn);await conn.commit();return value;}
 catch(e){try{await conn.rollback()}catch{}throw e;}finally{conn.release();}
}
export async function txQuery<T extends RowDataPacket[]=RowDataPacket[]>(conn:PoolConnection,sql:string,params:unknown[]=[]):Promise<T>{
 const [rows]=await conn.execute(sql,params as any[]);return rows as T;
}
export async function txExecute(conn:PoolConnection,sql:string,params:unknown[]=[]):Promise<ResultSetHeader>{
 const [result]=await conn.execute(sql,params as any[]);return result as ResultSetHeader;
}
export function shaCode(code:string){return createHash('sha256').update(code.trim()).digest('hex');}
export function errorJson(message:string,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});}
function sessionSecret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error('SESSION_SECRET باید حداقل ۳۲ نویسه تصادفی داشته باشد.');return value;}
function signature(payload:string){return createHmac('sha256',sessionSecret()).update(payload).digest('base64url');}
function safeEqual(a:string,b:string){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);}
export function readSessionId(req:NextRequest):string|null{
 try{
  const token=req.cookies.get(SESSION_COOKIE)?.value;if(!token)return null;
  const [id,exp,sig,...rest]=token.split('.');if(!id||!exp||!sig||rest.length)return null;
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^\d+$/.test(exp)||Number(exp)<=Math.floor(Date.now()/1000))return null;
  const payload=`${id}.${exp}`;if(!safeEqual(signature(payload),sig))return null;return id;
 }catch{return null;}
}
export function setSessionCookie(res:NextResponse,userId:string){
 const exp=Math.floor(Date.now()/1000)+SESSION_TTL_SECONDS;const payload=`${userId}.${exp}`;
 res.cookies.set(SESSION_COOKIE,`${payload}.${signature(payload)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:SESSION_TTL_SECONDS});
}
export function clearSessionCookie(res:NextResponse){res.cookies.set(SESSION_COOKIE,'',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});}
export async function actor(req:NextRequest){
 const id=readSessionId(req);if(!id)throw new HttpError('نشست معتبر نیست؛ دوباره وارد شوید.',401);
 const users=await query<RowDataPacket[]>('SELECT id, username, created_at FROM users WHERE id=? LIMIT 1',[id]);
 if(!users.length)throw new HttpError('نشست پیدا نشد؛ دوباره وارد شوید.',401);
 const profiles=await query<Profile[]>('SELECT * FROM profiles WHERE id=? LIMIT 1',[id]);
 return {db:dbPool(),user:users[0] as AppUser,profile:profiles[0]??null};
}
export async function requireProfile(req:NextRequest){const a=await actor(req);if(!a.profile)throw new HttpError('ابتدا اطلاعات پژوهشی خود را تکمیل کنید.',403);return {...a,profile:a.profile};}
export async function requireAdmin(req:NextRequest){const a=await requireProfile(req);if(a.profile.role!=='admin')throw new HttpError('دسترسی مدیر لازم است.',403);return a;}
export class HttpError extends Error {constructor(message:string,public status:number){super(message);}}
export function fail(err:unknown){
 if(err instanceof HttpError)return errorJson(err.message,err.status);
 if(err instanceof Error && /SESSION_SECRET|MySQL|MYSQL_/.test(err.message))console.error('Configuration error:',err.message);else console.error('Request failed',err);
 return errorJson('عملیات انجام نشد؛ تنظیمات پایگاه داده یا وضعیت سامانه را بررسی کنید.',500);
}
export async function audit(_db:unknown,actorId:string|null,action:string,entityId:string,details:Record<string,unknown>={}){
 try{await execute('INSERT INTO audit_logs (actor_id, action, entity_id, details) VALUES (?, ?, ?, ?)',[actorId,action,entityId,JSON.stringify(details)]);}
 catch(e){console.error('Audit write failed:',e instanceof Error?e.message:e);}
}
export const noStore={'Cache-Control':'no-store, private'};
export async function hashPassword(password:string){
 const salt=randomBytes(16);const derived=await scrypt(password,salt,64) as Buffer;return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}
export async function verifyPassword(password:string,stored:string){
 try{const [scheme,saltText,hashText]=stored.split('$');if(scheme!=='scrypt'||!saltText||!hashText)return false;const salt=Buffer.from(saltText,'base64url'),expected=Buffer.from(hashText,'base64url');const actual=await scrypt(password,salt,expected.length) as Buffer;return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}
}
