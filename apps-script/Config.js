/**
 * Réglages techniques du programme.
 * L'identifiant du Google Sheet n'est pas un secret : il figure dans l'adresse du fichier.
 */
const CONFIG = {
  SHEET_ID: '1XxH6M-GFu4T4znMcR0zhkvmvTTeoTQzN6MFwVMWgBFA',
  // À augmenter à chaque changement de la structure ci-dessous :
  // le programme ajoute alors lui-même les onglets / colonnes manquants.
  SCHEMA_VERSION: 1,
};

/**
 * Structure de la base de données (un onglet par sujet).
 * Règle d'or : on AJOUTE des onglets ou des colonnes, on ne supprime jamais
 * rien automatiquement (pas de perte de données).
 * type 'date' = affiché jj/mm/aaaa ; 'datetime' = jj/mm/aaaa hh:mm.
 */
const SCHEMA = [
  {
    name: 'Salariés',
    columns: [
      { key: 'ID' }, { key: 'Prénom' }, { key: 'Nom' }, { key: 'Station' }, { key: 'Poste' },
      { key: 'Travailleur de nuit' }, { key: 'Actif' },
      { key: 'Créé le', type: 'datetime' }, { key: 'Modifié le', type: 'datetime' },
    ],
  },
  {
    name: 'Stations',
    columns: [{ key: 'Nom' }, { key: 'Ordre' }],
    defaults: [['Superbagnères', 1], ['Le Mourtis', 2], ["Bourg d'Oueil", 3]],
  },
  {
    name: 'Types',
    columns: [
      { key: 'ID' }, { key: 'Nom' }, { key: 'Couleur' }, { key: 'Saisie' },
      { key: 'Compte dans les 35h' }, { key: 'Forfait par jour (h)' },
      { key: 'Temps de travail effectif' }, { key: 'Puise dans le solde' },
    ],
    defaults: [
      ['travail_jour', 'Travail', '#2f6fdb', 'Horaires', true, 0, true, false],
      ['travail_nuit', 'Travail de nuit (auto)', '#33287f', 'Horaires', true, 0, true, false],
      ['formation', 'Formation', '#0f8a7e', 'Horaires', true, 0, true, false],
      ['astreinte', 'Astreinte', '#c2410c', 'Horaires', false, 0, false, false],
      ['repos_hebdo', 'Repos hebdo', '#64748b', 'Journée entière', false, 0, false, false],
      ['ferie', 'Férié chômé', '#be123c', 'Journée entière', true, 7, false, false],
      ['conges', 'Congés payés', '#a16207', 'Journée entière', true, 7, false, false],
      ['recup', 'Récupération', '#7e3fbf', 'Journée entière', true, 7, false, true],
      ['maladie', 'Maladie / absence', '#57534e', 'Journée entière', true, 7, false, false],
    ],
  },
  {
    name: 'Règles',
    columns: [{ key: 'Clé' }, { key: 'Valeur' }, { key: 'Unité' }, { key: 'Libellé' }],
    defaults: [
      ['legale', 35, 'h', 'Durée légale par semaine'],
      ['maxSem', 48, 'h', 'Maxi sur une semaine'],
      ['maxMoy', 44, 'h', 'Maxi en moyenne'],
      ['moyN', 12, 'semaines', 'Moyenne calculée sur'],
      ['maxJour', 10, 'h', 'Maxi sur une journée'],
      ['amplitude', 13, 'h', "Amplitude maxi d'une journée"],
      ['reposJour', 11, 'h', 'Repos entre 2 journées'],
      ['reposHebdo', 35, 'h', "Repos hebdomadaire d'affilée"],
      ['pauseAuto', 60, 'min', 'Pause repas automatique'],
      ['pauseSeuil', 6, 'h', 'Pause appliquée si le créneau dépasse'],
      ['nuitDebut', 21, 'h', 'La nuit commence à'],
      ['nuitFin', 6, 'h', 'La nuit finit à'],
      ['nuitMaxPoste', 8, 'h', 'Maxi par poste de nuit'],
      ['nuitMoy', 40, 'h', 'Maxi en moyenne (travailleur de nuit)'],
      ['saisonDebut', '23/11/2026', 'date', 'Début de saison'],
      ['saisonFin', '21/11/2027', 'date', 'Fin de saison'],
      ['pasGlisser', 30, 'min', 'Précision du glisser'],
    ],
  },
  {
    name: 'Créneaux',
    columns: [
      { key: 'ID' }, { key: 'ID salarié' }, { key: 'Type' },
      { key: 'Début', type: 'datetime' }, { key: 'Fin', type: 'datetime' },
      { key: 'Pause (min, vide = auto)' },
      { key: 'Modifié le', type: 'datetime' }, { key: 'Modifié par' },
    ],
  },
  {
    name: 'Fériés',
    columns: [{ key: 'Date', type: 'date' }, { key: 'Nom' }, { key: 'Chômé' }],
    defaults: [
      ['25/12/2026', 'Noël', false], ['01/01/2027', "Jour de l'an", false],
      ['29/03/2027', 'Lundi de Pâques', false], ['01/05/2027', 'Fête du travail', false],
      ['06/05/2027', 'Ascension', false], ['08/05/2027', 'Victoire 1945', false],
      ['17/05/2027', 'Lundi de Pentecôte', false], ['14/07/2027', 'Fête nationale', false],
      ['15/08/2027', 'Assomption', false], ['01/11/2027', 'Toussaint', false],
      ['11/11/2027', 'Armistice', false],
    ],
  },
  {
    name: 'Journal',
    columns: [{ key: 'Horodatage', type: 'datetime' }, { key: 'Utilisateur' }, { key: 'Action' }, { key: 'Détails' }],
  },
];
