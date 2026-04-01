const fs = require('fs');
const target = require('path').join(__dirname, 'src', 'components', 'DugoutHeroCore.jsx');
let content = fs.readFileSync(target, 'utf8');

// Find the line that has <PrintView
let res = content.replace(/<\/div>\s*<PrintView/g, '  </div>\n      </div>\n      <PrintView');
fs.writeFileSync(target, res, 'utf8');
console.log('Fixed syntax error!');
