# Trousse — les outils du prof, dans une seule trousse

Site gratuit, sans publicité et sans traqueur, d'outils pour les professeurs de collège et de lycée.
Projet non lucratif créé par Johann STAAL, professeur de mathématiques.

**Données chiffrées de bout en bout** : les noms et les notes des élèves sont chiffrés dans le
navigateur (AES-256-GCM, clé protégée par PBKDF2-SHA256 600 000 itérations). Le serveur ne stocke
que des blocs illisibles.

## Mettre en service
- Publication et comptes : voir [`docs/GUIDE-FIREBASE.md`](docs/GUIDE-FIREBASE.md).
- Direction artistique et architecture : voir [`docs/CONCEPTION.md`](docs/CONCEPTION.md).

## Tester en local
Aucune installation nécessaire : `python3 -m http.server 8080` puis http://localhost:8080

## Structure
```
index.html          page unique (application sans serveur, routage par #)
css/                système de design (app.css), pages, outils
js/main.js          routeur
js/config.js        configuration Firebase (à remplir)
js/lib/             chiffrement, Firebase, données, algorithmes (groupes, salle)
js/ui/              composants partagés, palette Ctrl+K, glisser-déposer
js/pages/           accueil, connexion, classes, compte, pages légales
js/tools/           tirage, groupes, minuteur, plan de classe
js/vendor/          Preact + htm, Firebase (fichiers figés, aucun CDN externe)
assets/             polices libres (OFL), logo
firestore.rules     règles de sécurité Firestore
```

## Licences des ressources
Polices Fraunces et Atkinson Hyperlegible Next (SIL OFL 1.1) · icônes Lucide (ISC) ·
Preact (MIT) · Firebase JS SDK (Apache 2.0).
