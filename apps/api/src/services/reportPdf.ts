import { getAssessmentSummary } from './reportSummary';

export async function generateAssessmentPdf(assessmentId: string): Promise<Uint8Array> {
  // Lazy-load pdf-lib to reduce cold start cost
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // Fetch aggregates via shared summary service
  const summary = await getAssessmentSummary(assessmentId);

  // Header
  let y = 800;
  const draw = (text: string, size = 12, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x: 50, y, size, font, color });
    y -= size + 8;
  };
  draw('Juno Quick Screen — Candidate Report', 18);
  draw(`Assessment ID: ${assessmentId}`, 10, rgb(0.2, 0.2, 0.2));
  y -= 8;

  // Scores
  draw('Scores', 14);
  draw(`Total Score: ${summary.totalScore}`);
  draw(`Integrity Band: ${summary.integrity.band}`);
  y -= 8;
  draw('Integrity Flags:', 12);
  if (summary.integrity.reasons.length === 0) {
    draw('- None observed');
  } else {
    for (const r of summary.integrity.reasons.slice(0, 5)) {
      draw(`- ${r}`);
    }
  }

  return await pdf.save();
}
