// Google Apps Script retire les commentaires du JavaScript des pages HTML sans tenir compte
// des chaînes de caractères : un « // » dans 'https://…' coupe la ligne et bloque toute la page.
// Ce test refait ce nettoyage puis vérifie que le code est toujours valide.
const fs = require('fs'), vm = require('vm');
let ko = 0;
for (const f of fs.readdirSync('apps-script').filter(n => n.endsWith('.html'))) {
  const html = fs.readFileSync('apps-script/' + f, 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((code, i) => {
    const nettoye = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
    try { new vm.Script(nettoye, { filename: f + ' (script ' + (i + 1) + ', après retrait des commentaires)' }); console.log('✓ ' + f + ' script ' + (i + 1)); }
    catch (e) {
      ko++;
      console.log('✗ ' + f + ' script ' + (i + 1) + ' : ' + e.message);
      code.split('\n').forEach((l, n) => { if (/['"`][^'"`\s]*:\/\//.test(l)) console.log('   « // » dans une chaîne, ligne ' + (n + 1) + ' du script : ' + l.trim().slice(0, 120)); });
    }
  });
}
process.exit(ko ? 1 : 0);
