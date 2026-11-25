/**
 * Point d'entrée.
 * Étape actuelle : socle technique (base de données + mise à jour automatique).
 * L'interface de planning sera ajoutée quand la maquette sera validée.
 */

/** Menu dans le Google Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Heures Service Neige')
    .addItem('Vérifier / mettre à jour la base', 'menuMettreAJour')
    .addToUi();
  try { verifierBaseSiBesoin_(); } catch (e) { console.warn(e); }
}

function menuMettreAJour() {
  const changements = mettreAJourBase();
  SpreadsheetApp.getUi().alert(changements.length
    ? 'Base mise à jour :\n• ' + changements.join('\n• ')
    : 'La base est déjà à jour.');
}

/** Page web (pour l'instant : état de la base). */
function doGet() {
  verifierBaseSiBesoin_();
  const ss = ouvrirBase_();
  const onglets = ss.getSheets().map(s => s.getName() + ' (' + Math.max(0, s.getLastRow() - 1) + ' ligne(s))');
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:15px system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px">' +
    '<h2 style="color:#0f2a4a">❄ Heures Service Neige</h2>' +
    '<p>Le programme fonctionne et la base de données est prête (version ' + CONFIG.SCHEMA_VERSION + ').</p>' +
    '<ul><li>' + onglets.join('</li><li>') + '</li></ul>' +
    '<p style="color:#6b7280">Le planning sera ajouté ici après validation de la maquette.</p></div>';
  return HtmlService.createHtmlOutput(html).setTitle('Heures Service Neige');
}
