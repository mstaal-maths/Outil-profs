// Inscription, connexion, clé de secours, mot de passe oublié.
import { html, useState, useEffect } from '../vendor/preact.js';
import { Icon, Logo, navigate, useTitle, toast, confirmDialog, useStore } from '../ui/core.js';
import * as cloud from '../lib/cloud.js';
import { enterCloud } from '../lib/store.js';
import { passwordStrength, isValidRecoveryKey } from '../lib/crypto.js';
import { downloadBlob, wait } from '../lib/util.js';

const STRENGTH = ['Trop court', 'Faible', 'Correct', 'Solide', 'Excellent'];

function PasswordField({ id, label, value, onInput, autocomplete, meter, hint, error }) {
  const [show, setShow] = useState(false);
  const s = passwordStrength(value);
  return html`<div class="field">
    <label for=${id}>${label}</label>
    <div class="pw-wrap">
      <input id=${id} class="input" type=${show ? 'text' : 'password'} value=${value} onInput=${(e) => onInput(e.target.value)} autocomplete=${autocomplete} required aria-invalid=${error ? 'true' : undefined} aria-describedby=${hint || meter ? id + '-h' : undefined}/>
      <button type="button" class="btn btn-ghost btn-icon btn-sm pw-toggle" onClick=${() => setShow(!show)} aria-label=${show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed=${show}><${Icon} name=${show ? 'eye' : 'lock'}/></button>
    </div>
    ${meter && html`<div class="meter" data-s=${value ? Math.max(1, s) : 0} aria-hidden="true"><span></span><span></span><span></span><span></span></div>`}
    ${(hint || meter) && html`<span class="hint" id=${id + '-h'}>${meter && value ? html`<strong>${STRENGTH[s]}.</strong> ` : ''}${hint}</span>`}
  </div>`;
}

function Side({ mode }) {
  return html`<aside class="auth-side seyes">
    <a class="brand" href="#/"><${Logo}/><span>trousse</span></a>
    <div class="auth-side-copy">
      ${mode === 'inscription'
        ? html`<h2>Votre trousse, <em>rien qu’à vous.</em></h2><p>Un compte gratuit pour retrouver vos classes sur n’importe quel ordinateur — chiffrées avant même de quitter votre écran.</p>`
        : html`<h2>Bon retour <em>parmi nous.</em></h2><p>Vos classes vous attendent, exactement là où vous les aviez laissées.</p>`}
      <div class="auth-points">
        <div><${Icon} name="circle-check"/>Gratuit, sans publicité, pour toujours</div>
        <div><${Icon} name="circle-check"/>Chiffré de bout en bout : illisible pour tout le monde sauf vous</div>
        <div><${Icon} name="circle-check"/>Aucune donnée inutile : ni date de naissance, ni adresse</div>
      </div>
    </div>
  </aside>`;
}

function NotConfigured() {
  return html`<div class="stack" style="--gap:18px">
    <div class="notice warn"><${Icon} name="info"/><div><strong>Les comptes arrivent très bientôt.</strong><br/>Le site est en cours de mise en service. En attendant, toutes les fonctions sont disponibles en démonstration, sans rien enregistrer.</div></div>
    <a class="btn btn-primary btn-lg btn-block" href="#/demo"><${Icon} name="sparkles"/>Essayer sans compte</a>
  </div>`;
}

// Animation « ouverture du coffre » pendant la dérivation de clé (volontairement lente).
function Vault({ steps, step }) {
  return html`<div class="vault" role="status" aria-live="polite">
    <div class="vault-ico"><${Icon} name="lock"/></div>
    <div class="vault-steps">${steps.map((s, i) => html`<div class=${i < step ? 'done' : i === step ? 'on' : ''}>
      ${i < step ? html`<${Icon} name="check"/>` : i === step ? html`<div class="spinner" style="width:17px;height:17px;border-width:2px"></div>` : html`<${Icon} name="chevron-right"/>`}${s}</div>`)}</div>
  </div>`;
}

