/** How a listing's review status reads, with its badge colour. */
export const STATUS_LABEL: Record<string, [string, string, string]> = {
  draft: ["مسودة", "Draft", "bg-bone"], pending: ["قيد المراجعة", "In review", "bg-amber/20"], approved: ["منشور", "Published", "bg-pine-soft text-pine"],
  rejected: ["مرفوض", "Rejected", "bg-danger/10 text-danger"], changes_requested: ["مطلوب تعديل", "Changes requested", "bg-amber/20"], hidden: ["مخفي", "Hidden", "bg-bone text-mute"],
};
