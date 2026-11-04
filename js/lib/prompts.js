// Banque de demandes (« prompts ») prêtes à envoyer à une IA pour créer des supports de cours.
// Les champs {{nom}} sont remplacés par ce que le professeur saisit.

export const LEVELS = ['CM2', '6e', '5e', '4e', '3e', '2nde', '1re', 'Terminale', 'Lycée professionnel', 'BTS'];

// Champs réutilisables.
const F = {
  matiere: { id: 'matiere', label: 'Matière', placeholder: 'Ex. mathématiques, histoire, anglais…', remember: true },
  niveau: { id: 'niveau', label: 'Niveau', type: 'level', remember: true },
  theme: { id: 'theme', label: 'Thème ou chapitre', placeholder: 'Ex. les fractions, la Révolution française…' },
  n: (label, def) => ({ id: 'n', label, type: 'number', def }),
  duree: { id: 'duree', label: 'Durée (minutes)', type: 'number', def: 55 },
  texte: (label, placeholder) => ({ id: 'texte', label, type: 'textarea', placeholder }),
  precision: { id: 'precision', label: 'Précisions (facultatif)', placeholder: 'Ex. classe agitée, élèves allophones, pas de calculatrice…', optional: true },
};

const END = `

Réponds en français, avec une mise en page claire (titres, listes, tableaux si utile), prête à être copiée dans un document Word. Vérifie soigneusement l’exactitude de chaque information et respecte les programmes officiels de l’Éducation nationale.`;

export const CATEGORIES = [
  { id: 'cours', label: 'Préparer un cours', icon: 'book-open' },
  { id: 'exos', label: 'Exercices et évaluations', icon: 'list-checks' },
  { id: 'diff', label: 'Élèves en difficulté, DYS', icon: 'heart' },
  { id: 'revis', label: 'Révisions et jeux', icon: 'puzzle' },
  { id: 'correc', label: 'Correction', icon: 'pencil' },
  { id: 'vie', label: 'Parents et vie de classe', icon: 'users' },
];

