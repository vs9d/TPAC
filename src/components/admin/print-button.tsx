"use client";
import { Printer } from "lucide-react";
export function PrintButton({ label }: { label: string }) {
  return <button onClick={() => window.print()} className="btn btn-primary btn-sm"><Printer className="size-4" /> {label}</button>;
}
