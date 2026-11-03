# Mettre en service les comptes — guide pas à pas

Ce guide prend environ **15 minutes**. Aucune connaissance technique n'est nécessaire :
il suffit de cliquer et de copier-coller. Tout est gratuit (offre « Spark » de Firebase,
sans carte bancaire).

> Tant que ces étapes ne sont pas faites, le site fonctionne déjà entièrement en
> **mode démonstration**. Seuls les comptes (et donc l'enregistrement) sont désactivés.

---

## Étape 0 — Publier le site sur GitHub Pages (2 minutes)

1. Ouvrez https://github.com/mstaal-maths/Outil-profs
2. Cliquez sur **Settings** (Paramètres), puis dans le menu de gauche sur **Pages**.
3. Sous **Build and deployment** → **Source**, choisissez **Deploy from a branch**.
4. Sous **Branch**, choisissez la branche `claude/teacher-tools-platform-bgbuo0`
   (plus tard : `main`), dossier **/ (root)**, puis **Save**.
5. Attendez 1 à 2 minutes : l'adresse du site s'affiche en haut de la page,
   normalement **https://mstaal-maths.github.io/Outil-profs/**

> Si GitHub indique que Pages n'est pas disponible, c'est que le dépôt est privé :
> passez-le en public (Settings → General → tout en bas, *Change visibility*).
> Le code ne contient aucune donnée personnelle, il peut être public sans risque.

---

## Étape 1 — Créer le projet Firebase

1. Allez sur https://console.firebase.google.com et connectez-vous avec un compte Google.
2. Cliquez sur **Créer un projet** (ou *Ajouter un projet*).
3. Nom du projet : `trousse` (Firebase ajoutera peut-être un suffixe, c'est normal).
4. **Google Analytics : DÉSACTIVEZ-LE.** C'est important : le site promet « aucun traqueur ».
5. Cliquez sur **Créer le projet**, attendez, puis **Continuer**.

## Étape 2 — Activer la connexion par e-mail

1. Dans le menu de gauche : **Créer** → **Authentication**, puis **Commencer**.
2. Onglet **Mode de connexion** (*Sign-in method*) → **Adresse e-mail/Mot de passe**.
3. Activez le **premier** interrupteur (pas besoin du « lien par e-mail »), puis **Enregistrer**.
4. Onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** :
   `mstaal-maths.github.io`

### Le lien « mot de passe oublié » (indispensable)

Comme vos données sont chiffrées avec votre mot de passe, le changement de mot de passe
doit se faire **sur le site lui-même** (pour pouvoir demander la clé de secours).

1. Toujours dans **Authentication**, onglet **Modèles** (*Templates*).
2. Choisissez **Réinitialisation du mot de passe**, cliquez sur le crayon ✏️.
3. Tout en bas, cliquez sur **Personnaliser l'URL d'action** et collez :
   `https://mstaal-maths.github.io/Outil-profs/`
4. Changez la **langue du modèle** en **Français** (icône 🌐 en haut), puis **Enregistrer**.

## Étape 3 — Créer la base de données en Europe

1. Menu de gauche : **Créer** → **Firestore Database** → **Créer une base de données**.
2. Emplacement : choisissez **`europe-west9 (Paris)`**. ⚠️ Ce choix est définitif.
3. Mode : **Démarrer en mode production**, puis **Créer**.
4. Ouvrez l'onglet **Règles**, effacez tout, et collez le contenu du fichier
   [`firestore.rules`](../firestore.rules) de ce dépôt. Cliquez sur **Publier**.

## Étape 4 — Récupérer la configuration

1. Cliquez sur la roue dentée ⚙️ en haut à gauche → **Paramètres du projet**.
2. En bas, section **Vos applications**, cliquez sur l'icône **`</>`** (Web).
3. Surnom : `site` — **ne cochez pas** Firebase Hosting — puis **Enregistrer l'application**.
4. Firebase affiche un bloc de code contenant `const firebaseConfig = { ... }`.
   Copiez uniquement ce qui est entre les accolades, **accolades comprises**.

## Étape 5 — Coller la configuration dans le site

Le plus simple : envoyez-moi (à Claude) le bloc copié, je m'en charge.

Ou bien vous-même, directement sur GitHub :

1. Ouvrez le fichier `js/config.js` dans le dépôt, cliquez sur le crayon ✏️ (*Edit*).
2. Remplacez `export const FIREBASE_CONFIG = null;` par :
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "…",
     authDomain: "….firebaseapp.com",
     projectId: "…",
     storageBucket: "…",
     messagingSenderId: "…",
     appId: "…"
   };
   ```
3. **Commit changes**. Une minute plus tard, les comptes fonctionnent sur le site.

> Ces valeurs ne sont pas secrètes : elles identifient seulement votre projet. La sécurité
> repose sur les règles Firestore (chacun n'accède qu'à ses documents) et sur le
> chiffrement de bout en bout.

---

## Vérifier que le chiffrement fonctionne

1. Sur le site, créez un compte de test, une classe, et ajoutez un élève « Marie Test ».
2. Dans la console Firebase → **Firestore Database** → onglet **Données**.
3. Ouvrez `users` → votre identifiant → `classes` → le document.
4. Vous devez voir un champ `box` contenant `iv` et `ct` : une longue suite de caractères
   incompréhensibles. **Le nom « Marie Test » ne doit apparaître nulle part.**

## En cas de souci

| Message | Solution |
| --- | --- |
| « Les comptes arrivent très bientôt » | La configuration de l'étape 5 n'est pas encore en place. |
| `auth/unauthorized-domain` | Ajoutez `mstaal-maths.github.io` aux domaines autorisés (étape 2). |
| « Accès refusé par le serveur » | Les règles de l'étape 3 n'ont pas été publiées. |
| Le lien de réinitialisation ouvre une page Firebase | L'URL d'action n'est pas personnalisée (étape 2). |
