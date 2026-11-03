// Point d'entrée : routeur et coquille.
import { html, render, useEffect, useState } from './vendor/preact.js';
import { useRoute, useStore, navigate, applyTheme, currentPath } from './ui/core.js';
import { Topbar, CommandPalette, ShortcutsDialog, installGlobalKeys } from './ui/shell.js';
import { boot, startDemo } from './lib/store.js';
import { Landing } from './pages/landing.js';
import { AuthPage, ResetPage } from './pages/auth.js';
import { Dashboard } from './pages/dashboard.js';
import { ClassPage } from './pages/classe.js';
import { Account } from './pages/account.js';
import { LegalPage } from './pages/legal.js';
import { TimerTool } from './tools/minuteur.js';

applyTheme();

// Lien de réinitialisation envoyé par Firebase (?mode=resetPassword&oobCode=…)
const qs = new URLSearchParams(location.search);
let resetCode = null;
if (qs.get('mode') === 'resetPassword' && qs.get('oobCode')) {
  resetCode = qs.get('oobCode');
  history.replaceState(null, '', location.pathname + '#/reinitialiser');
}

function NotFound() {
  return html`<main id="main" class="page route-enter" tabindex="-1"><div class="empty" style="margin-top:40px">
    <h3>Cette page s’est perdue dans le cartable</h3><p>Le lien est peut-être incomplet, ou la classe a été supprimée.</p>
    <a class="btn btn-primary" href="#/">Revenir à l’accueil</a></div></main>`;
}

function Loading() {
  return html`<div class="boot" role="status" aria-live="polite"><div class="spinner"></div><span>Ouverture de votre trousse…</span></div>`;
}

function App() {
  const path = useRoute();
  const s = useStore();
  const [demoStarting, setDemoStarting] = useState(false);

  useEffect(() => { scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }, [path]);

  useEffect(() => {
    if (path === '/demo' || path.startsWith('/demo/')) {
      setDemoStarting(true);
      startDemo();
      const tool = path.split('/')[2];
      navigate('/classes/demo-5' + (tool ? '/' + tool : ''), { replace: true });
      setDemoStarting(false);
    }
  }, [path]);

  if (!s.ready || demoStarting) return html`<${Loading}/>`;

  const parts = path.split('/').filter(Boolean);
  const needAuth = () => { if (s.mode === 'none') { setTimeout(() => navigate('/connexion', { replace: true })); return html`<${Loading}/>`; } return null; };

  let page;
  let crumbs = [];
  let bare = false;
  if (parts[0] === 'demo') return html`<${Loading}/>`;
  if (path === '/' || path === '') { page = html`<${Landing}/>`; bare = true; }
  else if (parts[0] === 'connexion' || parts[0] === 'inscription' || parts[0] === 'mot-de-passe-oublie') { page = html`<${AuthPage} mode=${parts[0]}/>`; bare = true; }
  else if (parts[0] === 'reinitialiser') { page = html`<${ResetPage} code=${resetCode}/>`; bare = true; }
  else if (parts[0] === 'minuteur') { page = html`<${TimerTool} standalone=${true}/>`; crumbs = [{ label: 'Minuteur' }]; }
  else if (['mentions-legales', 'confidentialite', 'cgu'].includes(parts[0])) { page = html`<${LegalPage} which=${parts[0]}/>`; }
  else if (parts[0] === 'classes' && !parts[1]) { page = needAuth() || html`<${Dashboard}/>`; crumbs = [{ label: 'Mes classes' }]; }
  else if (parts[0] === 'classes' && parts[1]) {
    const g = needAuth();
    if (g) page = g;
    else {
      const cls = s.classes[parts[1]];
      if (!cls) page = html`<${NotFound}/>`;
      else {
        page = html`<${ClassPage} cls=${cls} tab=${parts[2] || 'eleves'} key=${cls.id}/>`;
        crumbs = [{ label: 'Mes classes', href: '/classes' }, { label: cls.name, href: `/classes/${cls.id}` }];
      }
    }
  } else if (parts[0] === 'compte') { page = needAuth() || html`<${Account}/>`; crumbs = [{ label: 'Mon compte' }]; }
  else page = html`<${NotFound}/>`;

  return html`
    ${!bare && html`<${Topbar} crumbs=${crumbs}/>`}
    ${page}
    <${CommandPalette} path=${path}/>
    <${ShortcutsDialog}/>`;
}

installGlobalKeys(currentPath);
boot().catch(console.error);
render(html`<${App}/>`, document.getElementById('app'));
document.documentElement.classList.add('js-ready');
