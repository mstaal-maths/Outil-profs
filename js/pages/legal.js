// Pages légales (version provisoire — rédaction complète prévue en phase 4).
import { html } from '../vendor/preact.js';
import { useTitle } from '../ui/core.js';
import { Footer } from './landing.js';

const PAGES = {
  'mentions-legales': ['Mentions légales', html`
    <h2>Éditeur</h2><p>Trousse est un projet personnel, non lucratif, édité par Johann STAAL, professeur de mathématiques.</p>
    <h2>Hébergement</h2><p>Site : GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis).<br/>Comptes et données chiffrées : Google Firebase (Google Ireland Ltd.), base de données située en Europe (Paris, europe-west9).</p>
    <h2>Licences</h2><p>Polices Fraunces et Atkinson Hyperlegible Next (SIL Open Font License), icônes Lucide (licence ISC).</p>`],
  confidentialite: ['Politique de confidentialité', html`
    <p><strong>En résumé :</strong> aucune publicité, aucun traqueur, aucun cookie de mesure d’audience. Les données de vos élèves sont chiffrées dans votre navigateur ; personne d’autre que vous ne peut les lire.</p>
    <h2>Données collectées</h2><p>Pour votre compte : votre adresse e-mail. Pour vos classes : le prénom et le nom (ou l’initiale) des élèves, et les notes que vous saisissez. Jamais de date de naissance, d’adresse ou de photo.</p>
    <h2>Chiffrement</h2><p>Toutes les données de classe sont chiffrées (AES-256-GCM) dans votre navigateur, avec une clé protégée par votre mot de passe. Le serveur ne reçoit que des données illisibles.</p>
    <h2>Stockage local</h2><p>Pendant votre session, une copie chiffrée peut être gardée sur l’ordinateur pour fonctionner hors connexion. Elle est entièrement effacée à la déconnexion. Seule votre préférence d’affichage (clair ou sombre) est conservée.</p>
    <p class="hint">La politique complète (bases légales, durées de conservation, droits RGPD) sera publiée à la phase 4.</p>`],
  cgu: ['Conditions d’utilisation', html`
    <p>Trousse est un service gratuit, fourni bénévolement et sans garantie, destiné aux enseignants.</p>
    <h2>Données des élèves</h2><p>En tant qu’enseignant, vous restez responsable des données de vos élèves que vous saisissez. L’éditeur agit comme sous-traitant technique : il ne peut ni lire, ni exploiter ces données, qui sont chiffrées de bout en bout.</p>
    <h2>Clé de secours</h2><p>Sans votre mot de passe ni votre clé de secours, vos données ne peuvent pas être récupérées, y compris par l’éditeur.</p>
    <p class="hint">Les conditions complètes, dont la clause de sous-traitance détaillée, seront publiées à la phase 4.</p>`],
};

export function LegalPage({ which }) {
  const [title, body] = PAGES[which];
  useTitle(title);
  return html`<main id="main" class="page route-enter" tabindex="-1"><article class="legal"><h1>${title}</h1>${body}</article></main><${Footer}/>`;
}
