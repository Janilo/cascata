// Client-side file parsing — extracts plain text from XLSX, CSV, TXT.
// PDFs fall back to raw bytes (the AI handles small text PDFs best);
// for big PDFs we recommend exporting to CSV/XLSX first.
import * as XLSX from "xlsx";

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
    return parts.join("\n\n");
  }
  // CSV / TXT / fallback
  return await file.text().catch(() => "");
}
