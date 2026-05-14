import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src/pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

const replacements = [
  { from: /text-gray-900/g, to: 'text-slate-100' },
  { from: /text-gray-500/g, to: 'text-slate-400' },
  { from: /text-gray-700/g, to: 'text-slate-300' },
  { from: /text-gray-400/g, to: 'text-slate-500' },
  { from: /text-gray-300/g, to: 'text-slate-600' },
  { from: /bg-gray-50/g, to: 'bg-slate-800/50' },
  { from: /bg-gray-100/g, to: 'bg-slate-800' },
  { from: /bg-gray-200/g, to: 'bg-slate-700' },
  { from: /bg-white/g, to: 'bg-[#0B0E14]' },
  { from: /border-gray-200/g, to: 'border-slate-800' },
  { from: /border-gray-300/g, to: 'border-slate-700' },
  { from: /divide-gray-200/g, to: 'divide-slate-800' }
];

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});
