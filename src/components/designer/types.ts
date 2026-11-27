import type { FabricObject } from "fabric";
import type { PrintLocation } from "@/lib/garments";
import type { OptionChoice } from "@/lib/design-pricing";

export type Kind = "image" | "text" | "shape";

/** A Fabric object carrying our own metadata (kept through undo/redo via PROPS). */
export type Tagged = FabricObject & {
  tpacId?: string;
  tpacLocation?: PrintLocation;
  tpacKind?: Kind | "guide";
  tpacArtworkId?: string;
  tpacShape?: string;
  tpacLocked?: boolean;
  tpacHidden?: boolean;
  tpacPx?: number;
  tpacVector?: boolean;
  tpacFilters?: { grayscale?: boolean; invert?: boolean };
  tpacFontLabel?: string;
  tpacLabel?: string;
  /** the member's name in a group order (what gets printed for them) */
  tpacGroupName?: boolean;
};

export const PROPS = ["tpacId", "tpacLocation", "tpacKind", "tpacArtworkId", "tpacShape", "tpacLocked", "tpacHidden", "tpacPx", "tpacVector", "tpacFilters", "tpacFontLabel", "tpacLabel", "tpacGroupName"];

export interface LayerInfo { id: string; kind: Kind; label: string; location: PrintLocation; hidden: boolean; locked: boolean }

export type Choice = OptionChoice & { addons: string[] };

export type TabId = "image" | "text" | "shapes" | "ideas";

export interface DesignerApi {
  addText: (presetId?: string, text?: string) => void;
  addShape: (id: string) => void;
  applyTemplate: (id: string) => void;
  /** barcode (Code 128) or QR code from the customer's text, added as vector artwork */
  addCode: (kind: "barcode" | "qr", text: string) => Promise<void>;
  upload: (file: File) => void;
  selectLayer: (id: string) => void;
  layerAction: (id: string, action: "up" | "down" | "hide" | "lock" | "delete" | "duplicate") => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
}

/** One finished piece in the review dialog (a couple design has two). */
export interface ReviewPiece {
  front: string; back: string;
  sides: { src: string; label: string }[];
  /** sleeve / hood previews as uploaded */
  raw: Partial<Record<"right" | "left" | "hood", string>>;
  colorId: string; colorName: string; colorHex?: string;
  sizes: Record<string, number>;
  used: string[];
  objects: unknown[];
  /** the studio layout itself, to open it again (community page) */
  fabric?: string;
}
