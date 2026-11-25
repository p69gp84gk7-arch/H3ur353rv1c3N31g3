/**
 * Échanges entre la page web et le Google Sheet.
 * Les dates voyagent en texte : 'aaaa-mm-jjThh:mm' (créneaux), 'aaaa-mm-jj' (fériés),
 * 'jj/mm/aaaa' (dates de saison dans les règles).
 */

const COL_PAUSE = 'Pause (min, vide = auto)';

function tz_() { return Session.getScriptTimeZone() || 'Europe/Paris'; }
function versTexte_(v, motif) { return v instanceof Date ? Utilities.formatDate(v, tz_(), motif) : String(v == null ? '' : v); }
function versDate_(texte, motif) { return Utilities.parseDate(texte, tz_(), motif); }
function vrai_(v) { return v === true || /^(true|vrai|oui|1)$/i.test(String(v).trim()); }
function utilisateur_() { try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; } }
/** Empêche qu'un texte saisi soit pris pour une formule par le Sheet. */
function texteSur_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }

function feuille_(nom) {
  const sh = ouvrirBase_().getSheetByName(nom);
  if (!sh) throw new Error('Onglet « ' + nom + ' » introuvable : utilisez le menu « Vérifier / mettre à jour la base ».');
  return sh;
}
function entetes_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }

/** Lit un onglet en liste d'objets { en-tête: valeur }. */
function lireTable_(nom) {
  const sh = feuille_(nom), tete = entetes_(sh), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, tete.length).getValues()
    .filter(r => r.some(c => c !== '' && c !== null))
    .map(r => { const o = {}; tete.forEach((h, i) => { o[h] = r[i]; }); return o; });
}

/** Remplace toutes les lignes d'un onglet (les colonnes inconnues restent vides). */
function ecrireTable_(nom, objets) {
  const sh = feuille_(nom), tete = entetes_(sh), n = sh.getLastRow();
  const lignes = objets.map(o => tete.map(h => (o[h] === undefined || o[h] === null ? '' : texteSur_(o[h]))));
  if (n > 1) sh.getRange(2, 1, n - 1, tete.length).clearContent();
  if (lignes.length) sh.getRange(2, 1, lignes.length, tete.length).setValues(lignes);
}

function avecVerrou_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ===================== Lecture ===================== */

function chargerDonnees() {
  verifierDroitModification_();
  verifierBaseSiBesoin_();
  const ss = ouvrirBase_();
  const emps = lireTable_('Salariés').filter(r => r['ID'] !== '').map(r => ({
    id: String(r['ID']), prenom: String(r['Prénom']), nom: String(r['Nom']), station: String(r['Station']),
    poste: String(r['Poste']), nuit: vrai_(r['Travailleur de nuit']), actif: vrai_(r['Actif']),
  }));
  const stations = lireTable_('Stations').sort((a, b) => (Number(a['Ordre']) || 0) - (Number(b['Ordre']) || 0)).map(r => String(r['Nom']));
  const types = lireTable_('Types').map(r => ({
    id: String(r['ID']), nom: String(r['Nom']), couleur: String(r['Couleur']) || '#2f6fdb',
    mode: String(r['Saisie']) === 'Journée entière' ? 'jour' : 'heures',
    compteur: vrai_(r['Compte dans les 35h']), forfait: Number(r['Forfait par jour (h)']) || 0,
    effectif: vrai_(r['Temps de travail effectif']), deduit: vrai_(r['Puise dans le solde']),
  }));
  const rules = {};
  lireTable_('Règles').forEach(r => {
    const v = r['Valeur'];
    rules[String(r['Clé'])] = v instanceof Date ? versTexte_(v, 'dd/MM/yyyy') : (v !== '' && !isNaN(Number(v)) ? Number(v) : String(v));
  });
  const feries = lireTable_('Fériés').filter(r => r['Date'] instanceof Date).map(r => ({
    d: versTexte_(r['Date'], 'yyyy-MM-dd'), nom: String(r['Nom']), chome: vrai_(r['Chômé']),
  }));
  const creneaux = lireTable_('Créneaux').filter(r => r['ID'] !== '' && r['Début'] instanceof Date && r['Fin'] instanceof Date).map(r => ({
    id: String(r['ID']), emp: String(r['ID salarié']), type: String(r['Type']),
    debut: versTexte_(r['Début'], "yyyy-MM-dd'T'HH:mm"), fin: versTexte_(r['Fin'], "yyyy-MM-dd'T'HH:mm"),
    pause: r[COL_PAUSE] === '' || r[COL_PAUSE] === null ? null : Number(r[COL_PAUSE]),
  }));
  return {
    emps, stations, types, rules, feries, creneaux,
    utilisateur: utilisateur_(), sheetUrl: ss.getUrl(), aujourdhui: versTexte_(new Date(), 'yyyy-MM-dd'),
  };
}

