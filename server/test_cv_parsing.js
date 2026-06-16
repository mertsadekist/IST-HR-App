import { extractTextFromFile } from './services/cvParserService.js';
import { parseEmployeeDocument } from './services/deepseekService.js';
import path from 'path';
// Credentials come from .env via the shared pool — never hardcode secrets here.
import pool from './config/db.js';

async function main() {
  console.log('Testing CV parser script starting...');
  const cvPath = path.resolve('../Mert Sadek CV .pdf');
  console.log('Reading text from PDF...');
  const text = await extractTextFromFile(cvPath, '.pdf');
  console.log(`Extracted ${text.length} characters.`);

  console.log('Parsing text with DeepSeek AI service...');
  const parsed = await parseEmployeeDocument(text, 'CV');
  console.log('\nParsed result from AI:');
  console.log(JSON.stringify(parsed, null, 2));

  // Let's find a candidate to update
  const [candidates] = await pool.query('SELECT id, first_name, last_name, email FROM candidates LIMIT 5');
  console.log('\nCurrent candidates in DB:', candidates);

  if (candidates.length > 0) {
    const candidateId = candidates[0].id;
    console.log(`Updating candidate #${candidateId} (${candidates[0].first_name} ${candidates[0].last_name}) with parsed data...`);

    const updateData = {
      cv_file_name: 'Mert Sadek CV .pdf',
      cv_text: text,
      ai_analysis: JSON.stringify(parsed)
    };

    if (parsed.first_name) updateData.first_name = parsed.first_name;
    if (parsed.last_name) updateData.last_name = parsed.last_name;
    if (parsed.email) updateData.email = parsed.email;
    if (parsed.phone) updateData.phone = parsed.phone;
    if (parsed.nationality) updateData.nationality = parsed.nationality;

    await pool.query('UPDATE candidates SET ? WHERE id = ?', [updateData, candidateId]);
    console.log('Database updated successfully!');

    // Read it back
    const [[updated]] = await pool.query('SELECT id, first_name, last_name, email, phone, nationality, ai_analysis FROM candidates WHERE id = ?', [candidateId]);
    console.log('\nRetrieved updated candidate from DB:');
    console.log(updated);
  } else {
    console.log('No candidates found in DB. Creating a new mock candidate to test...');
    // Get a company
    const [[comp]] = await pool.query('SELECT id FROM companies LIMIT 1');
    if (!comp) {
      console.log('No companies found. Cannot create mock candidate.');
    } else {
      const newCand = {
        first_name: parsed.first_name || 'Mert',
        last_name: parsed.last_name || 'Sadek',
        email: parsed.email || 'mounthir.sadek.ms@gmail.com',
        phone: parsed.phone || '00971504175107',
        nationality: parsed.nationality || 'Syrian',
        company_id: comp.id,
        cv_file_name: 'Mert Sadek CV .pdf',
        cv_text: text,
        ai_analysis: JSON.stringify(parsed)
      };
      const [res] = await pool.query('INSERT INTO candidates SET ?', [newCand]);
      console.log(`Mock candidate created successfully with ID ${res.insertId}!`);
    }
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
});
