import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src/pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

const replacements = [
  { from: /bg-slate-800\/500/g, to: 'bg-slate-900' },
  { from: /bg-slate-7000/g, to: 'bg-slate-700' }
];

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  
  // also inject input styling
  content = content.replace(/<input(.*?)className="(.*?)"(.*?)>/g, (match, p1, p2, p3) => {
    if (!p2.includes('bg-[#0B0E14]') && !p2.includes('bg-slate')) {
      return `<input${p1}className="${p2} bg-[#0B0E14] text-slate-100"${p3}>`;
    }
    return match;
  });
  
  // also select tags
  content = content.replace(/<select(.*?)className="(.*?)"(.*?)>/g, (match, p1, p2, p3) => {
    if (!p2.includes('bg-[#0B0E14]') && !p2.includes('bg-slate')) {
        return `<select${p1}className="${p2} bg-[#0B0E14] text-slate-100"${p3}>`;
    }
    return match;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});
