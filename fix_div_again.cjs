const fs = require('fs');
const target = require('path').join(__dirname, 'src', 'components', 'DugoutHeroCore.jsx');
let content = fs.readFileSync(target, 'utf8');

// Find the line that has <PrintView inline={true}
let res = content.replace(/                      <\/div>\r?\n      <\/div>\r?\n      <PrintView selectedGame=\{selectedGame\} players=\{players\} seasonConfig=\{seasonConfig\} inline=\{true\} \/>/g, '                    </div>\n                    <PrintView selectedGame={selectedGame} players={players} seasonConfig={seasonConfig} inline={true} />');

fs.writeFileSync(target, res, 'utf8');
console.log('Fixed syntax error!');
