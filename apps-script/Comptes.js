/**
 * Comptes de l'application : identifiant + mot de passe, indépendants des comptes Google.
 * La page tourne avec le compte du propriétaire : le Google Sheet n'a pas besoin d'être partagé.
 * Les mots de passe ne sont jamais stockés : seulement une empreinte (SHA-256 répété, avec sel).
 */

const SESSION_LONGUE_ = 30 * 24 * 3600 * 1000; // « rester connecté » : 30 jours
const SESSION_COURTE_ = 12 * 3600 * 1000;      // sinon : 12 heures
const ESSAIS_MAX_ = 5, BLOCAGE_MINUTES_ = 15;
let UTILISATEUR_COURANT = null;                  // identifiant de la personne connectée (pour « Modifié par »)

function empreinte_(sel, motDePasse) {
  // Même calcul qu'avec Utilities.computeDigest + base64Encode (les comptes existants restent valides),
  // mais en JavaScript pur : 1000 tours prennent quelques millisecondes au lieu de plusieurs secondes.
  let h = utf8_(sel + ':' + motDePasse);
  for (let i = 0; i < 1000; i++) h = utf8_(base64_(sha256_(h)));
  return String.fromCharCode.apply(null, h);
}
function utf8_(txt) {
  const s = unescape(encodeURIComponent(txt)), o = new Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
  return o;
}
function base64_(b) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let o = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    o += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < b.length ? A[(n >> 6) & 63] : '=') + (i + 2 < b.length ? A[n & 63] : '=');
  }
  return o;
}
const K256_ = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
/** SHA-256 d'un tableau d'octets ; renvoie un tableau d'octets (0-255). */
function sha256_(m) {
  const l = m.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Array(nb).fill(0);
  for (let i = 0; i < l; i++) b[i] = m[i];
  b[l] = 0x80;
  const bits = l * 8;
  b[nb - 4] = (bits >>> 24) & 255; b[nb - 3] = (bits >>> 16) & 255; b[nb - 2] = (bits >>> 8) & 255; b[nb - 1] = bits & 255;
  b[nb - 5] = Math.floor(bits / 0x100000000) & 255;
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], W = new Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < nb; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = (b[o + 4 * t] << 24) | (b[o + 4 * t + 1] << 16) | (b[o + 4 * t + 2] << 8) | b[o + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const s0 = r(W[t - 15], 7) ^ r(W[t - 15], 18) ^ (W[t - 15] >>> 3), s1 = r(W[t - 2], 17) ^ r(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let [a, bb, c, dd, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256_[t] + W[t]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      h = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + dd) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  const out = [];
  H.forEach(x => out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255));
  return out;
}
const normId_ = id => String(id || '').trim().toLowerCase();
const roleDe_ = c => (/^admin/i.test(String(c['Rôle'])) ? 'admin' : 'chef');
function comptes_() { return lireTable_('Comptes').filter(r => String(r['Identifiant']).trim() !== ''); }
function trouverCompte_(id) { return comptes_().find(c => normId_(c['Identifiant']) === normId_(id)) || null; }
function publicCompte_(c) {
  return { id: String(c['Identifiant']), nom: String(c['Nom affiché'] || c['Identifiant']), role: roleDe_(c), actif: vrai_(c['Actif']),
    derniere: c['Dernière connexion'] instanceof Date ? versTexte_(c['Dernière connexion'], 'dd/MM/yyyy HH:mm') : '' };
}
function verifierMotDePasse_(m) { if (String(m || '').length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères.'); }

/** Crée ou met à jour un compte (utilisé par le menu du Sheet et par les Réglages). */
function creerCompte_(id, nom, role, motDePasse) {
  id = String(id || '').trim();
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(id)) throw new Error('Identifiant : 3 à 30 caractères, lettres, chiffres, point, tiret ou souligné.');
  const liste = comptes_(), existant = liste.find(c => normId_(c['Identifiant']) === normId_(id));
  if (!existant || motDePasse) verifierMotDePasse_(motDePasse);
  const c = existant || { 'Identifiant': id, 'Créé le': new Date(), 'Actif': true };
  c['Nom affiché'] = nom || c['Nom affiché'] || id;
  c['Rôle'] = role === 'admin' ? 'Administrateur' : (role === 'chef' ? 'Chef' : (c['Rôle'] || 'Chef'));
  if (motDePasse) { c['Sel'] = Utilities.getUuid().replace(/-/g, ''); c['Empreinte'] = empreinte_(c['Sel'], motDePasse); }
  if (!existant) liste.push(c);
  ecrireTable_('Comptes', liste);
  return c;
}

/** Menu du Google Sheet : créer (ou réinitialiser) le compte administrateur. Seul le propriétaire y a accès. */
function creerAdministrateurDepuisMenu() {
  verifierBaseSiBesoin_();
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('Compte administrateur (1/3)', 'Identifiant (ex. vincent) :', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const r2 = ui.prompt('Compte administrateur (2/3)', 'Nom affiché (ex. Vincent – chef de service) :', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const r3 = ui.prompt('Compte administrateur (3/3)', 'Mot de passe (au moins 8 caractères) :', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  try {
    avecVerrou_(() => creerCompte_(r1.getResponseText(), r2.getResponseText(), 'admin', r3.getResponseText()));
    journaliser_('Comptes', 'Compte administrateur « ' + r1.getResponseText().trim() + ' » créé / réinitialisé depuis le Sheet');
    ui.alert('Compte administrateur prêt. Vous pouvez vous connecter sur la page du planning.');
  } catch (e) { ui.alert('Impossible : ' + e.message); }
}

/* ===================== Premier compte, créé depuis la page ===================== */

/** La page demande si aucun compte n'existe encore (première ouverture). */
function etatConnexion() { verifierBaseSiBesoin_(); return { installation: comptes_().length === 0 }; }

/**
 * Création du tout premier compte administrateur depuis la page, sans ouvrir le Google Sheet.
 * Possible une seule fois (tant qu'aucun compte n'existe) et seulement en donnant l'adresse Gmail
 * du propriétaire du Google Sheet, pour qu'une personne qui tomberait sur l'adresse de la page ne puisse pas la prendre.
 */
function creerPremierAdministrateur(emailProprietaire, id, nom, motDePasse, resterConnecte) {
  verifierBaseSiBesoin_();
  const props = PropertiesService.getScriptProperties(), cle = 'bloc_installation';
  const bloc = JSON.parse(props.getProperty(cle) || '{"n":0,"t":0}');
  const recent = Date.now() - bloc.t < BLOCAGE_MINUTES_ * 60000;
  if (recent && bloc.n >= ESSAIS_MAX_) throw new Error('Trop d\'essais : réessayez dans ' + BLOCAGE_MINUTES_ + ' minutes.');
  let proprio = '';
  try { proprio = Session.getEffectiveUser().getEmail() || ''; } catch (e) { proprio = ''; }
  if (!proprio) throw new Error("Impossible de vérifier le propriétaire : créez le compte depuis le Google Sheet (menu « Heures Service Neige › Créer / réinitialiser le compte administrateur »).");
  if (String(emailProprietaire || '').trim().toLowerCase() !== proprio.toLowerCase()) {
    props.setProperty(cle, JSON.stringify({ n: (recent ? bloc.n : 0) + 1, t: Date.now() }));
    Utilities.sleep(400);
    throw new Error("Ce n'est pas l'adresse Gmail du propriétaire du Google Sheet.");
  }
  verifierMotDePasse_(motDePasse);
  avecVerrou_(() => {
    if (comptes_().length) throw new Error('Un compte administrateur existe déjà : connectez-vous.');
    creerCompte_(id, nom, 'admin', motDePasse);
  });
  props.deleteProperty(cle);
  UTILISATEUR_COURANT = String(id).trim();
  journaliser_('Comptes', 'Premier compte administrateur « ' + String(id).trim() + ' » créé depuis la page');
  return connexion(id, motDePasse, resterConnecte);
}

/* ===================== Connexion / sessions ===================== */

function connexion(identifiant, motDePasse, resterConnecte) {
  verifierBaseSiBesoin_();
  if (!comptes_().length) throw new Error("Aucun compte n'existe encore : rechargez la page pour créer le compte administrateur.");
  const props = PropertiesService.getScriptProperties(), cle = 'bloc_' + normId_(identifiant);
  const bloc = JSON.parse(props.getProperty(cle) || '{"n":0,"t":0}');
  const recent = Date.now() - bloc.t < BLOCAGE_MINUTES_ * 60000;
  if (recent && bloc.n >= ESSAIS_MAX_) throw new Error('Trop d\'essais : ce compte est bloqué ' + BLOCAGE_MINUTES_ + ' minutes.');
  const c = trouverCompte_(identifiant);
  const ok = c && vrai_(c['Actif']) && String(c['Empreinte']) === empreinte_(String(c['Sel']), String(motDePasse || ''));
  if (!ok) {
    props.setProperty(cle, JSON.stringify({ n: (recent ? bloc.n : 0) + 1, t: Date.now() }));
    Utilities.sleep(400);
    throw new Error('Identifiant ou mot de passe incorrect.');
  }
  props.deleteProperty(cle);
  nettoyerSessions_();
  const jeton = Utilities.getUuid() + Utilities.getUuid();
  props.setProperty('sess_' + jeton, JSON.stringify({ id: String(c['Identifiant']), exp: Date.now() + (resterConnecte ? SESSION_LONGUE_ : SESSION_COURTE_) }));
  avecVerrou_(() => { const l = comptes_(); const x = l.find(y => normId_(y['Identifiant']) === normId_(identifiant)); if (x) { x['Dernière connexion'] = new Date(); ecrireTable_('Comptes', l); } });
  UTILISATEUR_COURANT = String(c['Identifiant']);
  journaliser_('Connexion', '');
  return { jeton, utilisateur: publicCompte_(c) };
}

function deconnexion(jeton) { if (jeton) PropertiesService.getScriptProperties().deleteProperty('sess_' + jeton); return { ok: true }; }

function nettoyerSessions_() {
  const props = PropertiesService.getScriptProperties(), toutes = props.getProperties(), maintenant = Date.now();
  Object.keys(toutes).forEach(k => {
    if (k.indexOf('sess_') !== 0) return;
    try { if (JSON.parse(toutes[k]).exp < maintenant) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/** Vérifie la session ; admin = true pour les actions réservées à l'administrateur. */
function session_(jeton, admin) {
  const props = PropertiesService.getScriptProperties();
  let s = null;
  try { s = jeton ? JSON.parse(props.getProperty('sess_' + jeton) || 'null') : null; } catch (e) { s = null; }
  if (!s || s.exp < Date.now()) { if (s) props.deleteProperty('sess_' + jeton); throw new Error('SESSION : votre connexion a expiré, reconnectez-vous.'); }
  const c = trouverCompte_(s.id);
  if (!c || !vrai_(c['Actif'])) throw new Error('SESSION : ce compte a été désactivé.');
  if (admin && roleDe_(c) !== 'admin') throw new Error("Réservé à l'administrateur.");
  UTILISATEUR_COURANT = String(c['Identifiant']);
  return publicCompte_(c);
}

/* ===================== Gestion des comptes (administrateur) ===================== */

function listerComptes(jeton) { session_(jeton, true); return comptes_().map(publicCompte_); }

function enregistrerCompte(jeton, c) {
  const moi = session_(jeton, true);
  return avecVerrou_(() => {
    const existant = trouverCompte_(c.id);
    if (existant && normId_(c.id) === normId_(moi.id) && (c.role !== 'admin' || !c.actif)) throw new Error('Vous ne pouvez pas retirer vos propres droits d\'administrateur ni désactiver votre compte.');
    const x = creerCompte_(c.id, c.nom, c.role, c.motDePasse || '');
    const liste = comptes_(), y = liste.find(k => normId_(k['Identifiant']) === normId_(x['Identifiant']));
    y['Actif'] = c.actif !== false;
    ecrireTable_('Comptes', liste);
    journaliser_('Comptes', (existant ? 'Compte modifié : ' : 'Compte créé : ') + x['Identifiant'] + (c.motDePasse ? ' (mot de passe défini)' : ''));
    return comptes_().map(publicCompte_);
  });
}

function supprimerCompte(jeton, id) {
  const moi = session_(jeton, true);
  if (normId_(id) === normId_(moi.id)) throw new Error('Vous ne pouvez pas supprimer votre propre compte.');
  return avecVerrou_(() => {
    ecrireTable_('Comptes', comptes_().filter(c => normId_(c['Identifiant']) !== normId_(id)));
    journaliser_('Comptes', 'Compte supprimé : ' + id);
    return comptes_().map(publicCompte_);
  });
}

function changerMonMotDePasse(jeton, ancien, nouveau) {
  const moi = session_(jeton);
  const c = trouverCompte_(moi.id);
  if (String(c['Empreinte']) !== empreinte_(String(c['Sel']), String(ancien || ''))) throw new Error('Mot de passe actuel incorrect.');
  verifierMotDePasse_(nouveau);
  avecVerrou_(() => creerCompte_(moi.id, null, null, nouveau));
  journaliser_('Comptes', 'Mot de passe changé');
  return { ok: true };
}
