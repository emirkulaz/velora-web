import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const allowedExtensions = new Set(['.html', '.js', '.css', '.json', '.webmanifest']);
const forbidden = [/\blocalhost\b/i, /\b127\.0\.0\.1\b/];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

const files = (await listFiles('dist')).filter((file) =>
  allowedExtensions.has(extname(file)),
);
const violations = [];

for (const file of files) {
  const contents = await readFile(file, 'utf8');
  if (forbidden.some((pattern) => pattern.test(contents))) violations.push(file);
}

if (violations.length > 0) {
  console.error('Production bundle contains a local-only host in:', violations);
  process.exitCode = 1;
} else {
  console.log(`Production bundle check passed (${files.length} files scanned).`);
}

