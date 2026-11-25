# Heures Service Neige

Planning hebdomadaire (jour et nuit) du service, avec calcul des heures selon les règles RH,
compteur d'heures manquantes et de dépassements, et récapitulatif de saison.
Stations : Superbagnères, Le Mourtis, Bourg d'Oueil.

- **Interface** : page web Google Apps Script (ordinateur et smartphone).
- **Base de données** : Google Sheet « Heures Service Neige – Base de données ».
- **Mises à jour** : par pull request ; une fois acceptée, le code part tout seul vers Apps Script.

## Contenu

| Dossier | Rôle |
|---|---|
| `maquettes/` | Maquette cliquable à valider (données d'exemple) |
| `apps-script/` | Le programme envoyé vers Google Apps Script |
| `.github/workflows/` | Les robots : vérification des pull requests, envoi vers Apps Script |
| `docs/MISE-EN-PLACE.md` | Les étapes à faire une seule fois |
