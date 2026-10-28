import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {execute,query,readSessionId,setSessionCookie,fail,noStore} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
export async function POST(req:NextRequest){try{
 let id=readSessionId(req);let existing:RowDataPacket[]=[];
 if(id)existing=await query<RowDataPacket[]>('SELECT id FROM users WHERE id=? LIMIT 1',[id]);
 if(!id||!existing.length){id=randomUUID();await execute('INSERT INTO users (id) VALUES (?)',[id]);}
 const res=NextResponse.json({ok:true},{headers:noStore});setSessionCookie(res,id);return res;
}catch(e){return fail(e);}}
