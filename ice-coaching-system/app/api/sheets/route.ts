import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_ACTIONS = new Set([
  "login",
  "get_data",
  "create_assignment",
  "publish_assignment",
  "add_exercise",
  "create_trainee",
  "log_workout",
  "create_checkin",
]);

export async function POST(request: Request) {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_SHEETS_SHARED_SECRET;

  if (!endpoint || !secret) {
    return NextResponse.json(
      { ok: false, error: "Google Sheets has not been configured on the server yet." },
      { status: 503 },
    );
  }

  let body: { action?: string; payload?: unknown; session?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON request." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "Unsupported action." }, { status: 400 });
  }
  if (action !== "login" && !body.session) {
    return NextResponse.json({ ok: false, error: "Please sign in first." }, { status: 401 });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        secret,
        action,
        payload: body.payload ?? {},
        session: body.session ?? "",
      }),
    });

    const result = await response.json();
    const status = result?.ok ? 200 : result?.error === "Unauthorized" ? 401 : 400;
    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("Google Sheets adapter request failed:", error);
    return NextResponse.json(
      { ok: false, error: "Could not reach Google Sheets. Check the Apps Script deployment URL." },
      { status: 502 },
    );
  }
}
