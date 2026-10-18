import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    await supabase.auth.exchangeCodeForSession(code);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mtaavibes.onrender.com";
  return NextResponse.redirect(`${siteUrl}/dashboard`);
}
