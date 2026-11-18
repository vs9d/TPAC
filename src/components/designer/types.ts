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
};

export const PROPS = ["tpacId", "tpacLocation", "tpacKind", "tpacArtworkId", "tpacShape", "tpacLocked", "tpacHidden", "tpacPx", "tpacVector", "tpacFilters", "tpacFontLabel", "tpacLabel"];

export interface LayerInfo { id: string; kind: Kind; label: string; location: PrintLocation; hidden: boolean; locked: boolean }

export type Choice = OptionChoice & { addons: string[] };

export type TabId = "product" | "add" | "layers" | "order";

export interface DesignerApi {
  addText: (presetId?: string) => void;
  addShape: (id: string) => void;
  applyTemplate: (id: string) => void;
  upload: (file: File) => void;
  selectLayer: (id: string) => void;
  layerAction: (id: string, action: "up" | "down" | "hide" | "lock" | "delete" | "duplicate") => void;
  clearAll: () => void;
  undo: () => void;
  redo: () => void;
}
