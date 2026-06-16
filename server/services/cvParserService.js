import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

export const extractTextFromFile = async (filePath, ext) => {
  try {
    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    }

    if (ext === '.doc' || ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }

    throw new Error(`Unsupported file type: ${ext}`);
  } catch (err) {
    console.error(`Error extracting text from ${ext} file:`, err);
    return `[Text extraction failed for ${ext} file]`;
  }
};