export function AuthPage({ mode }) {
  const s = useStore();
  const signup = mode === 'inscription';
  const forgot = mode === 'mot-de-passe-oublie';
  useTitle(signup ? 'Créer un compte' : forgot ? 'Mot de passe oublié' : 'Connexion');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [recovery, setRecovery] = useState(null); // clé à montrer après inscription
  const [needRec, setNeedRec] = useState(null); // { keyring, kek, user }
  const [sent, setSent] = useState(false);

  useEffect(() => { if (s.mode === 'cloud' && !recovery && !needRec) navigate('/classes', { replace: true }); }, [s.mode]);
  useEffect(() => { setErr(''); setBusy(false); }, [mode]);

  const configured = cloud.isConfigured();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (forgot) {
      setBusy(true);
      try { await cloud.sendReset(email); } catch (x) { if (x.code === 'auth/invalid-email' || x.code === 'auth/network-request-failed') { setErr(cloud.friendlyError(x)); setBusy(false); return; } }
      setSent(true); setBusy(false); return;
    }
    if (signup) {
      if (pw.length < 10) return setErr('Choisissez un mot de passe d’au moins 10 caractères.');
      if (pw !== pw2) return setErr('Les deux mots de passe ne sont pas identiques.');
      if (!accept) return setErr('Merci d’accepter les conditions d’utilisation pour continuer.');
    }
    setBusy(true); setStep(0);
    try {
      const tick = setInterval(() => setStep((x) => Math.min(x + 1, signup ? 2 : 1)), 650);
      const r = signup ? await cloud.signUp(email, pw) : await cloud.signIn(email, pw);
      clearInterval(tick);
      setStep(9);
      await wait(250);
      if (r.needsRecovery) { setNeedRec(r); setBusy(false); return; }
      if (r.recoveryKey) { setRecovery({ key: r.recoveryKey, user: r.user, dek: r.dek }); setBusy(false); return; }
      await enterCloud(r.user, r.dek);
      navigate('/classes', { replace: true });
      toast('Coffre ouvert. Bonne journée !', { icon: 'key-round' });
    } catch (x) {
      console.warn(x);
      setErr(cloud.friendlyError(x));
      setBusy(false);
    }
  }

  if (recovery) return html`<div class="auth"><${Side} mode="inscription"/><main id="main" class="auth-main" tabindex="-1"><div class="auth-card" style="max-width:520px">
    <${RecoveryKeyScreen} recoveryKey=${recovery.key} email=${email} onDone=${async () => { await enterCloud(recovery.user, recovery.dek); navigate('/classes', { replace: true }); toast('Bienvenue dans votre trousse !', { icon: 'sparkles' }); }}/></div></main></div>`;

  if (needRec) return html`<div class="auth"><${Side} mode="connexion"/><main id="main" class="auth-main" tabindex="-1"><div class="auth-card">
    <${RecoverPrompt} ctx=${needRec} email=${email} onUnlocked=${async (dek, newKey) => {
      if (newKey) { setNeedRec(null); setRecovery({ key: newKey, user: needRec.user, dek }); return; }
      await enterCloud(needRec.user, dek); navigate('/classes', { replace: true }); toast('Vos données sont de nouveau accessibles.', { icon: 'key-round' });
    }}/></div></main></div>`;

  const steps = signup
    ? ['Création de votre clé de chiffrement', 'Protection par votre mot de passe', 'Préparation de la clé de secours']
    : ['Vérification de votre mot de passe', 'Ouverture du coffre chiffré'];

  return html`<div class="auth">
    <${Side} mode=${mode}/>
    <main id="main" class="auth-main route-enter" tabindex="-1">
      <div class="auth-card">
        <h1>${signup ? 'Créer mon compte' : forgot ? 'Mot de passe oublié' : 'Se connecter'}</h1>
        <p class="sub">${signup ? 'Trente secondes, promis. Seulement un e-mail et un mot de passe.' : forgot ? 'Recevez un lien pour choisir un nouveau mot de passe.' : 'Heureux de vous revoir.'}</p>
        ${!configured ? html`<${NotConfigured}/>` : busy && !forgot ? html`<${Vault} steps=${steps} step=${step}/>` : sent ? html`
          <div class="stack" style="--gap:16px">
            <div class="notice"><${Icon} name="info"/><div><strong>Regardez votre boîte de réception.</strong><br/>Si un compte existe pour ${email}, vous allez recevoir un lien (pensez aux indésirables).</div></div>
            <div class="notice warn"><${Icon} name="key-round"/><div>Après le changement de mot de passe, <strong>votre clé de secours</strong> vous sera demandée pour rouvrir vos données. Sans elle, vos anciennes données resteront illisibles — c’est le prix d’un vrai chiffrement.</div></div>
            <a class="btn" href="#/connexion">Revenir à la connexion</a>
          </div>` : html`
        <form onSubmit=${submit} novalidate>
          <div class="field"><label for="email">Adresse e-mail</label>
            <input id="email" class="input" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} autocomplete="email" required autofocus placeholder="prenom.nom@ac-academie.fr"/></div>
          ${!forgot && html`<${PasswordField} id="pw" label="Mot de passe" value=${pw} onInput=${setPw} autocomplete=${signup ? 'new-password' : 'current-password'} meter=${signup} hint=${signup ? 'Au moins 10 caractères. Une petite phrase est idéale : « Ma5eEadoreLesFractions ».' : null}/>`}
          ${signup && html`<${PasswordField} id="pw2" label="Confirmez le mot de passe" value=${pw2} onInput=${setPw2} autocomplete="new-password"/>`}
          ${signup && html`<label class="check-row"><input type="checkbox" checked=${accept} onChange=${(e) => setAccept(e.target.checked)}/>
            <span>J’accepte les <a href="#/cgu" target="_blank">conditions d’utilisation</a> et la <a href="#/confidentialite" target="_blank">politique de confidentialité</a>.</span></label>`}
          ${err && html`<p class="error-text" role="alert">${err}</p>`}
          <button class="btn btn-primary btn-lg btn-block" type="submit" disabled=${busy}>${busy ? html`<div class="spinner" style="width:18px;height:18px"></div>` : signup ? 'Créer mon compte' : forgot ? 'Envoyer le lien' : 'Se connecter'}</button>
          ${!signup && !forgot && html`<a href="#/mot-de-passe-oublie" style="justify-self:center;font-weight:600;font-size:.92rem">Mot de passe oublié ?</a>`}
        </form>`}
        <p class="auth-alt">${signup ? html`Déjà un compte ? <a href="#/connexion">Se connecter</a>` : html`Pas encore de compte ? <a href="#/inscription">Créer un compte</a> · <a href="#/demo">Essayer sans compte</a>`}</p>
      </div>
    </main>
  </div>`;
}

