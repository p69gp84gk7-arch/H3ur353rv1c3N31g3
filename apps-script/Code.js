/**
 * Point d'entrée : menu du Google Sheet et page web du planning.
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

/** Page web du planning (ordinateur et smartphone). */
function doGet() {
  verifierBaseSiBesoin_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Heures Service Neige')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
