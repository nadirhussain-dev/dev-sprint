import "server-only";
import { addDays } from "@/lib/domain/dates";
import type { SkillArea } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Adds (or re-activates) an item in the spaced revision queue, due tomorrow. */
export async function queueRevision(
  supabase: Supabase,
  userId: string,
  today: string,
  item: { source_type: "task" | "question" | "challenge" | "design"; source_id: string; title: string; link: string; skill_area: SkillArea },
) {
  await supabase.from("revision_items").upsert(
    { user_id: userId, ...item, due_date: addDays(today, 1), interval_days: 1, repetitions: 0, status: "active" },
    { onConflict: "user_id,source_type,source_id" },
  );
}
