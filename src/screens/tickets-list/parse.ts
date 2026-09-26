const TITLE_RE =
  /^(\d+)\s*:\s*(?:Заявка с формы\s*)?\[\s*([^\]]+?)\s*\]\s*(.*)$/;

export function simplifyTitle(original: string): string {
  const trimmed = original.trim();
  const match = TITLE_RE.exec(trimmed);
  if (!match) return original;

  const id = match[1] ?? "";
  const cleaned = match[3]?.trim() ?? "";

  // Если после префикса пусто — заглушка с номером.
  if (!cleaned) {
    return id ? `${id}: Без краткого описания` : "Без краткого описания";
  }

  // Номер заявки оставляем — он полезен и не мешает.
  return id ? `${id}: ${cleaned}` : cleaned;
}