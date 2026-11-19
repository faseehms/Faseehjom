function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats clean UTF-8 plain text content for TXT export.
 */
export function buildPlainTextExport(
  correctedText: string,
  summary?: string,
): string {
  const cleanBody = correctedText.trim();
  if (!summary?.trim()) {
    return `${cleanBody}\n`;
  }
  return `${cleanBody}\n\n---\nالخلاصة اللغوية:\n${summary.trim()}\n`;
}

/**
 * Generates an RTL Word-compatible HTML document (.doc) with clean Arabic typography
 * and paragraph structure ready for Microsoft Word / LibreOffice / Google Docs.
 */
export function buildWordHtmlDocument(
  correctedText: string,
  title = 'النص المصحح — فَصيح',
  summary?: string,
): string {
  const paragraphs = correctedText
    .trim()
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-family:'Amiri','Traditional Arabic','Arial',sans-serif;font-size:16pt;line-height:1.9;text-align:right;margin:0 0 12pt 0;color:#111827;">${escapeHtml(p)}</p>`,
    )
    .join('\n');

  const summaryBlock = summary?.trim()
    ? `<hr style="border:none;border-top:1px solid #d1d5db;margin:18pt 0 12pt 0;" />
<p style="font-family:'Arial',sans-serif;font-size:11pt;line-height:1.7;text-align:right;color:#4b5563;"><strong>الخلاصة اللغوية:</strong> ${escapeHtml(summary.trim())}</p>`
    : '';

  return `\uFEFF<!DOCTYPE html>
<html lang="ar" dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 2.2cm; }
  body { direction: rtl; unicode-bidi: embed; font-family: 'Amiri', 'Traditional Arabic', 'Arial', sans-serif; }
</style>
</head>
<body dir="rtl">
<h1 style="font-family:'Amiri','Traditional Arabic','Arial',sans-serif;font-size:18pt;color:#065f46;text-align:right;margin:0 0 16pt 0;border-bottom:1px solid #e5e7eb;padding-bottom:8pt;">${escapeHtml(title)}</h1>
${paragraphs}
${summaryBlock}
</body>
</html>`;
}

/**
 * Triggers a client-side file download with clean Blob URL cleanup.
 */
export function triggerFileDownload(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
