import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amount);
}

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeSupplyCode(s: string): string {
  let trimmed = s.trim().toUpperCase();
  if (!trimmed) return "";
  if (trimmed.startsWith('SUM-')) {
    trimmed = trimmed.substring(4);
  }
  // Remove leading zeros as long as the string has something left
  trimmed = trimmed.replace(/^0+(?!$)/, '');
  return `SUM-${trimmed}`;
}

export const render3DPieChartToDataURL = (
  data: { name: string; value: number; color: string }[],
  title: string
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 450;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // White background for the PDF
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width / 2, 40);

  const cx = canvas.width / 2;
  const cy = 200;
  const rx = 180;
  const ry = 90;
  const h = 45;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return '';

  const darkenColor = (color: string, amount: number) => {
    let c = color.substring(1);
    // Expand 3-digit hex
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    let rgb = parseInt(c, 16);
    let r = Math.max(0, (rgb >> 16) - amount);
    let g = Math.max(0, ((rgb >> 8) & 0x00FF) - amount);
    let b = Math.max(0, (rgb & 0x0000FF) - amount);
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
  };

  // Draw layers from bottom to top
  for (let y = cy + h; y >= cy; y -= 1) {
    let currentAngle = 0;
    data.forEach(slice => {
      const sliceAngle = (slice.value / total) * Math.PI * 2;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.ellipse(cx, y, rx, ry, 0, startAngle, endAngle);
      ctx.lineTo(cx, y);
      
      if (y > cy) {
        ctx.fillStyle = darkenColor(slice.color, 40);
      } else {
        ctx.fillStyle = slice.color;
      }
      ctx.fill();
      
      if (y === cy) {
         ctx.strokeStyle = '#ffffff';
         ctx.lineWidth = 1.5;
         ctx.stroke();
      }
    });
  }

  // Draw legends - wrapped if needed
  ctx.textAlign = 'left';
  
  const legendItems = data.map(slice => {
    const pct = ((slice.value / total) * 100).toFixed(1);
    const text = `${slice.name} (${pct}%)`;
    ctx.font = '14px sans-serif';
    const width = 15 + 10 + ctx.measureText(text).width + 20; // box + space + text + padding
    return { text, color: slice.color, width };
  });

  // The 3D pie's bottom edge reaches cy + h + ry = 200 + 45 + 90 = 335.
  // Start the legend below this point.
  let legendY = cy + h + ry + 30; // 365
  
  // Arrange items in rows
  let rows: {text: string, color: string, width: number}[][] = [[]];
  let currentRowWidth = 0;
  
  legendItems.forEach(item => {
    if (currentRowWidth + item.width > canvas.width - 40 && rows[rows.length - 1].length > 0) {
       rows.push([item]);
       currentRowWidth = item.width;
    } else {
       rows[rows.length - 1].push(item);
       currentRowWidth += item.width;
    }
  });

  rows.forEach(row => {
    const rowWidth = row.reduce((sum, item) => sum + item.width, 0);
    let legendX = (canvas.width - rowWidth) / 2;
    
    row.forEach(item => {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY - 12, 15, 15);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(item.text, legendX + 25, legendY);
        legendX += item.width;
    });
    legendY += 25;
  });

  return canvas.toDataURL('image/png');
};
