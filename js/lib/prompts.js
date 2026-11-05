// Banque de demandes générales pour une IA. Le professeur joint son propre fichier
// (cours, sujet, texte…) dans l'IA : la demande dit simplement quoi en faire.

export const CATEGORIES = [
  { id: 'cours', label: 'Préparer un cours', icon: 'book-open' },
  { id: 'exos', label: 'Exercices et évaluations', icon: 'list-checks' },
  { id: 'diff', label: 'Adapter (DYS, difficulté)', icon: 'heart' },
  { id: 'revis', label: 'Réviser', icon: 'puzzle' },
  { id: 'correc', label: 'Corriger', icon: 'pencil' },
];

const END = `

Adapte le niveau de langue à l’âge des élèves concernés (déduis la classe du document ; si tu ne peux pas, demande-la-moi avant de commencer). Vérifie l’exactitude de chaque information. Réponds en français, avec une mise en page claire (titres, listes, tableaux si utile), prête à être copiée dans un document Word.`;

export const PROMPTS = [
  // ---------- Préparer un cours ----------
  { id: 'resume', cat: 'cours', title: 'Faire la leçon à recopier', desc: 'Une trace écrite courte, à partir de mon cours.',
    text: 'À partir du document joint, rédige la trace écrite que les élèves recopieront dans leur cahier : un titre, les définitions et notions essentielles encadrées, un ou deux exemples, et une rubrique « Je retiens » à la fin. Elle doit tenir sur une page de cahier au maximum.' },
  { id: 'seance', cat: 'cours', title: 'Préparer le déroulé d’une séance', desc: 'Une heure de cours minutée à partir de mon document.',
    text: 'À partir du document joint, prépare le déroulé détaillé d’une séance de 55 minutes : pour chaque étape, la durée, ce que fait le professeur, ce que font les élèves et les consignes exactes. Prévois une accroche motivante, une activité où les élèves sont actifs, une courte trace écrite et un petit exercice de fin de séance.' },
  { id: 'sequence', cat: 'cours', title: 'Découper en plusieurs séances', desc: 'Le plan de la séquence, séance par séance.',
    text: 'À partir du document joint, propose un découpage en séances : pour chaque séance, l’objectif, les activités, la durée et le travail à donner. Termine par une proposition d’évaluation finale.' },
  { id: 'accroche', cat: 'cours', title: 'Trouver une accroche', desc: 'Pour lancer le chapitre et motiver la classe.',
    text: 'À partir du document joint, propose 5 idées d’accroche pour introduire cette notion en classe : une situation-problème, une question surprenante, une image ou un document à commenter, un petit défi, un lien avec la vie quotidienne. Pour chacune : ce que je dis ou montre, la question posée, et comment rebondir vers la notion (5 minutes maximum).' },
  { id: 'expliquer', cat: 'cours', title: 'Expliquer autrement', desc: 'La notion expliquée de 3 façons différentes.',
    text: 'À partir du document joint, explique la notion principale de trois façons différentes, pour les élèves qui n’ont pas compris : avec une comparaison de la vie quotidienne, avec un schéma (décris-le précisément), et pas à pas avec un exemple résolu. Indique aussi les erreurs les plus fréquentes des élèves et comment les corriger.' },

  // ---------- Exercices et évaluations ----------
  { id: 'evaluation', cat: 'exos', title: 'Créer une évaluation', desc: 'Un contrôle sur 20, avec barème et corrigé.',
    text: 'À partir du document joint, rédige une évaluation d’environ 50 minutes, notée sur 20 : 4 à 6 exercices de difficulté progressive, avec le nombre de points de chaque question et les compétences évaluées. Donne ensuite, à part : le barème détaillé point par point, puis le corrigé complet.' },
  { id: 'exos3', cat: 'exos', title: 'Des exercices en 3 niveaux', desc: 'Facile, moyen, difficile, avec le corrigé.',
    text: 'À partir du document joint, crée une série d’exercices en trois niveaux de difficulté : ★ (pour consolider), ★★ (niveau attendu) et ★★★ (pour aller plus loin), avec 3 exercices par niveau. Les consignes doivent être courtes et précises. Donne ensuite, à part, le corrigé détaillé.' },
  { id: 'qcm', cat: 'exos', title: 'Faire un QCM', desc: '10 questions à choix multiples et leur corrigé.',
    text: 'À partir du document joint, crée un QCM de 10 questions. Chaque question a 4 propositions et une seule bonne réponse ; les mauvaises réponses doivent correspondre à des erreurs fréquentes des élèves. Présente d’abord le QCM pour les élèves, sans les réponses, puis à part le corrigé avec une courte explication pour chaque question.' },
  { id: 'variante', cat: 'exos', title: 'Faire une version B d’un sujet', desc: 'Un sujet équivalent, pour éviter la triche.',
    text: 'Le document joint est un sujet d’évaluation. Rédige une version B équivalente : mêmes compétences, même difficulté, même barème, même nombre de questions, mais avec des données, des exemples ou des textes différents. Donne ensuite le corrigé de la version B.' },
  { id: 'flash', cat: 'exos', title: 'Des questions flash', desc: 'Pour démarrer le cours en 5 minutes.',
    text: 'À partir du document joint, propose 10 questions flash (réponse en moins de 30 secondes) à projeter en début de cours pour réactiver les connaissances. Varie les formes : définition, vrai ou faux, calcul, phrase à compléter. Donne les réponses à part.' },

  // ---------- Adapter ----------
  { id: 'dys', cat: 'diff', title: 'Adapter pour un élève DYS', desc: 'Phrases courtes, consignes découpées, mise en page aérée.',
    text: 'Adapte le document joint pour un élève ayant un trouble DYS (dyslexie, dyspraxie) : phrases courtes avec une idée par phrase, vocabulaire simple avec les mots difficiles expliqués entre parenthèses, consignes découpées en étapes numérotées, mots importants en gras, mise en page aérée. Garde exactement le même contenu et les mêmes notions.' },
  { id: 'allege', cat: 'diff', title: 'Alléger pour un élève en difficulté', desc: 'Moins de questions, des aides, les mêmes objectifs.',
    text: 'Le document joint est un exercice ou une évaluation. Propose une version allégée pour des élèves en difficulté, qui travaille les mêmes compétences : moins de questions, des étapes guidées, des aides (exemple résolu, rappel de cours, coup de pouce) et des consignes reformulées simplement. Indique ce que tu as modifié.' },
  { id: 'approfondir', cat: 'diff', title: 'Pour les élèves qui ont fini', desc: 'Des défis pour aller plus loin.',
    text: 'À partir du document joint, propose 5 activités d’approfondissement pour les élèves qui terminent en avance : défis, énigmes, problèmes ouverts ou petites recherches, à faire en autonomie en 10 à 20 minutes. Donne les solutions à part, pour le professeur.' },
  { id: 'simplifier', cat: 'diff', title: 'Simplifier un texte', desc: 'Pour des élèves allophones ou petits lecteurs.',
    text: 'Réécris le texte du document joint dans une version plus facile à lire, pour des élèves allophones ou en difficulté de lecture : phrases simples, vocabulaire courant, présent de préférence, sans perdre les informations importantes. Ajoute un petit lexique des mots difficiles à la fin.' },

  // ---------- Réviser ----------
  { id: 'fiche', cat: 'revis', title: 'Faire une fiche de révision', desc: 'L’essentiel sur une page.',
    text: 'À partir du document joint, rédige une fiche de révision d’une page : les notions clés, les définitions, les méthodes ou dates à connaître, un tableau récapitulatif, puis 5 questions pour s’auto-évaluer, avec leurs réponses en bas de page.' },
  { id: 'jeu', cat: 'revis', title: 'Créer un jeu de révision', desc: '« J’ai… Qui a… ? » pour toute la classe.',
    text: 'À partir du document joint, crée un jeu de révision « J’ai… Qui a… ? » de 25 cartes : chaque carte contient « J’ai : [une réponse] » puis « Qui a : [une question] ? ». La réponse de la dernière carte correspond à la question de la première, pour former une boucle. Présente les cartes dans un tableau, puis l’ordre de la chaîne pour le professeur.' },
  { id: 'flashcards', cat: 'revis', title: 'Faire des flashcards', desc: 'Question au recto, réponse au verso.',
    text: 'À partir du document joint, crée 20 flashcards de révision, dans un tableau à deux colonnes : « Recto » (question, mot ou notion) et « Verso » (réponse courte et précise).' },
  { id: 'vocab', cat: 'revis', title: 'Lister le vocabulaire à connaître', desc: 'Les mots clés et leur définition.',
    text: 'À partir du document joint, liste les mots de vocabulaire que les élèves doivent connaître, avec une définition simple et un exemple d’utilisation pour chacun, dans un tableau à trois colonnes : Mot, Définition, Exemple.' },

  // ---------- Corriger ----------
  { id: 'bareme', cat: 'correc', title: 'Faire un barème de correction', desc: 'Pour corriger vite et de façon juste.',
    text: 'Le document joint est un sujet d’évaluation. Propose un barème détaillé sur 20, question par question, avec ce qu’il faut attendre pour chaque point, les réponses partielles acceptées et les erreurs qui font perdre des points. Donne aussi le corrigé type.' },
  { id: 'corrige', cat: 'correc', title: 'Rédiger le corrigé', desc: 'La correction expliquée, étape par étape.',
    text: 'Rédige le corrigé détaillé du document joint, tel qu’on l’attend d’un élève : chaque étape expliquée, les justifications nécessaires, et à la fin les points de méthode à retenir.' },
  { id: 'erreurs', cat: 'correc', title: 'Prévoir les erreurs des élèves', desc: 'Les pièges, et comment y remédier.',
    text: 'Le document joint est un exercice ou une évaluation. Liste les erreurs que les élèves risquent le plus de faire, question par question, en expliquant d’où vient chaque erreur et quelle remédiation proposer en classe (un petit exercice ou une explication).' },
  { id: 'commentaires', cat: 'correc', title: 'Des commentaires pour les copies', desc: 'Des annotations bienveillantes et utiles.',
    text: 'Le document joint est un sujet d’évaluation. Propose une banque de 20 commentaires courts à écrire sur les copies : 7 pour encourager, 7 pour signaler une erreur précise et dire comment progresser, 6 sur la méthode et la présentation. Ton bienveillant, moins de 15 mots par commentaire.' },
];

export const fullPrompt = (p) => p.text + END;

/** Sites des IA : on ouvre la page d'accueil (la demande est copiée, le fichier se joint d'abord). */
export const AI_SITES = [
  { id: 'lechat', name: 'Le Chat', sub: 'Mistral, français', url: 'https://chat.mistral.ai/chat' },
  { id: 'chatgpt', name: 'ChatGPT', sub: 'OpenAI', url: 'https://chatgpt.com/' },
  { id: 'claude', name: 'Claude', sub: 'Anthropic', url: 'https://claude.ai/new' },
];
