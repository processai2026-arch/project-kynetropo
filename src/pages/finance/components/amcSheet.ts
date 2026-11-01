import type { OpsAmcRecord } from "@/types/ops";
import type { CompanyProfile } from "@/lib/companyProfile";
import { amcBreakdown } from "./AmcDialogs";

/*
 * The AMC sheet sent to a client: who it is for (client and business name),
 * the contract's dates, and the yearly price as a table — the base, each user
 * category, storage — with what more users or storage would add.
 *
 * jsPDF's built-in fonts have no ₹ sign, so amounts read "Rs." here.
 */

const rs = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-IN");
const day = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const gb = (n: number | null | undefined) => (n == null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)} GB`);
const hex = (c: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [46, 160, 218];
};

/** The file name the sheet downloads as: AMC-<client>-<project>.pdf */
export function amcSheetFileName(amc: OpsAmcRecord): string {
  const part = (s: string | null | undefined) => (s ?? "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `AMC-${part(amc.client_company || amc.client_name) || "client"}-${part(amc.project_code || amc.project_name) || amc.id}.pdf`;
}

/** Builds the sheet. Returns the PDF as a Blob. */
export async function buildAmcSheet(amc: OpsAmcRecord, company: CompanyProfile): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  const brand = hex(company.primaryColor || "#2ea0da");
  const b = amcBreakdown({
    base: amc.base_amount ?? amc.amount, users: amc.user_plans ?? [],
    storage_gb: amc.storage_gb, storage_step_gb: amc.storage_step_gb, storage_step_price: amc.storage_step_price, storage_used_gb: amc.storage_used_gb,
  });

  // ── Header: our company ──
  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 4, "F");
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20, 20, 20);
  doc.text(company.name, M, 18);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 100, 100);
  const ours = [company.subtitle, company.address, [company.phone, company.email].filter(Boolean).join("  ·  "), company.gstin ? `GSTIN ${company.gstin}` : ""].filter(Boolean);
  ours.forEach((line, i) => doc.text(doc.splitTextToSize(line, 110)[0], M, 24 + i * 4.5));
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...brand);
  doc.text("AMC SHEET", W - M, 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100, 100, 100);
  doc.text("Annual maintenance contract", W - M, 23.5, { align: "right" });
  doc.text(`Date: ${day(new Date().toISOString())}`, W - M, 28, { align: "right" });

  // ── Who it is for, and the contract ──
  let y = Math.max(44, 28 + ours.length * 4.5 + 6);
  doc.setDrawColor(225, 225, 225).line(M, y - 5, W - M, y - 5);
  const label = (t: string, x: number, yy: number) => { doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120, 120, 120); doc.text(t.toUpperCase(), x, yy); };
  const value = (t: string, x: number, yy: number, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(10.5).setTextColor(25, 25, 25); doc.text(doc.splitTextToSize(t || "—", 80)[0], x, yy); };
  const col2 = W / 2 + 4;
  label("Client name", M, y); value(amc.client_name ?? "—", M, y + 5, true);
  label("Business name", col2, y); value(amc.client_company || "—", col2, y + 5, true);
  y += 13;
  label("Project", M, y); value([amc.project_code, amc.project_name].filter(Boolean).join(" · "), M, y + 5);
  label("AMC plan", col2, y); value(amc.first_year_free ? "From the 2nd year (1st year free)" : "From the 1st year", col2, y + 5);
  y += 13;
  label("Contract from", M, y); value(day(amc.contract_start), M, y + 5);
  label("This year", col2, y); value(`${day(amc.start_date)} to ${day(amc.renewal_date)}`, col2, y + 5);
  y += 13;
  label("Next payment due", M, y); value(day(amc.due_date), M, y + 5, true);
  label("This year", col2, y); value(amc.in_free_year ? "Free (1st year)" : amc.term_paid ? "Paid" : "Not paid yet", col2, y + 5);
  y += 12;

  // ── The price, line by line ──
  const per = (n: number, unit: string) => (n === 1 ? `each ${unit}` : `every ${n} ${unit}s`);
  const rows: (string | number)[][] = [["Base price", "—", "—", "—", "Included", rs(amc.base_amount ?? amc.amount)]];
  for (const u of b.users) {
    const extra = Math.max(0, u.users - u.included);
    rows.push([
      `${u.category} users`, String(u.included), String(u.users),
      extra > 0 ? String(extra) : "—",
      `${rs(u.price)} for ${per(u.step, "user")} more`,
      u.extra > 0 ? rs(u.extra) : "Rs. 0",
    ]);
  }
  if (amc.storage_gb) {
    const used = amc.storage_used_gb;
    const extra = used != null ? Math.max(0, used - amc.storage_gb) : 0;
    rows.push([
      "Storage", gb(amc.storage_gb), gb(used), extra > 0 ? gb(extra) : "—",
      `${rs(amc.storage_step_price ?? 0)} for every ${gb(amc.storage_step_gb)} more`,
      b.storage > 0 ? rs(b.storage) : "Rs. 0",
    ]);
  }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Item", "In base", "Now", "Extra", "Price for more", "Amount a year"]],
    body: rows,
    foot: [["Total a year", "", "", "", "", rs(b.total)]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9.5, cellPadding: 2.6, textColor: [30, 30, 30], lineColor: [222, 222, 222] },
    headStyles: { fillColor: brand, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [245, 247, 250], textColor: [20, 20, 20], fontStyle: "bold", fontSize: 10.5 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 5: { halign: "right" } },
    didParseCell: (d) => { if (d.section === "foot" && d.column.index === 5) d.cell.styles.halign = "right"; },
  });
  // autoTable records where it ended on the document.
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ── How the price changes ──
  const terms: string[] = [];
  for (const u of amc.user_plans ?? []) terms.push(`${u.category}: ${u.included} users are included in the base price; ${rs(u.price)} a year is added for ${per(u.step, "user")} more.`);
  if (amc.storage_gb) terms.push(`Storage: ${gb(amc.storage_gb)} is included; ${rs(amc.storage_step_price ?? 0)} a year is added for every ${gb(amc.storage_step_gb)} more.`);
  terms.push("The AMC amount for a year follows the users and storage in use when it is due.");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(25, 25, 25);
  doc.text("How the price changes", M, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 70, 70);
  y += 5.5;
  for (const t of terms) {
    const lines = doc.splitTextToSize(`•  ${t}`, W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 4.4 + 1;
  }

  // ── Paying ──
  if (company.bankAccount) {
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(25, 25, 25);
    doc.text("Payment details", M, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(70, 70, 70);
    [company.bankName && `Bank: ${company.bankName}${company.bankBranch ? `, ${company.bankBranch}` : ""}`,
     `Account: ${company.bankAccount}`, company.bankIfsc && `IFSC: ${company.bankIfsc}`]
      .filter(Boolean).forEach((t, i) => doc.text(String(t), M, y + 5.5 + i * 4.5));
  }

  // ── Footer ──
  const H = doc.internal.pageSize.getHeight();
  doc.setDrawColor(225, 225, 225).line(M, H - 16, W - M, H - 16);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(140, 140, 140);
  doc.text(`${company.name} · AMC sheet for ${amc.client_company || amc.client_name || "the client"}`, M, H - 11);
  doc.text("Amounts in Indian Rupees, per year.", W - M, H - 11, { align: "right" });

  return doc.output("blob");
}