/* ===================== Enregistrement des créneaux ===================== */

const RE_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** changements = { upserts: [{id, emp, type, debut, fin, pause}], deletes: [id] } */
function enregistrerCreneaux(changements) {
  const ups = (changements && changements.upserts) || [], dels = (changements && changements.deletes) || [];
  ups.forEach(c => {
    if (!c || !c.id || !c.emp || !c.type || !RE_DT.test(c.debut) || !RE_DT.test(c.fin)) throw new Error('Créneau invalide : ' + JSON.stringify(c));
  });
  return avecVerrou_(() => {
    const sh = feuille_('Créneaux'), tete = entetes_(sh), n = sh.getLastRow(), col = h => tete.indexOf(h);
    const iId = col('ID'), iDeb = col('Début');
    let data = n > 1 ? sh.getRange(2, 1, n - 1, tete.length).getValues() : [];
    const aSuppr = new Set(dels.map(String));
    data = data.filter(r => r[iId] !== '' && !aSuppr.has(String(r[iId])));
    const pos = new Map(data.map((r, i) => [String(r[iId]), i]));
    const maintenant = new Date(), qui = utilisateur_();
    ups.forEach(c => {
      const existe = pos.has(c.id), r = existe ? data[pos.get(c.id)] : new Array(tete.length).fill('');
      r[iId] = c.id; r[col('ID salarié')] = String(c.emp); r[col('Type')] = String(c.type);
      r[iDeb] = versDate_(c.debut, "yyyy-MM-dd'T'HH:mm"); r[col('Fin')] = versDate_(c.fin, "yyyy-MM-dd'T'HH:mm");
      r[col(COL_PAUSE)] = c.pause === null || c.pause === undefined || c.pause === '' ? '' : Number(c.pause);
      r[col('Modifié le')] = maintenant; r[col('Modifié par')] = qui;
      if (!existe) { pos.set(c.id, data.length); data.push(r); }
    });
    data.sort((a, b) => (a[iDeb] instanceof Date ? a[iDeb].getTime() : 0) - (b[iDeb] instanceof Date ? b[iDeb].getTime() : 0));
    if (n > 1) sh.getRange(2, 1, n - 1, tete.length).clearContent();
    if (data.length) sh.getRange(2, 1, data.length, tete.length).setValues(data);
    journaliser_('Créneaux', ups.length + ' ajouté(s)/modifié(s), ' + dels.length + ' supprimé(s)');
    return { ok: true, total: data.length };
  });
}

/* ===================== Enregistrement des réglages ===================== */

function enregistrerReglages(r) {
  return avecVerrou_(() => {
    const maintenant = new Date();
    // Salariés (on garde la date de création)
    const anciens = {};
    lireTable_('Salariés').forEach(x => { anciens[String(x['ID'])] = x['Créé le']; });
    ecrireTable_('Salariés', (r.emps || []).map(e => ({
      'ID': String(e.id), 'Prénom': e.prenom, 'Nom': e.nom, 'Station': e.station, 'Poste': e.poste,
      'Travailleur de nuit': !!e.nuit, 'Actif': !!e.actif,
      'Créé le': anciens[String(e.id)] || maintenant, 'Modifié le': maintenant,
    })));
    ecrireTable_('Stations', (r.stations || []).map((s, i) => ({ 'Nom': s, 'Ordre': i + 1 })));
    ecrireTable_('Types', (r.types || []).map(t => ({
      'ID': t.id, 'Nom': t.nom, 'Couleur': t.couleur, 'Saisie': t.mode === 'jour' ? 'Journée entière' : 'Horaires',
      'Compte dans les 35h': !!t.compteur, 'Forfait par jour (h)': Number(t.forfait) || 0,
      'Temps de travail effectif': !!t.effectif, 'Puise dans le solde': !!t.deduit,
    })));
    // Règles : on garde unités et libellés existants
    const libelles = {};
    lireTable_('Règles').forEach(x => { libelles[String(x['Clé'])] = x; });
    ecrireTable_('Règles', Object.keys(r.rules || {}).map(k => ({
      'Clé': k, 'Valeur': texteVersDate_(r.rules[k]),
      'Unité': libelles[k] ? libelles[k]['Unité'] : '', 'Libellé': libelles[k] ? libelles[k]['Libellé'] : k,
    })));
    ecrireTable_('Fériés', (r.feries || []).filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.d))
      .sort((a, b) => a.d.localeCompare(b.d))
      .map(f => ({ 'Date': versDate_(f.d, 'yyyy-MM-dd'), 'Nom': f.nom, 'Chômé': !!f.chome })));
    journaliser_('Réglages', 'Réglages enregistrés');
    return { ok: true };
  });
}
