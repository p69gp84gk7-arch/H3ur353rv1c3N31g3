# Mise en place (à faire une seule fois)

Le but : quand une modification est acceptée sur GitHub, un robot l'envoie tout seul
vers Google Apps Script, et le Google Sheet se met à jour tout seul.

Il y a 4 étapes, environ 15 minutes. Faites-les avec **le compte Google qui possède le Google Sheet**.

---

## Étape 1 — Créer le programme dans le Google Sheet

1. Ouvrez le Google Sheet **« Heures Service Neige – Base de données »** :
   https://docs.google.com/spreadsheets/d/1XxH6M-GFu4T4znMcR0zhkvmvTTeoTQzN6MFwVMWgBFA/edit
2. Menu **Extensions → Apps Script**. Un nouvel onglet s'ouvre.
3. En haut à gauche, cliquez sur « Projet sans titre » et renommez-le **Heures Service Neige**.
4. À gauche, cliquez sur la roue dentée **⚙ Paramètres du projet**.
5. Copiez l'**ID du script** (une longue suite de lettres et de chiffres).
6. **Envoyez-moi cet ID dans la conversation** (ce n'est pas un mot de passe, il n'y a pas de risque).

## Étape 2 — Autoriser l'envoi automatique

1. Ouvrez https://script.google.com/home/usersettings
2. Mettez **« API Google Apps Script »** sur **Activé**.

## Étape 3 — Créer la clé d'accès pour le robot GitHub

Cette clé permet au robot d'envoyer le code. **Ne la collez jamais dans la conversation.**

1. Ouvrez **Google Cloud Shell** : https://shell.cloud.google.com
   (c'est un terminal gratuit dans le navigateur ; acceptez les conditions si on vous le demande).
2. Copiez-collez cette ligne puis appuyez sur Entrée :

   ```bash
   npx @google/clasp@2.4.2 login --no-localhost
   ```

3. Un lien s'affiche : ouvrez-le, choisissez votre compte Google, cliquez sur **Autoriser**.
4. Le navigateur affiche ensuite une page d'erreur dont l'adresse commence par
   `http://localhost:8888/?code=...`. **C'est normal.** Dans la barre d'adresse, copiez
   **seulement le morceau entre `code=` et `&scope`** (il commence par `4/0A...` ;
   si vous voyez `4%2F0A...`, remplacez `%2F` par `/`).
   Collez-le dans Cloud Shell après « Enter the code from that page here », puis Entrée.
   Le message « Logged in » apparaît.
   *Ce code expire en quelques minutes : en cas d'erreur, relancez la commande du point 2.
   Ne le communiquez à personne.*
5. Affichez la clé avec :

   ```bash
   cat ~/.clasprc.json
   ```

6. Sélectionnez et copiez **tout** le texte affiché (de `{` jusqu'au dernier `}`).

## Étape 4 — Ranger la clé dans GitHub (coffre-fort)

1. Ouvrez https://github.com/p69gp84gk7-arch/H3ur353rv1c3N31g3/settings/secrets/actions
2. Cliquez sur **New repository secret**.
3. Name : `CLASPRC_JSON`
4. Secret : collez le texte copié à l'étape 3.
5. Cliquez sur **Add secret**.

Vous pouvez ensuite fermer Cloud Shell et, par sécurité, effacer la clé qui y reste :

```bash
rm ~/.clasprc.json
```

---

## Ensuite, comment ça marche au quotidien

1. Je propose une modification sous forme de **pull request** (une demande de modification).
2. Un robot vérifie automatiquement que le code est correct (pastille verte ✓).
3. Vous la lisez et cliquez sur **Merge** (fusionner) pour l'accepter.
4. Le robot « Déployer vers Apps Script » envoie le code vers Google.
5. À la prochaine ouverture du Sheet ou de la page web, les onglets et colonnes
   manquants sont créés tout seuls. **Rien n'est jamais supprimé automatiquement.**

Pour voir si le robot a réussi : onglet **Actions** du dépôt GitHub.
