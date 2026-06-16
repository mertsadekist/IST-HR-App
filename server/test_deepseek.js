import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import { parseEmployeeDocument } from './services/deepseekService.js';

async function test() {
  console.log('Testing deepseek parseEmployeeDocument...');
  try {
    const result = await parseEmployeeDocument('Name: Mert Sadek\nEmail: mert@test.com\nPhone: +971501234567\nNationality: Egyptian', 'CV');
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
