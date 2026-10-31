/**
 * SkillSync - Image OCR & Multimodal Vision Module
 * File: assets/js/modules/ocr.js
 */

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function transcribeResumeImage(file, authToken) {
  const base64Data = await fileToBase64(file);
  let extractedText = '';

  // 1. Backend Gemini 1.5 Flash Vision OCR
  try {
    const response = await fetch('ocr.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken || 'demo-token'}`
      },
      body: JSON.stringify({ image: base64Data })
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success && json.text) {
        extractedText = json.text;
      }
    }
  } catch (apiErr) {
    console.warn('[OCR Module] Backend OCR unavailable, trying client-side engine...', apiErr);
  }

  // 2. Client-side Tesseract.js OCR fallback
  if (!extractedText && typeof Tesseract !== 'undefined') {
    const ocrResult = await Tesseract.recognize(file, 'eng');
    extractedText = ocrResult?.data?.text || '';
  }

  return extractedText ? extractedText.replace(/[ \t]+/g, ' ').trim() : '';
}
