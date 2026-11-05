import { NextRequest, NextResponse } from "next/server";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const supplied = request.headers.get("X-Dashboard-Token") || "";
  const expected = process.env.DASHBOARD_ACCESS_TOKEN || "";
  if (!expected || supplied !== expected) return NextResponse.json({ detail: "دسترسی غیرمجاز" }, { status: 401 });

  const { path } = await context.params;
  const destination = "/api/v1/" + path.map(encodeURIComponent).join("/");
  const base = process.env.API_URL || "http://api:8000";
  const headers: Record<string, string> = { "X-Admin-API-Key": process.env.ADMIN_API_KEY || "" };
  if (request.method !== "GET" && request.method !== "DELETE") headers["Content-Type"] = "application/json";
  const response = await fetch(base + destination, {
    method: request.method,
    headers,
    body: ["GET", "HEAD", "DELETE"].includes(request.method) ? undefined : await request.text(),
    cache: "no-store",
  });
  const outgoing = new Headers();
  const contentType = response.headers.get("Content-Type");
  const disposition = response.headers.get("Content-Disposition");
  if (contentType) outgoing.set("Content-Type", contentType);
  if (disposition) outgoing.set("Content-Disposition", disposition);
  return new NextResponse(response.body, { status: response.status, headers: outgoing });
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
