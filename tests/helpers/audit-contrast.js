const fs = require('fs');
const path = require('path');

function getFiles(dir, exts) {
  let res = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) res = res.concat(getFiles(full, exts));
    else if (exts.some(e => f.endsWith(e))) res.push(full);
  }
  return res;
}

const allFiles = getFiles('FE', ['.html', '.js', '.css']);
console.log('Auditing files for contrast issues...');

// Check inline styles in HTML/JS
for (const f of allFiles.filter(f => f.endsWith('.html') || f.endsWith('.js'))) {
  const content = fs.readFileSync(f, 'utf8');
  const styleRegex = /style="([^"]*background[^"]*)"/gi;
  let m;
  while ((m = styleRegex.exec(content)) !== null) {
    const st = m[1];
    // check if it has dark text with dark/saturated background, or dark background without explicit white color
    const hasDarkBg = /(#1d4ed8|#2563eb|#1e40af|#0f172a|#1e293b|#4338ca|#6366f1|#059669|#dc2626|#7c3aed)/i.test(st);
    const hasColor = /color\s*:\s*([^;"]+)/i.test(st);
    const colorMatch = st.match(/color\s*:\s*([^;"]+)/i);
    const colorVal = colorMatch ? colorMatch[1].trim() : null;
    
    if (hasDarkBg) {
      if (!hasColor) {
        // Missing explicit color on dark background! Inherits text color (which is dark in light mode: #0f172a / black!)
        console.log('[WARN MISSING COLOR ON DARK BG]', path.relative('FE', f), ':', st);
      } else if (/(#000|black|#0f172a|#1e293b|#334155|#475569|#64748b)/i.test(colorVal)) {
        console.log('[FAIL DARK TEXT ON DARK BG]', path.relative('FE', f), ':', st);
      }
    }
  }
}
