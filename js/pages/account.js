// Mon compte & sécurité.
import { html, useState } from '../vendor/preact.js';
import { Icon, useStore, useTitle, toast, navigate } from '../ui/core.js';
import * as cloud from '../lib/cloud.js';
import { restoreKey } from '../lib/crypto.js';
import { logout } from '../lib/store.js';
import { doLogout } from '../ui/shell.js';

export function Account() {
  const s = useStore();
  useTitle('Mon compte');
  const [oldPw, setOld] = useState('');
  const [newPw, setNew] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [delPw, setDelPw] = useState('');
  const [delConfirm, setDelConfirm] = useState('');

  if (s.mode === 'demo') return html`<main id="main" class="page route-enter" tabindex="-1"><div class="empty"><h3>Pas de compte en mode démonstration</h3><p>Créez un compte gratuit pour retrouver vos vraies classes sur tous vos ordinateurs.</p><a class="btn btn-primary" href="#/inscription">Créer mon compte</a></div></main>`;

  async function change(e) {
    e.preventDefault(); setErr('');
    if (newPw.length < 10) return setErr('Le nouveau mot de passe doit faire au moins 10 caractères.');
    setBusy(true);
    try { await cloud.changePassword(s.user.email, oldPw, newPw, await restoreKey()); toast('Mot de passe changé. Votre clé de secours reste valable.', { icon: 'key-round' }); setOld(''); setNew(''); }
    catch (x) { setErr(cloud.friendlyError(x)); }
    setBusy(false);
  }
  async function del(e) {
    e.preventDefault(); setErr('');
    if (delConfirm.trim().toUpperCase() !== 'SUPPRIMER') return setErr('Tapez SUPPRIMER pour confirmer.');
    setBusy(true);
    try { await cloud.deleteAccount(s.user.email, delPw); await logout(); navigate('/', { replace: true }); toast('Votre compte et toutes vos données ont été supprimés.', { icon: 'trash-2' }); }
    catch (x) { setErr(cloud.friendlyError(x)); setBusy(false); }
  }
  return html`<main id="main" class="page route-enter" tabindex="-1">
    <div class="page-head"><div><h1>Mon compte</h1><p class="sub">${s.user?.email}</p></div></div>
    <div class="account-grid">
      <section class="panel"><h2>Votre coffre chiffré</h2>
        <p>Vos classes et vos notes sont chiffrées dans ce navigateur avant d’être envoyées. Ni l’auteur du site ni Google ne peuvent les lire.</p>
        <div class="notice"><${Icon} name="shield-check"/><div>À la déconnexion, <strong>tout est effacé de cet ordinateur</strong>. La session se ferme aussi quand vous fermez le navigateur.</div></div>
        <div class="row" style="margin-top:16px"><button class="btn" onClick=${doLogout}><${Icon} name="log-out"/>Se déconnecter</button></div>
      </section>
      <section class="panel"><h2>Changer de mot de passe</h2><p>Votre clé de secours actuelle reste valable.</p>
        <form class="stack" style="--gap:14px" onSubmit=${change}>
          <div class="field"><label for="op">Mot de passe actuel</label><input id="op" class="input" type="password" autocomplete="current-password" value=${oldPw} onInput=${(e) => setOld(e.target.value)} required/></div>
          <div class="field"><label for="np">Nouveau mot de passe</label><input id="np" class="input" type="password" autocomplete="new-password" value=${newPw} onInput=${(e) => setNew(e.target.value)} required/></div>
          <button class="btn btn-primary" disabled=${busy} style="justify-self:start">Changer le mot de passe</button>
        </form></section>
      <section class="panel"><h2>Sauvegarde et export</h2><p>Télécharger une sauvegarde chiffrée de toutes vos données, et la restaurer.</p>
        <div class="notice"><${Icon} name="info"/><div>Disponible à la phase 4 du projet.</div></div></section>
      <section class="panel"><h2 style="color:var(--marge-text)">Supprimer mon compte</h2><p>Supprime définitivement votre compte, vos classes, vos élèves et vos notes. Irréversible.</p>
        <form class="stack" style="--gap:14px" onSubmit=${del}>
          <div class="field"><label for="dp">Mot de passe</label><input id="dp" class="input" type="password" autocomplete="current-password" value=${delPw} onInput=${(e) => setDelPw(e.target.value)} required/></div>
          <div class="field"><label for="dc">Tapez SUPPRIMER pour confirmer</label><input id="dc" class="input" value=${delConfirm} onInput=${(e) => setDelConfirm(e.target.value)}/></div>
          <button class="btn btn-danger" disabled=${busy} style="justify-self:start"><${Icon} name="trash-2"/>Supprimer définitivement</button>
        </form></section>
      ${err && html`<p class="error-text" role="alert">${err}</p>`}
    </div>
  </main>`;
}
