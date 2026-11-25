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
  let h = sel + ':' + motDePasse;
  for (let i = 0; i < 1000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
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
