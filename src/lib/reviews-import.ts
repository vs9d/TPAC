/** One review per line: "name | stars | label | text" (name, stars and label optional). */
export function parseTestimonialLines(raw: string) {
  const out: { author_name: string; rating: number; label: string | null; body: string }[] = [];
  const errors: number[] = [];
  raw.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l) return;
    const parts = l.split("|").map((p) => p.trim());
    const body = parts[parts.length - 1] ?? "";
    const name = parts.length >= 2 ? parts[0]! : "";
    const stars = parts.length >= 3 ? Number(parts[1]) : 5;
    const label = parts.length >= 4 ? parts[2]! : "";
    if (!body || body.length > 1500 || !(stars >= 1 && stars <= 5)) {
      errors.push(i + 1);
      return;
    }
    out.push({ author_name: (name || "زبون TPAC").slice(0, 60), rating: Math.round(stars), label: label.slice(0, 40) || null, body });
  });
  return { rows: out, errors };
}

