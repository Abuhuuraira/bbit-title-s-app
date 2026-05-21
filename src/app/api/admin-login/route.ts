import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const VALID_PASSWORDS = ["huraira123", "huraira124"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    if (!VALID_PASSWORDS.includes(password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Set secure admin cookie
    const cookieStore = cookies();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Valid for 7 days

    cookieStore.set("admin_auth", "verified", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
