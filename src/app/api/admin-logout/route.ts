import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = cookies();
  cookieStore.set("admin_auth", "", { maxAge: 0 });
  return NextResponse.json({ success: true }, { status: 200 });
}
