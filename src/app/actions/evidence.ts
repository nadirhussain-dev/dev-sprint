"use server";
import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/data/context";
import { EvidenceSchema } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 5 * 1024 * 1024;

/** Attaches proof of practical work (GitHub link, demo, screenshot, explanation) to a task or milestone. */
export async function addEvidence(formData: FormData): Promise<ActionResult> {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const parsed = EvidenceSchema.safeParse({
    title: str("title"), github_url: str("github_url") ?? "", demo_url: str("demo_url") ?? "",
    explanation: str("explanation"), milestone_id: str("milestone_id"), task_id: str("task_id"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  if (!v.github_url && !v.demo_url && !(formData.get("screenshot") instanceof File && (formData.get("screenshot") as File).size > 0)) {
    return { ok: false, error: "Add at least a GitHub link, a demo link, or a screenshot." };
  }

  const { supabase, userId } = await getAppContext();
  let screenshotPath: string | null = null;
  const file = formData.get("screenshot");
  if (file instanceof File && file.size > 0) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { ok: false, error: "Screenshot must be PNG, JPEG, WebP or GIF" };
    if (file.size > MAX_BYTES) return { ok: false, error: "Screenshot must be under 5 MB" };
    screenshotPath = `${userId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("evidence").upload(screenshotPath, file, { contentType: file.type, upsert: false });
    if (up.error) return { ok: false, error: `Upload failed: ${up.error.message}` };
  }

  const res = await supabase.from("project_evidence").insert({
    user_id: userId, title: v.title, github_url: v.github_url || null, demo_url: v.demo_url || null,
    explanation: v.explanation, milestone_id: v.milestone_id ?? null, task_id: v.task_id ?? null, screenshot_path: screenshotPath,
  });
  if (res.error) return { ok: false, error: res.error.message };
  revalidatePath("/projects");
  revalidatePath("/roadmap", "layout");
  revalidatePath("/analytics");
  return { ok: true, message: "Evidence saved" };
}

export async function deleteEvidence(id: string): Promise<ActionResult> {
  const { supabase } = await getAppContext();
  const { data } = await supabase.from("project_evidence").delete().eq("id", id).select("screenshot_path").maybeSingle();
  if (data?.screenshot_path) await supabase.storage.from("evidence").remove([data.screenshot_path as string]);
  revalidatePath("/projects");
  revalidatePath("/roadmap", "layout");
  return { ok: true };
}

export async function getScreenshotUrl(path: string): Promise<string | null> {
  const { supabase, userId } = await getAppContext();
  if (!path.startsWith(`${userId}/`)) return null;
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
