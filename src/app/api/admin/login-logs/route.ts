import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireAdminUser } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query(
      `
      SELECT l.id, l.logged_at, l.ip, l.user_agent, u.id as user_id, u.username
      FROM app_user_login_logs l
      JOIN app_users u ON u.id = l.user_id
      ORDER BY l.logged_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return NextResponse.json({ logs: result.rows ?? [] });
  } finally {
    client.release();
  }
}

export async function DELETE() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const client = await (await getDbPool()).connect();
  try {
    const result = await client.query("DELETE FROM app_user_login_logs");
    return NextResponse.json({ deleted: result.rowCount ?? 0 });
  } finally {
    client.release();
  }
}
