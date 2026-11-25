/**
 * Mise à jour automatique du Google Sheet.
 * Appelée à l'ouverture du Sheet et de la page web : si la structure a changé
 * (CONFIG.SCHEMA_VERSION augmenté), les onglets et colonnes manquants sont créés.
 */

const FORMATS = { date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm' };

/** Convertit 'jj/mm/aaaa' en vraie date pour le Sheet. */
function texteVersDate_(v) {
  if (typeof v !== 'string') return v;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : v;
}

function ouvrirBase_() {
  // Le programme est rattaché au Sheet : on l'utilise directement (marche aussi à l'ouverture
  // du Sheet, où Google refuse openById tant que l'autorisation n'a pas été donnée).
  const actif = SpreadsheetApp.getActiveSpreadsheet();
  if (actif && actif.getId() === CONFIG.SHEET_ID) return actif;
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

/** Ne fait rien si la base est déjà à jour (rapide). */
function verifierBaseSiBesoin_() {
  const props = PropertiesService.getScriptProperties();
  if (Number(props.getProperty('SCHEMA_VERSION')) === CONFIG.SCHEMA_VERSION) return null;
  return mettreAJourBase();
}

/** Crée les onglets / colonnes manquants. Ne supprime jamais rien. */
function mettreAJourBase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = ouvrirBase_();
    const changements = [];

    SCHEMA.forEach(def => {
      let sh = ss.getSheetByName(def.name);
      const nouveau = !sh;
      if (nouveau) {
        sh = ss.insertSheet(def.name);
        changements.push('onglet « ' + def.name + ' » créé');
      }

      // Colonnes manquantes ajoutées à droite
      const nbCol = sh.getLastColumn();
      const entetes = nbCol ? sh.getRange(1, 1, 1, nbCol).getValues()[0].map(String) : [];
      const manquantes = def.columns.filter(c => entetes.indexOf(c.key) === -1);
      if (manquantes.length) {
        sh.getRange(1, entetes.length + 1, 1, manquantes.length).setValues([manquantes.map(c => c.key)]);
        if (!nouveau) changements.push(manquantes.length + ' colonne(s) ajoutée(s) dans « ' + def.name + ' »');
      }

      // Mise en forme de l'en-tête et des dates
      const toutes = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      sh.getRange(1, 1, 1, toutes.length).setFontWeight('bold').setBackground('#0f2a4a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      def.columns.forEach(c => {
        if (!c.type) return;
        const col = toutes.indexOf(c.key) + 1;
        sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat(FORMATS[c.type]);
      });

      // Valeurs de départ, seulement pour un onglet tout neuf
      if (nouveau && def.defaults && def.defaults.length) {
        const lignes = def.defaults.map(r => r.map(texteVersDate_));
        sh.getRange(2, 1, lignes.length, lignes[0].length).setValues(lignes);
      }
    });

    // L'onglet vide créé avec le fichier (« Feuille 1 » / « Sheet1 ») est retiré s'il est vide
    ['Feuille 1', 'Feuille1', 'Sheet1'].forEach(n => {
      const sh = ss.getSheetByName(n);
      if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
    });

    if (changements.length) journaliser_('Mise à jour de la base (v' + CONFIG.SCHEMA_VERSION + ')', changements.join(' ; '));
    PropertiesService.getScriptProperties().setProperty('SCHEMA_VERSION', String(CONFIG.SCHEMA_VERSION));
    return changements;
  } finally {
    lock.releaseLock();
  }
}

function journaliser_(action, details) {
  const sh = ouvrirBase_().getSheetByName('Journal');
  if (!sh) return;
  let qui = '';
  try { qui = Session.getActiveUser().getEmail(); } catch (e) { /* inconnu */ }
  sh.appendRow([new Date(), qui, action, details || '']);
}
