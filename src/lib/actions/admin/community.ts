"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertStaff } from "@/lib/auth";
import { logActivity, str, type ActionState } from "./common";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = () => {
  revalidatePath("/[locale]/community", "page");
  revalidatePath("/[locale]/admin/community", "page");
};

/** Copies a private preview of the design to the public bucket, so the community page can show it. */
async function publicCopy(path: string | null, dest: string): Promise<string | null> {
  if (!path) return null;
  const db = createAdminClient();
  const { data: blob } = await db.storage.from("design-uploads").download(path);
  if (!blob) return null;
  const type = blob.type || (path.endsWith(".png") ? "image/png" : "image/jpeg");
  const { error } = await db.storage.from("product-images").upload(dest, blob, { contentType: type, upsert: true });
  if (error) return null;
  return db.storage.from("product-images").getPublicUrl(dest).data.publicUrl;
}

export async function moderateCommunityDesign(_: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const action = str(form.get("action"));
  if (!UUID.test(id) || !["approve", "reject", "hide"].includes(action)) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data: row } = await db.from("community_designs").select("id, preview_front_path, preview_back_path, image_front").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (action === "approve") {
    const ext = (p: string | null) => (p?.endsWith(".png") ? "png" : "jpg");
    const front = row.image_front ?? (await publicCopy(row.preview_front_path, `community/${id}/front.${ext(row.preview_front_path)}`));
    const back = await publicCopy(row.preview_back_path, `community/${id}/back.${ext(row.preview_back_path)}`);
    if (!front) return { ok: false, error: "storage_failed" };
    await db.from("community_designs").update({ status: "approved", approved_at: new Date().toISOString(), image_front: front, image_back: back }).eq("id", id);
  } else {
    await db.from("community_designs").update({ status: action === "reject" ? "rejected" : "hidden" }).eq("id", id);
  }
  await logActivity(`community.${action}`, "community_design", id);
  refresh();
  return { ok: true, message: action === "approve" ? "انشر ✓" : "تم" };
}

export async function updateCommunityReward(_: ActionState, form: FormData): Promise<ActionState> {
  await assertStaff();
  const id = str(form.get("id"));
  const reward = Number(str(form.get("reward_per_sale")));
  const paid = Number(str(form.get("rewards_paid")));
  if (!UUID.test(id) || !Number.isInteger(reward) || reward < 0 || reward > 1_000_000 || !Number.isInteger(paid) || paid < 0) return { ok: false, error: "validation" };
  await createAdminClient().from("community_designs").update({ reward_per_sale: reward, rewards_paid: paid }).eq("id", id);
  await logActivity("community.reward", "community_design", id, { reward, paid });
  refresh();
  return { ok: true, message: "انحفظ ✓" };
}
