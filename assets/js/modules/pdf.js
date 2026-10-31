/**
 * SkillSync - Client-Side PDF.js Parser Module
 * File: assets/js/modules/pdf.js
 */

export async function parsePdfDocument(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js library is not available.');
  }

  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageStrings = textContent.items.map(item => item.str);
    fullText += pageStrings.join(' ') + '\n';
  }

  return {
    text: fullText.replace(/[ \t]+/g, ' ').trim(),
    numPages: pdf.numPages
  };
}
