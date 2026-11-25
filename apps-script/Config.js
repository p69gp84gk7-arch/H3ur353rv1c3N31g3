/**
 * Réglages techniques du programme.
 * L'identifiant du Google Sheet n'est pas un secret : il figure dans l'adresse du fichier.
 */
const CONFIG = {
  SHEET_ID: '1XxH6M-GFu4T4znMcR0zhkvmvTTeoTQzN6MFwVMWgBFA',
  // À augmenter à chaque changement de la structure ci-dessous :
  // le programme ajoute alors lui-même les onglets / colonnes manquants.
  SCHEMA_VERSION: 3,
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
      { key: 'Contrat' }, { key: "Date d'embauche", type: 'date' }, // v2
      { key: 'Objectif annuel (h)' }, // v3 (vide = objectif par défaut des Règles)
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
      ['soli', 'Journée de solidarité', '#60a5fa', 'Journée entière', true, 7, false, false], // v3
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
      ['saisonDebut', '01/06/2026', 'date', 'Début de saison (année de contrat)'],
      ['saisonFin', '31/05/2027', 'date', 'Fin de saison (année de contrat)'],
      ['objectifAnnuel', 1607, 'h', 'Objectif annuel par défaut (modifiable par salarié)'],
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
      ['14/07/2026', 'Fête nationale', false], ['15/08/2026', 'Assomption', false],
      ['01/11/2026', 'Toussaint', false], ['11/11/2026', 'Armistice', false],
      ['25/12/2026', 'Noël', false], ['01/01/2027', "Jour de l'an", false],
      ['29/03/2027', 'Lundi de Pâques', false], ['01/05/2027', 'Fête du travail', false],
      ['06/05/2027', 'Ascension', false], ['08/05/2027', 'Victoire 1945', false],
      ['17/05/2027', 'Lundi de Pentecôte', false], ['14/07/2027', 'Fête nationale', false],
      ['15/08/2027', 'Assomption', false], ['01/11/2027', 'Toussaint', false],
      ['11/11/2027', 'Armistice', false],
    ],
  },
  {
    // v3 : modèles de semaine (un horaire « 08:00-18:00 », « RH », un code, ou vide, pour chaque jour)
    name: 'Modèles',
    columns: [
      { key: 'ID' }, { key: 'Nom' }, { key: 'Couleur' },
      { key: 'Lun', type: 'texte' }, { key: 'Mar', type: 'texte' }, { key: 'Mer', type: 'texte' }, { key: 'Jeu', type: 'texte' },
      { key: 'Ven', type: 'texte' }, { key: 'Sam', type: 'texte' }, { key: 'Dim', type: 'texte' },
    ],
    defaults: [
      ['forte_hiver', 'Période forte – hiver (40h)', '#4c1d95', '08:30-17:30', '08:30-17:30', '08:30-17:30', '08:30-17:30', '08:30-17:30', 'RH', 'RH'],
      ['forte_nov', 'Période forte – novembre (40h)', '#4c1d95', '08:00-17:00', '08:00-17:00', '08:00-17:00', '08:00-17:00', '08:00-17:00', 'RH', 'RH'],
      ['normale', 'Période normale (34h)', '#65a30d', '08:00-18:00', '08:00-18:00', '08:00-18:00', '08:00-16:00', 'RH', 'RH', 'RH'],
    ],
  },
  {
    name: 'Journal',
    columns: [{ key: 'Horodatage', type: 'datetime' }, { key: 'Utilisateur' }, { key: 'Action' }, { key: 'Détails' }],
  },
];
