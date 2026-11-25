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
2. Copiez-collez cette ligne puis appuyez sur Entrée
   (**sans** `--no-localhost` : cette ancienne méthode est bloquée par Google) :

   ```bash
   npx @google/clasp@2.4.2 login
   ```

3. Un lien s'affiche : ouvrez-le, choisissez votre compte Google, cliquez sur **Autoriser**.
   **Laissez cet onglet Cloud Shell ouvert**, il attend la suite.
4. Le navigateur affiche ensuite une page d'erreur (« Impossible d'accéder à ce site »)
   dont l'adresse commence par `http://localhost:` suivi d'un numéro et de `/?code=...`.
   **C'est normal.** Copiez **toute l'adresse** de la barre du navigateur.
5. Dans Cloud Shell, ouvrez un **deuxième onglet** (bouton **+** en haut du terminal) et tapez
   `curl "` + l'adresse collée + `"`, puis Entrée. Exemple :

   ```bash
   curl "http://localhost:12345/?code=4/0A...&scope=..."
   ```

   Revenez au premier onglet : le message « Logged in » est apparu.
   *Cette adresse expire en quelques minutes : en cas d'erreur, recommencez au point 2.
   Ne la communiquez à personne.*
6. Affichez la clé avec :

   ```bash
   cat ~/.clasprc.json
   ```

7. Sélectionnez et copiez **tout** le texte affiché (de `{` jusqu'au dernier `}`).

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
L'**adresse du planning** est affichée dans le résumé du robot « Déployer vers Apps Script »
(elle ne change pas d'une mise à jour à l'autre : mettez-la en favori sur ordinateur et smartphone).
À la première ouverture, Google demande une autorisation : « Paramètres avancés » →
« Accéder à Heures Service Neige » → « Autoriser ».