export const PROMPTS = [
  // ---------- Préparer un cours ----------
  { id: 'sequence', cat: 'cours', title: 'Une séquence complète', desc: 'Le plan d’un chapitre, séance par séance.', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de séances', 6), F.precision],
    text: `Tu es un professeur expérimenté de {{matiere}}. Construis une séquence pédagogique de {{n}} séances sur « {{theme}} » pour une classe de {{niveau}}.
Pour la séquence : les objectifs et les compétences travaillées, les prérequis.
Pour chaque séance : l’objectif, le déroulé minuté (accroche, activité, mise en commun, trace écrite), le matériel nécessaire et le travail à donner.
Termine par une proposition d’évaluation finale.{{precision}}` },
  { id: 'seance', cat: 'cours', title: 'Le déroulé d’une séance', desc: 'Une heure de cours minutée, clé en main.', fields: [F.matiere, F.niveau, F.theme, F.duree, F.precision],
    text: `Tu es un professeur expérimenté de {{matiere}}. Prépare le déroulé détaillé d’une séance de {{duree}} minutes sur « {{theme}} » pour une classe de {{niveau}}.
Indique pour chaque étape la durée, ce que fait le professeur, ce que font les élèves, et les consignes exactes à donner.
Prévois une accroche motivante, une activité où les élèves sont actifs, une trace écrite courte et un petit exercice de fin de séance.{{precision}}` },
  { id: 'trace', cat: 'cours', title: 'Une trace écrite (leçon)', desc: 'La leçon à recopier, claire et courte.', fields: [F.matiere, F.niveau, F.theme, F.precision],
    text: `Rédige la trace écrite (la leçon que les élèves recopient dans leur cahier) sur « {{theme}} » en {{matiere}}, pour une classe de {{niveau}}.
Elle doit tenir sur une page de cahier au maximum : un titre, les définitions et notions essentielles encadrées, un ou deux exemples, et une phrase « Je retiens » à la fin.
Utilise un vocabulaire adapté à l’âge des élèves.{{precision}}` },
  { id: 'accroche', cat: 'cours', title: 'Une accroche pour démarrer', desc: 'Situation-problème, question surprenante, énigme…', fields: [F.matiere, F.niveau, F.theme],
    text: `Propose 5 idées d’accroche différentes pour introduire « {{theme}} » en {{matiere}} auprès d’une classe de {{niveau}} : une situation-problème, une question surprenante, une image ou un document à commenter, un petit défi, un lien avec la vie quotidienne.
Pour chacune : ce que je dis ou montre aux élèves, la question posée, et comment rebondir vers la notion du jour (5 minutes maximum).` },
  { id: 'methode', cat: 'cours', title: 'Une fiche méthode', desc: 'Apprendre une leçon, rédiger, résoudre un problème…', fields: [F.matiere, F.niveau, { id: 'theme', label: 'Méthode à expliquer', placeholder: 'Ex. apprendre une leçon, rédiger un paragraphe argumenté…' }],
    text: `Rédige une fiche méthode pour des élèves de {{niveau}} en {{matiere}} : « {{theme}} ».
Présente les étapes numérotées, avec pour chacune une consigne courte et un exemple concret. Ajoute les erreurs à éviter et une petite liste de vérification « Avant de rendre mon travail, je vérifie que… ».
La fiche doit tenir sur une page et être compréhensible par un élève seul.` },

  // ---------- Exercices et évaluations ----------
  { id: 'exos3', cat: 'exos', title: 'Des exercices en 3 niveaux', desc: 'Facile, moyen, difficile, avec le corrigé.', fields: [F.matiere, F.niveau, F.theme, F.n('Exercices par niveau', 3), F.precision],
    text: `Crée une série d’exercices sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}, en trois niveaux de difficulté : ★ (pour consolider), ★★ (attendu) et ★★★ (pour aller plus loin), avec {{n}} exercices par niveau.
Les consignes doivent être courtes et précises. Donne ensuite, à part, le corrigé détaillé de chaque exercice.{{precision}}` },
  { id: 'evaluation', cat: 'exos', title: 'Une évaluation avec barème', desc: 'Un contrôle sur 20, le barème et le corrigé.', fields: [F.matiere, F.niveau, F.theme, F.duree, F.precision],
    text: `Rédige une évaluation de {{duree}} minutes sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}, notée sur 20.
Propose 4 à 6 exercices de difficulté progressive, avec le nombre de points indiqué pour chacun et les compétences évaluées.
Donne ensuite, à part : le barème détaillé point par point, puis le corrigé complet.{{precision}}` },
  { id: 'qcm', cat: 'exos', title: 'Un QCM', desc: 'Questions à choix multiples et leur corrigé.', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de questions', 10)],
    text: `Crée un QCM de {{n}} questions sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}. Chaque question a 4 propositions et une seule bonne réponse ; les mauvaises réponses doivent correspondre à des erreurs fréquentes des élèves.
Présente d’abord le QCM pour les élèves (sans les réponses), puis à part le corrigé avec une phrase d’explication pour chaque question.` },
  { id: 'examen', cat: 'exos', title: 'Un sujet type brevet ou bac', desc: 'Dans le format officiel de l’examen.', fields: [F.matiere, F.niveau, F.theme, F.precision],
    text: `Rédige un sujet d’entraînement en {{matiere}} sur « {{theme}} », dans le format et le niveau d’exigence de l’examen officiel correspondant à une classe de {{niveau}} (brevet, bac ou autre).
Respecte la structure habituelle de l’épreuve, la durée et le barème officiels. Donne ensuite un corrigé détaillé et les attendus pour obtenir tous les points.{{precision}}` },
  { id: 'flash', cat: 'exos', title: 'Des questions flash', desc: 'Pour démarrer le cours en 5 minutes.', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de questions', 10)],
    text: `Propose {{n}} questions flash (réponse en moins de 30 secondes) sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}, à projeter en début de cours pour réactiver les connaissances.
Varie les formes (calcul, définition, vrai/faux, compléter une phrase). Donne les réponses à part.` },

  // ---------- Élèves en difficulté, DYS ----------
  { id: 'dys', cat: 'diff', title: 'Adapter un texte pour un élève DYS', desc: 'Phrases courtes, vocabulaire simple, mise en page aérée.', fields: [F.niveau, F.texte('Texte à adapter', 'Collez ici le texte, la consigne ou l’exercice (sans nom d’élève)…')],
    text: `Adapte le texte ci-dessous pour un élève de {{niveau}} ayant un trouble DYS (dyslexie, dyspraxie) :
- phrases courtes, une idée par phrase ;
- vocabulaire simple, mots difficiles expliqués entre parenthèses ;
- consignes découpées en étapes numérotées ;
- mots importants en gras ;
- garde exactement le même contenu et les mêmes notions.

Texte :
"""
{{texte}}
"""` },
  { id: 'allege', cat: 'diff', title: 'Alléger un exercice', desc: 'Une version plus accessible, mêmes objectifs.', fields: [F.niveau, F.texte('Exercice à alléger', 'Collez ici l’exercice…')],
    text: `Voici un exercice destiné à une classe de {{niveau}}. Propose une version allégée pour des élèves en difficulté, qui travaille les mêmes compétences : moins de questions, des étapes guidées, des aides (exemple résolu, rappel de cours, coup de pouce), et des consignes reformulées simplement. Indique ce que tu as modifié et pourquoi.

Exercice :
"""
{{texte}}
"""` },
  { id: 'approfondir', cat: 'diff', title: 'Pour les élèves qui ont fini', desc: 'Des défis pour aller plus loin.', fields: [F.matiere, F.niveau, F.theme],
    text: `Propose 5 activités d’approfondissement sur « {{theme}} » en {{matiere}} pour les élèves de {{niveau}} qui terminent en avance : défis, énigmes, problèmes ouverts, recherches courtes. Elles doivent pouvoir être faites en autonomie, en 10 à 20 minutes, avec la solution à part pour le professeur.` },
  { id: 'expliquer', cat: 'diff', title: 'Expliquer autrement', desc: 'Une notion expliquée de 3 façons différentes.', fields: [F.matiere, F.niveau, { id: 'theme', label: 'Notion qui pose problème', placeholder: 'Ex. la proportionnalité, le passé composé…' }],
    text: `Des élèves de {{niveau}} ne comprennent pas « {{theme}} » en {{matiere}}. Explique cette notion de trois façons différentes : avec une comparaison de la vie quotidienne, avec un schéma ou une représentation visuelle (décris-le), et pas à pas avec un exemple résolu.
Indique aussi les erreurs les plus fréquentes et comment les corriger.` },

  // ---------- Révisions et jeux ----------
  { id: 'fiche', cat: 'revis', title: 'Une fiche de révision', desc: 'L’essentiel du chapitre sur une page.', fields: [F.matiere, F.niveau, F.theme],
    text: `Rédige une fiche de révision d’une page sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}} : les notions clés, les définitions, les méthodes ou dates à connaître, un schéma ou tableau récapitulatif, puis 5 questions pour s’auto-évaluer avec leurs réponses en bas de page.` },
  { id: 'jeu', cat: 'revis', title: 'Un jeu de révision en classe', desc: '« J’ai… Qui a… ? », quiz par équipes, défi…', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de questions', 20)],
    text: `Crée le contenu d’un jeu de révision « J’ai… Qui a… ? » sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}, avec {{n}} cartes.
Chaque carte contient « J’ai : [une réponse] » puis « Qui a : [une question] ? ». La réponse de la dernière carte correspond à la question de la première, pour former une boucle. Présente les cartes dans un tableau, puis l’ordre de la chaîne pour le professeur.` },
  { id: 'motscroises', cat: 'revis', title: 'Du vocabulaire pour des mots croisés', desc: 'Mots et définitions à utiliser dans un générateur.', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de mots', 15)],
    text: `Donne {{n}} mots de vocabulaire essentiels sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}, avec pour chacun une définition courte qui ne contient pas le mot lui-même.
Présente le résultat sous la forme « MOT : définition », un par ligne, pour que je puisse l’utiliser dans un générateur de mots croisés.` },
  { id: 'flashcards', cat: 'revis', title: 'Des flashcards', desc: 'Question au recto, réponse au verso.', fields: [F.matiere, F.niveau, F.theme, F.n('Nombre de cartes', 20)],
    text: `Crée {{n}} flashcards de révision sur « {{theme}} » en {{matiere}} pour une classe de {{niveau}}. Présente-les dans un tableau à deux colonnes : « Recto » (question, mot ou notion) et « Verso » (réponse courte et précise).` },

  // ---------- Correction ----------
  { id: 'bareme', cat: 'correc', title: 'Un barème de correction', desc: 'Pour corriger vite et de façon juste.', fields: [F.niveau, F.texte('Sujet de l’évaluation', 'Collez ici le sujet…')],
    text: `Voici le sujet d’une évaluation pour une classe de {{niveau}}. Propose un barème détaillé sur 20, question par question, avec ce qu’il faut attendre pour chaque point, les réponses partielles acceptées et les erreurs qui font perdre des points. Donne aussi le corrigé type.

Sujet :
"""
{{texte}}
"""` },
  { id: 'commentaires', cat: 'correc', title: 'Des commentaires pour les copies', desc: 'Des annotations bienveillantes et utiles.', fields: [F.matiere, F.niveau, F.theme],
    text: `Propose une banque de 20 commentaires courts à écrire sur les copies d’élèves de {{niveau}} en {{matiere}} (chapitre « {{theme}} ») : 7 pour encourager, 7 pour signaler une erreur précise et dire comment progresser, 6 sur la méthode et la présentation. Ton bienveillant, phrases de moins de 15 mots.` },
  { id: 'corrige', cat: 'correc', title: 'Un corrigé détaillé', desc: 'La correction rédigée, étape par étape.', fields: [F.niveau, F.texte('Exercice à corriger', 'Collez ici l’exercice…')],
    text: `Rédige le corrigé détaillé de l’exercice ci-dessous, tel qu’on l’attend d’un élève de {{niveau}} : chaque étape expliquée, les justifications nécessaires, et à la fin les points de méthode à retenir.

Exercice :
"""
{{texte}}
"""` },

  // ---------- Parents et vie de classe ----------
  { id: 'parents', cat: 'vie', title: 'Un message aux parents', desc: 'Sortie, réunion, matériel, information…', fields: [{ id: 'theme', label: 'Objet du message', placeholder: 'Ex. sortie au musée le 12 mars, réunion parents-professeurs…' }, F.niveau, F.precision],
    text: `Rédige un message clair, poli et chaleureux aux parents d’élèves de {{niveau}} au sujet de : {{theme}}.
Il doit être court (moins de 150 mots), donner toutes les informations pratiques (date, heure, lieu, matériel, ce qui est attendu des familles) et se terminer par une formule de politesse. Propose aussi une version encore plus courte pour un SMS ou une notification.{{precision}}` },
  { id: 'regles', cat: 'vie', title: 'Les règles de vie de la classe', desc: 'Une charte positive, à afficher.', fields: [F.niveau, F.precision],
    text: `Propose une charte de vie de classe pour des élèves de {{niveau}} : 8 à 10 règles formulées de façon positive (« Je lève la main pour parler » plutôt que « Ne pas crier »), regroupées par thème (respect, travail, matériel, entraide), avec une courte phrase qui explique pourquoi chaque règle est importante.{{precision}}` },
  { id: 'rentree', cat: 'vie', title: 'Une activité de rentrée', desc: 'Pour faire connaissance le premier jour.', fields: [F.matiere, F.niveau],
    text: `Propose 4 activités de début d’année pour faire connaissance avec une classe de {{niveau}} lors de mon premier cours de {{matiere}} : un jeu brise-glace, un questionnaire de rentrée, une activité qui donne envie d’aimer la matière, et une façon de présenter mes attentes. Pour chacune : la durée, le déroulé et le matériel.` },
];

/** Remplace les champs par les valeurs saisies. */
export function fillPrompt(p, values) {
  let t = p.text;
  for (const f of p.fields) {
    const v = (values[f.id] ?? '').toString().trim();
    if (f.id === 'precision') t = t.replace('{{precision}}', v ? `\nPrécisions : ${v}` : '');
    else t = t.split(`{{${f.id}}}`).join(v || `[${f.label.toLowerCase()}]`);
  }
  return t + END;
}

export const AI_SITES = [
  { id: 'lechat', name: 'Le Chat', sub: 'Mistral, français', url: (p) => `https://chat.mistral.ai/chat?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt', name: 'ChatGPT', sub: 'OpenAI', url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'claude', name: 'Claude', sub: 'Anthropic', url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
];
