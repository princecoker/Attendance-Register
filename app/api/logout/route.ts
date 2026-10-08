import { NextResponse } from 'next/server';
import { cookieName, sameOrigin } from '@/lib/auth';
export async function POST(request: Request) { if(!sameOrigin(request)) return NextResponse.json({error:'Invalid request origin'},{status:403}); const r = NextResponse.json({ok:true}); r.cookies.delete(cookieName); return r; }
