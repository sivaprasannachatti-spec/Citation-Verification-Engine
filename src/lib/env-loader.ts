import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  console.log('ENV PATH:', envPath);
  console.log('EXISTS:', fs.existsSync(envPath));
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r\n|\r|\n/)) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      const match = trimmedLine.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        console.log(`SETTING: ${key} = ${value.substring(0, 15)}...`);
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.error('Failed to load .env.local in env-loader:', e);
}

