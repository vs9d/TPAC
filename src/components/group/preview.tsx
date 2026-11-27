"use client";
import { ARTBOARD, garmentDataUrl, type GarmentType } from "@/lib/garments";
import { fitInArtboard } from "@/lib/pod-templates";
import { GROUP_PLACEMENTS, NAME_FONTS, PLACEMENT_VIEW, type GroupPlacement, type GroupTemplate, type PreviewKit } from "@/lib/group-template";

export interface PreviewMember { name?: string; image?: string | null }

/** One side of the group's piece: the garment photo, the organiser's fixed design(s), and this member's name or design. */
export function GroupPieceView({ kit, colorId, view, fixed, template, member, label, emptyHint }: {
  kit: PreviewKit;
  colorId: string | null;
  view: "front" | "back";
  /** image addresses of the organiser's fixed designs, per placement */
  fixed: Partial<Record<GroupPlacement, string>>;
  template: GroupTemplate;
  member?: PreviewMember;
  label: string;
  emptyHint?: string;
}) {
  const color = kit.colors.find((c) => c.id === colorId) ?? kit.colors[0];
  const kv = kit.views[view];
  const photo = kv ? (color && kv.color_mockups[color.id]) || kv.mockup_url : null;
  const box = photo && kv ? fitInArtboard(kv.width, kv.height) : { x: 0, y: 0, width: ARTBOARD.width, height: ARTBOARD.height };
  const src = photo ?? garmentDataUrl(kit.garment as GarmentType, view, color?.hex ?? "#111111");
  const m = template.member;
  const here = (p: GroupPlacement) => PLACEMENT_VIEW[p] === view;
  const nameText = (member?.name ?? "").trim();
  const font = NAME_FONTS.find((f) => f.id === m.font) ?? NAME_FONTS[0];
  return (
    <figure className="overflow-hidden rounded-2xl bg-bone">
      <svg viewBox={`0 0 ${ARTBOARD.width} ${ARTBOARD.height}`} className="block h-auto w-full" role="img" aria-label={label}>
        <image href={src} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio="xMidYMid meet" />
        {GROUP_PLACEMENTS.filter((p) => here(p) && fixed[p]).map((p) => {
          const a = kit.areas[p];
          return <image key={p} href={fixed[p]} x={a.x} y={a.y} width={a.width} height={a.height} preserveAspectRatio="xMidYMid meet" />;
        })}
        {m.kind !== "none" && here(m.placement) && (() => {
          const a = kit.areas[m.placement];
          if (m.kind === "design" && member?.image) return <image href={member.image} x={a.x} y={a.y} width={a.width} height={a.height} preserveAspectRatio="xMidYMid meet" />;
          if (m.kind === "name" && nameText) {
            const shown = m.font === "block" ? nameText.toUpperCase() : nameText;
            const size = Math.min(a.height * (m.placement === "left_chest" ? 0.5 : 0.32), a.width / Math.max(3, shown.length * 0.56));
            return (
              <text x={a.x + a.width / 2} y={a.y + a.height * (m.placement === "back" ? 0.22 : 0.5) + size * 0.35} textAnchor="middle" fontSize={size} style={{ fontFamily: font.family }} fontWeight={700} fill={m.color} direction={/[\u0600-\u06FF]/.test(shown) ? "rtl" : "ltr"} letterSpacing={m.font === "block" ? size * 0.04 : 0}>
                {shown}
              </text>
            );
          }
          // nothing yet: show where it will go
          return (
            <g>
              <rect x={a.x} y={a.y} width={a.width} height={m.placement === "back" ? a.height * 0.38 : a.height} rx="8" fill="none" stroke="#E3963C" strokeWidth="2.5" strokeDasharray="8 6" />
              {emptyHint && <text x={a.x + a.width / 2} y={a.y + (m.placement === "back" ? a.height * 0.2 : a.height / 2) + 6} textAnchor="middle" fontSize={m.placement === "left_chest" ? 11 : 18} fill="#E3963C" fontWeight={700}>{emptyHint}</text>}
            </g>
          );
        })()}
      </svg>
      <figcaption className="py-1.5 text-center text-xs font-bold">{label}</figcaption>
    </figure>
  );
}
