import { NextResponse } from "next/server";
import { getUserFromSession } from "@/lib/auth";

export async function GET() {
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