// ---------- Écran de la clé de secours ----------
export function RecoveryKeyScreen({ recoveryKey, email, onDone }) {
  const [saved, setSaved] = useState(false);
  const [acted, setActed] = useState(false);
  const groups = recoveryKey.split('-');
  const text = `TROUSSE — CLÉ DE SECOURS\n\nCompte : ${email}\nCréée le : ${new Date().toLocaleDateString('fr-FR')}\n\n${recoveryKey}\n\nÀ QUOI SERT-ELLE ?\nVos données sont chiffrées avec votre mot de passe. Si vous l'oubliez, cette clé est la SEULE façon de les récupérer. Personne d'autre (ni l'auteur du site, ni Google) ne peut le faire à votre place.\n\nOÙ LA RANGER ?\nImprimez-la ou gardez ce fichier dans un endroit sûr, hors de l'ordinateur de la salle (ex. chez vous, avec vos papiers importants).\n\nNe la communiquez à personne.\n`;
  const download = () => { downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'trousse-cle-de-secours.txt'); setActed(true); };
  const print = () => {
    document.body.classList.add('printing-key');
    setActed(true);
    setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing-key'), 500); }, 50);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(recoveryKey); toast('Clé copiée'); setActed(true); } catch {} };
  return html`<div class="stack route-enter" style="--gap:18px">
    <div><p class="eyebrow">Dernière étape — importante</p><h1 style="margin-top:8px">Votre clé de secours</h1></div>
    <p style="color:var(--ink-2)">Vos données sont chiffrées avec votre mot de passe : même l’auteur du site ne peut pas les lire. Revers de la médaille : <strong>si vous oubliez votre mot de passe, cette clé est le seul moyen de les récupérer.</strong></p>
    <div class="reckey" aria-label=${'Clé de secours : ' + groups.join(' ')}>${groups.map((g) => html`<span>${g}</span>`)}</div>
    <div class="reckey-actions">
      <button class="btn btn-primary" onClick=${print}><${Icon} name="printer"/>Imprimer</button>
      <button class="btn" onClick=${download}><${Icon} name="download"/>Télécharger</button>
      <button class="btn" onClick=${copy}><${Icon} name="copy"/>Copier</button>
    </div>
    <div class="notice"><${Icon} name="info"/><div>Rangez-la <strong>comme un double de clé de maison</strong> : chez vous, avec vos papiers. Pas sur l’ordinateur de la salle des profs.</div></div>
    <label class="check-row"><input type="checkbox" checked=${saved} onChange=${(e) => setSaved(e.target.checked)}/><span>J’ai imprimé ou enregistré ma clé de secours en lieu sûr.</span></label>
    <button class="btn btn-primary btn-lg" disabled=${!saved || !acted} onClick=${onDone}>Ouvrir ma trousse<${Icon} name="arrow-right"/></button>
    ${!acted && html`<p class="hint" style="text-align:center">Imprimez, téléchargez ou copiez la clé pour continuer.</p>`}
    <div class="print-key" aria-hidden="true">
      <h1>Trousse — clé de secours</h1>
      <p><strong>Compte :</strong> ${email}<br/><strong>Créée le :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
      <div class="pk-key">${groups.join('  ')}</div>
      <h2>À quoi sert-elle ?</h2>
      <p>Vos données sont chiffrées avec votre mot de passe. Si vous l’oubliez, cette clé est la seule façon de les récupérer. Personne d’autre — ni l’auteur du site, ni Google — ne peut le faire à votre place.</p>
      <h2>Où la ranger ?</h2>
      <p>Avec vos papiers importants, chez vous. Ne la communiquez à personne.</p>
    </div>
  </div>`;
}

