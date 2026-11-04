# Conception de Trousse

## Le nom
Propositions : **Trousse**, Préau, Craie, Estrade, Marge. Retenu (provisoire) : **Trousse** —
l'objet que chaque élève et chaque prof a sur sa table, et qui contient *tous ses outils*.

## Direction artistique — « Le cahier »
- **Papier** : fond crème `#FBF8F1`, jamais de blanc clinique. Motif discret des grands carreaux
  **Seyès**, la réglure du cahier français, que tout prof reconnaît instantanément.
- **Encre** : bleu `#2E44C9`, le bleu du stylo plume. Couleur d'action principale.
- **Marge** : rouge `#D93B30`, la marge du cahier et le stylo de correction. Utilisé avec parcimonie :
  la marge de la page d'accueil, le cercle rouge qui entoure l'élève tiré au sort.
- **Surligneur** : jaune `#FFE066`, pour mettre en valeur.
- **Mode sombre « Ardoise »** : un noir légèrement vert, comme un tableau noir, texte couleur craie.
- **Typographie** : *Fraunces* (titres) — un caractère à empattements chaleureux et expressif, avec
  un italique plein de caractère ; *Atkinson Hyperlegible Next* (texte) — dessinée par le Braille
  Institute pour une lisibilité maximale : idéale pour la projection et les élèves DYS.
- **Logo** : une trousse vue de face ; la fermeture éclair dessine un sourire, un stylo rouge dépasse.
- **Mouvement** : animations courtes, avec des courbes douces, toujours au service de la
  compréhension (les élèves *glissent* vers leur nouvelle place). Désactivées si l'ordinateur
  demande « réduire les animations ».

## Architecture
- Site statique (GitHub Pages), application d'une seule page, routage par `#` : aucune donnée
  d'élève dans les adresses.
- Aucun CDN tiers : polices et bibliothèques hébergées dans le dépôt.
- Firebase Authentication + Firestore (europe-west9). Le mot de passe ne quitte jamais le navigateur :
  Firebase reçoit un secret *dérivé*. Voir `js/lib/crypto.js` pour le schéma complet.
- Hors ligne : cache Firestore local (chiffré), effacé à la déconnexion.

## Plan de développement
1. **Phase 1** — accueil, démo, comptes, chiffrement, classes, élèves, notes (import École Directe), tirage, groupes, minuteur, plan de classe. ✅
2. **Appréciations de bulletin** — dans chaque classe : un élève, 4 thèmes, 3 formulations. ✅
   (Les générateurs de documents imprimables ont été retirés à la demande de l'auteur ; ils restent dans l'historique Git, commit `47f38f9`.)
3. **Mis de côté pour l’instant** — statistiques d’une évaluation, bilan de conseil de classe, import par capture d’écran (remplacé par le copier-coller École Directe).
4. **Phase 4** — pages légales complètes, registre RGPD, suppression de fin d'année, sauvegarde/restauration.
