/**
 * SkillSync - Export & Clipboard Module
 * File: assets/js/modules/export.js
 */

export async function exportReportToPdf(elementId, filename = 'SkillSync_Evaluation_Report.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Report element #${elementId} not found.`);
  }

  if (typeof html2pdf === 'undefined') {
    throw new Error('html2pdf.js library is not available.');
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  return html2pdf().set(opt).from(element).save();
}

export async function copySummaryToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const tempTextArea = document.createElement('textarea');
  tempTextArea.value = text;
  document.body.appendChild(tempTextArea);
  tempTextArea.select();
  document.execCommand('copy');
  document.body.removeChild(tempTextArea);
}