// ---------- Rouvrir les données après réinitialisation du mot de passe ----------
function RecoverPrompt({ ctx, email, onUnlocked }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!isValidRecoveryKey(key)) return setErr('Une clé de secours comporte 32 caractères (8 groupes de 4).');
    setBusy(true); setErr('');
    try { onUnlocked(await cloud.recoverWithKey(ctx.keyring, key, ctx.kek)); }
    catch { setErr('Cette clé ne correspond pas. Vérifiez chaque caractère (pas de I, L, O ni U dans une clé).'); setBusy(false); }
  }
  async function startOver() {
    const ok = await confirmDialog({ title: 'Repartir de zéro ?', body: 'Vos anciennes classes et notes, devenues illisibles, seront définitivement supprimées. Votre compte, lui, est conservé.', ok: 'Supprimer et repartir de zéro', danger: true });
    if (!ok) return;
    setBusy(true);
    const r = await cloud.startOver(ctx.kek);
    onUnlocked(r.dek, r.recoveryKey);
  }
  return html`<div class="stack route-enter" style="--gap:18px">
    <div class="vault-ico" style="margin-bottom:4px"><${Icon} name="key-round"/></div>
    <h1>Votre clé de secours, s’il vous plaît</h1>
    <p style="color:var(--ink-2)">Votre mot de passe a été changé. Pour rouvrir vos données chiffrées, saisissez la clé de secours que vous aviez imprimée ou téléchargée à l’inscription.</p>
    <form onSubmit=${submit} class="stack" style="--gap:14px">
      <div class="field"><label for="rk">Clé de secours</label>
        <input id="rk" class="input" style="font-family:ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase" value=${key} onInput=${(e) => setKey(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" autofocus/></div>
      ${err && html`<p class="error-text" role="alert">${err}</p>`}
      <button class="btn btn-primary btn-lg" disabled=${busy}>${busy ? html`<div class="spinner" style="width:18px;height:18px"></div>` : 'Rouvrir mes données'}</button>
    </form>
    <button class="btn btn-ghost" onClick=${startOver} disabled=${busy}>J’ai perdu ma clé de secours</button>
  </div>`;
}

