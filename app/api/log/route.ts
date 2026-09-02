import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseClient";

// Table schema (create in Supabase SQL editor before first use):
//
// create table task_logs (
//   id bigint generated always as identity primary key,
//   timestamp timestamptz not null,
//   machine_slug text not null,
//   step_id text not null,
//   student_action text not null,
//   result text not null,
//   attempt_number int not null,
//   session_id text,
//   parameters jsonb
// );
//
// NOTE on the security gap flagged in review: this endpoint still accepts
// writes from any caller with no auth check — session_id (below) is an
// anonymous per-browser id, not a verified identity, so it stops accidental
// cross-session mixing but does NOT stop someone from posting fabricated
// rows directly to this route. Real student attribution needs Supabase Auth
// (a login step + RLS policy tying rows to auth.uid()), which is still open
// work — see README. Don't present this log data as tamper-proof in your
// evaluation chapter until that's in place.

export async function POST(req: NextRequest) {
  const entry = await req.json();
  const supabase = getSupabase();

  if (!supabase) {
    // Supabase not configured yet — don't fail the student's session over it,
    // just tell the caller so it's visible in dev without crashing anything.
    return NextResponse.json(
      { stored: false, reason: "Supabase env vars not set" },
      { status: 200 }
    );
  }

  const { error } = await supabase.from("task_logs").insert({
    timestamp: entry.timestamp,
    machine_slug: entry.machineSlug,
    step_id: entry.stepId,
    student_action: entry.studentAction,
    result: entry.result,
    attempt_number: entry.attemptNumber,
    session_id: entry.sessionId ?? null,
    parameters: entry.parameters ?? null,
  });

  if (error) {
    return NextResponse.json({ stored: false, reason: error.message }, { status: 500 });
  }

  return NextResponse.json({ stored: true });
}
