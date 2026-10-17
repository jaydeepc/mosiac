import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, TabStopType, ShadingType } from "docx";
import type { ResumeDoc, Experience } from "@/lib/types";

const TEAL = "2F6F73";
const INK = "1E2430";
const MUTED = "5B6472";
const LINE = "E6E2DA";

function period(e: Experience) {
  if (!e.start && !e.end) return "";
  const present = !e.end || /present|now|current/i.test(e.end);
  const fmt = (s?: string) => (s ? s.slice(0, 4) : "");
  return `${fmt(e.start)}${e.start ? " – " : ""}${present ? "present" : fmt(e.end)}`;
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: TEAL, size: 17, characterSpacing: 60, font: "Arial" })],
  });
}
function body(text: string, opts: { bold?: boolean; color?: string; italic?: boolean; size?: number } = {}): TextRun {
  return new TextRun({ text, bold: opts.bold, italics: opts.italic, color: opts.color ?? INK, size: opts.size ?? 20, font: "Arial" });
}
function bullet(text: string, confirm?: boolean): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [body(text), ...(confirm ? [body("  [confirm]", { color: "C9693F", bold: true, size: 16 })] : [])] });
}

/** Builds an editable Word document with the same content and hierarchy as the PDF. */
export async function resumeToDocx(doc: ResumeDoc, photo?: { data: Buffer; mime: string }): Promise<Buffer> {
  const contact = [doc.contact.email, doc.contact.phone, doc.contact.linkedin?.replace(/^https?:\/\/(www\.)?/, ""), doc.contact.website?.replace(/^https?:\/\/(www\.)?/, ""), doc.location].filter(Boolean).join("   ·   ");

  const headerChildren: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: doc.name, font: "Georgia", size: 56, color: INK })], spacing: { after: 60 } }),
    new Paragraph({ children: [body(doc.headline, { bold: true, color: TEAL, size: 22 })], spacing: { after: 60 } }),
    new Paragraph({ children: [body(contact, { color: MUTED, size: 17 })], spacing: { after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 6 } } }),
  ];

  const main: (Paragraph | Table)[] = [];
  if (photo && doc.look === "visual") {
    const type = photo.mime.includes("png") ? "png" : photo.mime.includes("gif") ? "gif" : "jpg";
    main.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new ImageRun({ type, data: photo.data, transformation: { width: 84, height: 84 }, altText: { title: doc.name, description: "Photo", name: "photo" } })] })] }),
              new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, children: headerChildren }),
            ],
          }),
        ],
      }),
    );
  } else {
    main.push(...headerChildren);
  }

  main.push(heading("Summary"), new Paragraph({ children: [body(doc.summary)], spacing: { after: 80 }, alignment: AlignmentType.LEFT }));

  if (doc.charts.length) {
    for (const c of doc.charts) {
      main.push(heading(c.title));
      const max = Math.max(...c.series.map((s) => s.value), 1);
      main.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: c.series.map(
            (s) =>
              new TableRow({
                children: [
                  new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [body(s.label, { size: 17, color: MUTED })] })] }),
                  new TableCell({
                    width: { size: 62, type: WidthType.PERCENTAGE },
                    children: [
                      new Table({
                        width: { size: Math.max(6, Math.round((s.value / max) * 100)), type: WidthType.PERCENTAGE },
                        rows: [new TableRow({ children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: TEAL, color: TEAL }, children: [new Paragraph({ children: [body(" ", { size: 12 })] })] })] })],
                      }),
                    ],
                  }),
                  new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [body(`${formatValue(s.value, c.unit)}${s.confirm ? " [confirm]" : ""}`, { size: 17, bold: true })] })] }),
                ],
              }),
          ),
        }),
      );
      if (c.note) main.push(new Paragraph({ children: [body(c.note, { italic: true, color: "9A4A26", size: 15 })], spacing: { before: 40 } }));
    }
  }

  main.push(heading("Experience"));
  for (const e of doc.experience) {
    main.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
        children: [body(e.title, { bold: true }), body(`, ${e.company}${e.location ? ` · ${e.location}` : ""}`), body(`\t${period(e)}`, { color: MUTED })],
      }),
    );
    for (const b of e.bullets) main.push(bullet(b.text, b.confirm));
  }

  if (doc.education.length) {
    main.push(heading("Education"));
    for (const ed of doc.education) main.push(new Paragraph({ spacing: { after: 40 }, children: [body(ed.degree, { bold: true }), body(`, ${ed.school}${ed.year ? ` · ${ed.year}` : ""}`)] }));
  }
  const skills = doc.skills.length ? doc.skills : doc.strengths.map((s) => s.label);
  if (skills.length) main.push(heading("Skills"), new Paragraph({ children: [body(skills.join("  ·  "))] }));
  if (doc.strengths.length && doc.look === "visual") {
    main.push(heading("Strengths"));
    for (const s of doc.strengths) main.push(new Paragraph({ spacing: { after: 30 }, children: [body(s.label), body(`   ${"█".repeat(Math.max(1, Math.round(s.level / 10)))}${"░".repeat(10 - Math.max(1, Math.round(s.level / 10)))}`, { color: TEAL, size: 16 })] }));
  }
  const simple = (title: string, items: { text: string; year?: string; confirm?: boolean }[]) => {
    if (!items.length) return;
    main.push(heading(title));
    for (const s of items) main.push(bullet(`${s.text}${s.year ? ` (${s.year})` : ""}`, s.confirm));
  };
  simple("Speaking", doc.speaking);
  simple("Writing", doc.publications);
  simple("Certifications", doc.certifications);
  simple("Recognition", doc.awards);
  if (doc.languages.length) main.push(heading("Languages"), new Paragraph({ children: [body(doc.languages.join("  ·  "))] }));

  const d = new Document({
    creator: "Mosaic",
    title: `${doc.name} — ${doc.headline}`,
    styles: { default: { document: { run: { font: "Arial", size: 20, color: INK } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1100, bottom: 1000, left: 1100 } } }, children: main }],
  });
  return Buffer.from(await Packer.toBuffer(d));
}

function formatValue(v: number, unit?: string) {
  const abs = Math.abs(v);
  let s: string;
  if (abs >= 1_000_000) s = `${(v / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  else if (abs >= 1000) s = `${(v / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  else s = `${Math.round(v * 10) / 10}`;
  if (unit === "%") return `${s}%`;
  if (unit && unit !== "count") return `${s} ${unit}`;
  return s;
}