// ---------- Page de réinitialisation (lien reçu par e-mail) ----------
export function ResetPage({ code }) {
  useTitle('Nouveau mot de passe');
  const [email, setEmail] = useState(null);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [rk, setRk] = useState('');
  const [busy, setBusy] = useState(false);
  const [needRec, setNeedRec] = useState(null);
  const [recovery, setRecovery] = useState(null);
  useEffect(() => {
    if (!code) { setErr('Ce lien est incomplet. Demandez un nouveau lien depuis « Mot de passe oublié ».'); return; }
    cloud.checkResetCode(code).then(setEmail).catch((x) => setErr(cloud.friendlyError(x)));
  }, [code]);
  async function submit(e) {
    e.preventDefault(); setErr('');
    if (pw.length < 10) return setErr('Choisissez un mot de passe d’au moins 10 caractères.');
    if (pw !== pw2) return setErr('Les deux mots de passe ne sont pas identiques.');
    if (rk && !isValidRecoveryKey(rk)) return setErr('La clé de secours comporte 32 caractères (8 groupes de 4).');
    setBusy(true);
    try {
      await cloud.confirmReset(code, email, pw);
      const r = await cloud.signIn(email, pw);
      if (r.needsRecovery) {
        if (rk) {
          try { const dek = await cloud.recoverWithKey(r.keyring, rk, r.kek); await enterCloud(r.user, dek); navigate('/classes', { replace: true }); toast('Nouveau mot de passe enregistré. Vos données sont accessibles.', { icon: 'key-round' }); return; }
          catch { /* mauvaise clé : on redemande */ }
        }
        setNeedRec(r); setBusy(false); return;
      }
      await enterCloud(r.user, r.dek); navigate('/classes', { replace: true });
    } catch (x) { setErr(cloud.friendlyError(x)); setBusy(false); }
  }
  let body;
  if (recovery) body = html`<${RecoveryKeyScreen} recoveryKey=${recovery.key} email=${email} onDone=${async () => { await enterCloud(recovery.user, recovery.dek); navigate('/classes', { replace: true }); }}/>`;
  else if (needRec) body = html`<${RecoverPrompt} ctx=${needRec} email=${email} onUnlocked=${async (dek, newKey) => { if (newKey) { setRecovery({ key: newKey, user: needRec.user, dek }); setNeedRec(null); return; } await enterCloud(needRec.user, dek); navigate('/classes', { replace: true }); }}/>`;
  else body = html`<h1>Nouveau mot de passe</h1>
    <p class="sub">${email ? html`Pour le compte <strong>${email}</strong>.` : 'Vérification du lien…'}</p>
    ${err && !email ? html`<div class="stack" style="--gap:14px"><p class="error-text" role="alert">${err}</p><a class="btn" href="#/mot-de-passe-oublie">Demander un nouveau lien</a></div>` : email && html`
    <form onSubmit=${submit}>
      <${PasswordField} id="npw" label="Nouveau mot de passe" value=${pw} onInput=${setPw} autocomplete="new-password" meter=${true} hint="Au moins 10 caractères."/>
      <${PasswordField} id="npw2" label="Confirmez" value=${pw2} onInput=${setPw2} autocomplete="new-password"/>
      <div class="field"><label for="rk2">Clé de secours</label>
        <input id="rk2" class="input" style="font-family:ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase" value=${rk} onInput=${(e) => setRk(e.target.value)} placeholder="XXXX-XXXX-…" autocomplete="off" spellcheck="false"/>
        <span class="hint">Nécessaire pour rouvrir vos données chiffrées.</span></div>
      ${err && html`<p class="error-text" role="alert">${err}</p>`}
      <button class="btn btn-primary btn-lg btn-block" disabled=${busy}>${busy ? html`<div class="spinner" style="width:18px;height:18px"></div>` : 'Enregistrer et me connecter'}</button>
    </form>`}`;
  return html`<div class="auth"><${Side} mode="connexion"/><main id="main" class="auth-main" tabindex="-1"><div class="auth-card">${body}</div></main></div>`;
}
