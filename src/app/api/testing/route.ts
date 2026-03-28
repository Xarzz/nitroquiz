import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'testing.txt');
    const content = await readFile(filePath, 'utf8');
    
    return NextResponse.json({
      testing: content.trim()
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
