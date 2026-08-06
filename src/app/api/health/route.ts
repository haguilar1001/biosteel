import { NextResponse } from "next/server";

// Endpoint público de salud (para Railway healthcheck). No expone datos.
export async function GET() {
  return NextResponse.json({ status: "ok", app: "biosteel" });
}
