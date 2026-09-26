const TITLE_RE =
  /^(\d+)\s*:\s*(?:Заявка с формы\s*)?\[\s*([^\]]+?)\s*\]\s*(.*)$/;

export function simplifyTitle(original: string): string {
  const trimmed = original.trim();
  const match = TITLE_RE.exec(trimmed);
  if (!match) return original;

  const id = match[1] ?? "";
  const cleaned = match[3]?.trim() ?? "";

  if (!cleaned) {
    return id ? `${id}: Без краткого описания` : "Без краткого описания";
  }
  return id ? `${id}: ${cleaned}` : cleaned;
}