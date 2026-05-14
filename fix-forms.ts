import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src/pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

files.forEach(file => {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Use /g and /s flags to handle multiline
  content = content.replace(/<input([^>]*?)className="(.*?)"([^>]*?)>/gs, (match, p1, p2, p3) => {
    if (!p2.includes('bg-[#0B0E14]') && !p2.includes('bg-slate') && !p2.includes('bg-transparent')) {
      return `<input${p1}className="${p2} bg-[#0B0E14] text-slate-100"${p3}>`;
    }
    return match;
  });
  
  content = content.replace(/<select([^>]*?)className="(.*?)"([^>]*?)>/gs, (match, p1, p2, p3) => {
    if (!p2.includes('bg-[#0B0E14]') && !p2.includes('bg-slate')) {
      return `<select${p1}className="${p2} bg-[#0B0E14] text-slate-100"${p3}>`;
    }
    return match;
  });

  content = content.replace(/<textarea([^>]*?)className="(.*?)"([^>]*?)>/gs, (match, p1, p2, p3) => {
    if (!p2.includes('bg-[#0B0E14]') && !p2.includes('bg-slate')) {
      return `<textarea${p1}className="${p2} bg-[#0B0E14] text-slate-100"${p3}>`;
    }
    return match;
  });

  fs.writeFileSync(filePath, content);
  console.log(`Fixed forms ${file}`);
});
