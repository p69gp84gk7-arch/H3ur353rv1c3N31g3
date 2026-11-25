/**
 * Mise à jour automatique du Google Sheet.
 * Appelée à l'ouverture du Sheet et de la page web : si la structure a changé
 * (CONFIG.SCHEMA_VERSION augmenté), les onglets et colonnes manquants sont créés.
 */

const FORMATS = { date: 'dd/mm/yyyy', datetime: 'dd/mm/yyyy hh:mm', texte: '@' };

/** Convertit 'jj/mm/aaaa' en vraie date pour le Sheet. */
function texteVersDate_(v) {
  if (typeof v !== 'string') return v;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : v;
}

function ouvrirBase_() {
  // Le programme est rattaché au Sheet : on l'utilise directement (marche aussi à l'ouverture
  // du Sheet, où Google refuse openById tant que l'autorisation n'a pas été donnée).
  // Chaque chef utilise la page avec son propre compte : il faut que ce compte puisse
  // MODIFIER le Google Sheet (donner l'accès = partager le Sheet en « Éditeur »).
  let ss = null, raison = '';
  try {
    const actif = SpreadsheetApp.getActiveSpreadsheet();
    if (actif && actif.getId() === CONFIG.SHEET_ID) ss = actif;
  } catch (e) { /* pas de Sheet actif (page web) */ }
  if (!ss) {
    try { ss = SpreadsheetApp.openById(CONFIG.SHEET_ID); } catch (e) { raison = e && e.message ? e.message : String(e); }
  }
  if (!ss) throw new Error(messageRefus_(raison));
  return ss;
}

/** Message de refus : dit quel compte Google est utilisé, pour repérer un mauvais compte. */
function messageRefus_(raison) {
  const email = utilisateur_();
  return 'Accès refusé' + (email ? ' pour le compte Google « ' + email + ' »' : '') + '. ' +
    'Ce compte doit pouvoir modifier le Google Sheet « Heures Service Neige – Base de données » ' +
    '(à demander au chef de service). ' +
    "Si plusieurs comptes Google sont connectés sur cet appareil, ouvrez la page avec le bon compte " +
    '(par exemple dans une fenêtre de navigation privée, en vous connectant uniquement avec ce compte).' +
    (raison ? ' [Détail technique : ' + raison + ']' : '');
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
    const avant = Number(PropertiesService.getScriptProperties().getProperty('SCHEMA_VERSION')) || 0;

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

    if (avant > 0 && avant < CONFIG.SCHEMA_VERSION) migrer_(ss, avant, changements);

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

/** Corrections de données lors d'un changement de version. Ajoute ou corrige, ne supprime jamais. */
function migrer_(ss, avant, changements) {
  if (avant < 5) remplirSiVide_(ss, 'Types', 'ID', 'Abréviations', {"travail_jour": "", "travail_nuit": "", "formation": "FORM, FORMATION", "astreinte": "AST, ASTREINTE", "repos_hebdo": "RH, REPOS", "ferie": "JF, FERIE", "conges": "CP, CA, CONGES", "recup": "REC, RECUP", "maladie": "MAL, MALADIE, ABSENCE", "soli": "SOLI, SOLIDARITE"}, changements);
  if (avant < 4) { // plafond annuel d'heures sup (l'onglet Périodes est créé avec ses valeurs de départ)
    const d = SCHEMA.filter(x => x.name === 'Règles')[0];
    ajouterSiAbsent_(ss, 'Règles', 'Clé', d.defaults.map(l => { const o = {}; d.columns.forEach((c, i) => { o[c.key] = texteVersDate_(l[i]); }); return o; }), changements);
  }
  if (avant < 3) {
    const def = nom => SCHEMA.filter(d => d.name === nom)[0];
    const objet = (d, ligne) => { const o = {}; d.columns.forEach((c, i) => { o[c.key] = texteVersDate_(ligne[i]); }); return o; };
    ajouterSiAbsent_(ss, 'Types', 'ID', def('Types').defaults.map(l => objet(def('Types'), l)), changements);           // type SOLI
    ajouterSiAbsent_(ss, 'Règles', 'Clé', def('Règles').defaults.map(l => objet(def('Règles'), l)), changements);     // objectif annuel
    ajouterSiAbsent_(ss, 'Fériés', 'Date', def('Fériés').defaults.map(l => objet(def('Fériés'), l)), changements);    // fériés de juin à nov. 2026
    // Saison = année de contrat (01/06 → 31/05), seulement si les anciennes dates par défaut sont encore là
    const sh = ss.getSheetByName('Règles');
    if (sh && sh.getLastRow() > 1) {
      const data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
      data.forEach((r, i) => {
        const v = cleTexte_(r[1]);
        if (r[0] === 'saisonDebut' && v === '2026-11-23') { sh.getRange(i + 2, 2).setValue(new Date(2026, 5, 1)); changements.push('saison : début au 01/06/2026'); }
        if (r[0] === 'saisonFin' && v === '2027-11-21') { sh.getRange(i + 2, 2).setValue(new Date(2027, 4, 31)); changements.push('saison : fin au 31/05/2027'); }
      });
    }
  }
}

/** Remplit une colonne pour les lignes connues où elle est vide (ne remplace jamais une valeur saisie). */
function remplirSiVide_(ss, nomOnglet, colCle, colValeur, valeurs, changements) {
  const sh = ss.getSheetByName(nomOnglet);
  if (!sh || sh.getLastRow() < 2) return;
  const tete = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const iK = tete.indexOf(colCle), iV = tete.indexOf(colValeur);
  if (iK === -1 || iV === -1) return;
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, tete.length).getValues();
  let n = 0;
  data.forEach((r, i) => { const v = valeurs[String(r[iK])]; if (v && String(r[iV]).trim() === '') { sh.getRange(i + 2, iV + 1).setValue(v); n++; } });
  if (n) changements.push(n + ' valeur(s) « ' + colValeur + ' » ajoutée(s) dans « ' + nomOnglet + ' »');
}

function cleTexte_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v); }

/** Ajoute à un onglet les lignes dont la clé n'existe pas encore. */
function ajouterSiAbsent_(ss, nomOnglet, colonneCle, lignes, changements) {
  const sh = ss.getSheetByName(nomOnglet);
  if (!sh) return;
  const tete = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const iCle = tete.indexOf(colonneCle), n = sh.getLastRow();
  if (iCle === -1) return;
  const cles = n > 1 ? sh.getRange(2, iCle + 1, n - 1, 1).getValues().map(r => cleTexte_(r[0])) : [];
  const nouvelles = lignes.filter(o => cles.indexOf(cleTexte_(o[colonneCle])) === -1);
  if (!nouvelles.length) return;
  sh.getRange(n + 1, 1, nouvelles.length, tete.length).setValues(nouvelles.map(o => tete.map(h => (o[h] === undefined ? '' : o[h]))));
  changements.push(nouvelles.length + ' ligne(s) ajoutée(s) dans « ' + nomOnglet + ' »');
}

function journaliser_(action, details) {
  const sh = ouvrirBase_().getSheetByName('Journal');
  if (!sh) return;
  let qui = '';
  try { qui = Session.getActiveUser().getEmail(); } catch (e) { /* inconnu */ }
  sh.appendRow([new Date(), qui, action, details || '']);
}
