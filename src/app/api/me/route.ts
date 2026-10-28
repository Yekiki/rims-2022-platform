import {NextRequest,NextResponse} from 'next/server';
import {actor,fail,noStore,query} from '@/lib/server';
import {RowDataPacket} from 'mysql2/promise';
export async function GET(req:NextRequest){try{
 const {user,profile}=await actor(req);let organization=null;
 if(profile?.organization_id){const rows=await query<RowDataPacket[]>('SELECT id,name,activity_type,construction_sector FROM organizations WHERE id=? LIMIT 1',[profile.organization_id]);organization=rows[0]??null;}
 return NextResponse.json({username:user.username,profile,organization},{headers:noStore});
}catch(e){return fail(e);}}
