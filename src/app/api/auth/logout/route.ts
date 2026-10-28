import {NextResponse} from 'next/server';
import {clearSessionCookie,noStore} from '@/lib/server';
export async function POST(){const res=NextResponse.json({ok:true},{headers:noStore});clearSessionCookie(res);return res;}
