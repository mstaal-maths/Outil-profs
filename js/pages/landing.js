// Page d'accueil publique.
import { html, useState, useEffect, useRef } from '../vendor/preact.js';
import { Icon, Logo, useStore, useTitle, toggleTheme, useTheme, navigate } from '../ui/core.js';
import { TOOLS, openPalette } from '../ui/shell.js';
import { prefersReducedMotion, shuffle } from '../lib/util.js';

const NAMES = ['Inès', 'Lucas', 'Chloé', 'Adam', 'Léa', 'Noah', 'Jade', 'Ethan', 'Manon', 'Yanis', 'Camille', 'Hugo', 'Lina', 'Sacha', 'Emma', 'Mathis', 'Zoé', 'Rayan', 'Louise', 'Nathan', 'Ambre', 'Théo', 'Sarah', 'Gabriel'];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

// ---------- Mini plan de classe animé ----------
function MiniPlan() {
  const seats = [];
  for (let r = 0; r < 4; r++) for (let t = 0; t < 3; t++) for (let k = 0; k < 2; k++) seats.push({ x: 40 + t * 150 + k * 58, y: 92 + r * 74 });
  const [order, setOrder] = useState(() => NAMES.map((_, i) => i));
  const [hl, setHl] = useState(-1);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      setOrder((o) => shuffle(o));
    }, 3600);
    const id2 = setInterval(() => setHl(Math.floor(Math.random() * NAMES.length)), 1800);
    return () => { clearInterval(id); clearInterval(id2); };
  }, []);
  return html`<svg class="mini-plan" viewBox="0 0 490 400" role="img" aria-label="Aperçu animé d’un plan de classe">
    <rect x="135" y="18" width="220" height="14" rx="7" class="mp-board"/>
    <text x="245" y="54" text-anchor="middle" class="mp-label">TABLEAU</text>
    ${[0, 1, 2, 3].map((r) => [0, 1, 2].map((t) => html`<rect x=${40 + t * 150 - 27} y=${92 + r * 74 - 22} width="112" height="44" rx="9" class="mp-table"/>`))}
    ${NAMES.map((n, i) => {
      const s = seats[order[i]];
      return html`<g class=${`mp-tok ${hl === i ? 'hl' : ''}`} style=${`transform:translate(${s.x}px,${s.y}px);transition-delay:${(i % 8) * 28}ms`} key=${n}>
        <rect x="-26" y="-14" width="52" height="28" rx="7"/><text y="4.5" text-anchor="middle">${n}</text></g>`;
    })}
  </svg>`;
}

// ---------- Mini tirage ----------
function MiniDraw() {
  const [name, setName] = useState('Zoé');
  const [phase, setPhase] = useState('done');
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let t1, t2, t3;
    const cycle = () => {
      if (document.hidden) { t3 = setTimeout(cycle, 2000); return; }
      setPhase('spin');
      let k = 0;
      const spin = () => {
        setName(NAMES[Math.floor(Math.random() * NAMES.length)]);
        k++;
        if (k < 14) t1 = setTimeout(spin, 50 + k * k * 1.6);
        else { setPhase('done'); t2 = setTimeout(cycle, 3400); }
      };
      spin();
    };
    t3 = setTimeout(cycle, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return html`<div class="float-card fc-draw" aria-hidden="true">
    <div class="fc-head"><${Icon} name="dices"/>Tirage au sort<span class="fc-count">12 / 24</span></div>
    <div class=${`fc-name ${phase}`}><span>${name}</span>
      <svg viewBox="0 0 200 80" class="red-circle" key=${phase === 'done' ? name : 'x'}><path d="M30 46c-2-18 40-30 82-28 40 2 66 12 62 28-4 18-52 24-92 20-34-3-54-10-50-24 2-8 14-14 30-17"/></svg></div>
  </div>`;
}

// ---------- Mini minuteur ----------
function MiniTimer() {
  const [t, setT] = useState(272);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => setT((x) => (x <= 0 ? 300 : x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const p = t / 300;
  const C = 2 * Math.PI * 34;
  return html`<div class="float-card fc-timer" aria-hidden="true">
    <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" style=${`stroke-dasharray:${C};stroke-dashoffset:${C * (1 - p)}`}/></svg>
    <div><div class="fc-time tnum">${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</div><div class="fc-sub">Travail en autonomie</div></div>
  </div>`;
}

// ---------- Démonstration du chiffrement ----------
const ROWS = [['Inès Bernard', '15,5'], ['Lucas Moreau', '11'], ['Chloé Lefèvre', '17,5'], ['Adam Benali', '13']];
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
function scramble(s, seed) {
  let out = '';
  for (let i = 0; i < s.length + 8; i++) out += GLYPHS[(seed * 31 + i * 17 + s.charCodeAt(i % s.length) * 7) % GLYPHS.length];
  return out;
}
function CipherDemo() {
  const [server, setServer] = useState(false);
  const [mix, setMix] = useState(0);
  const ref = useRef();
  useEffect(() => {
    let raf, start;
    const target = server ? 1 : 0;
    const from = mix;
    const anim = (ts) => {
      if (!start) start = ts;
      const k = prefersReducedMotion() ? 1 : Math.min(1, (ts - start) / 700);
      setMix(from + (target - from) * k);
      if (k < 1) raf = requestAnimationFrame(anim);
    };
    raf = requestAnimationFrame(anim);
    return () => cancelAnimationFrame(raf);
  }, [server]);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setTimeout(() => setServer(true), 900); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const show = (plain, i) => {
    const c = scramble(plain, i + 3);
    const n = Math.round(mix * c.length);
    return c.slice(0, n) + plain.slice(n);
  };
  return html`<div class="cipher" ref=${ref}>
    <div class="seg cipher-seg" role="group" aria-label="Point de vue">
      <button aria-pressed=${!server} onClick=${() => setServer(false)}><${Icon} name="eye"/>Ce que vous voyez</button>
      <button aria-pressed=${server} onClick=${() => setServer(true)}><${Icon} name="lock"/>Ce que voit le serveur</button>
    </div>
    <div class="cipher-table" aria-live="polite">
      ${ROWS.map(([n, g], i) => html`<div class="cipher-row"><span class="c-name">${show(n, i)}</span><span class="c-grade tnum">${show(g, i + 9).slice(0, Math.max(g.length, Math.round(mix * 10)))}</span></div>`)}
    </div>
    <p class="cipher-cap">${server ? 'Firestore ne reçoit que ce charabia : des données chiffrées en AES-256 dans votre navigateur.' : 'Sur votre écran, tout est clair. La clé ne quitte jamais votre ordinateur.'}</p>
  </div>`;
}

function LandingNav() {
  const s = useStore();
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 8);
    on(); addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return html`<header class=${`topbar land-nav ${scrolled ? 'scrolled' : ''}`}>
    <a class="brand" href="#/" aria-label="Trousse — accueil"><${Logo}/><span>trousse</span></a>
    <nav class="land-links hide-sm" aria-label="Sections">
      <a href="#/" onClick=${(e) => { e.preventDefault(); document.getElementById('outils')?.scrollIntoView({ behavior: 'smooth' }); }}>Les outils</a>
      <a href="#/" onClick=${(e) => { e.preventDefault(); document.getElementById('confiance')?.scrollIntoView({ behavior: 'smooth' }); }}>Vos données</a>
      <a href="#/" onClick=${(e) => { e.preventDefault(); document.getElementById('apropos')?.scrollIntoView({ behavior: 'smooth' }); }}>Qui suis-je ?</a>
    </nav>
    <div class="spacer"></div>
    <button class="btn btn-ghost btn-icon" onClick=${toggleTheme} aria-label=${theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}><${Icon} name=${theme === 'dark' ? 'sun' : 'moon'}/></button>
    ${s.mode === 'cloud' || s.mode === 'demo'
      ? html`<a class="btn btn-primary btn-sm" href="#/classes">${s.mode === 'demo' ? 'Revenir à la démo' : 'Mes classes'}<${Icon} name="arrow-right"/></a>`
      : html`<a class="btn btn-ghost btn-sm" href="#/connexion">Se connecter</a><a class="btn btn-primary btn-sm hide-sm" href="#/demo">Essayer</a>`}
  </header>`;
}

export function Landing() {
  useTitle();
  useReveal();
  const phase1 = TOOLS.filter((t) => t.phase === 1);
  const later = TOOLS.filter((t) => t.phase > 1);
  return html`<div class="landing">
    <${LandingNav}/>
    <main id="main" tabindex="-1">
      <section class="hero seyes">
        <div class="hero-margin" aria-hidden="true"></div>
        <div class="hero-inner">
          <div class="hero-copy">
            <p class="hero-eyebrow"><span class="pill"><${Icon} name="heart"/>Gratuit, sans publicité, sans traqueur</span></p>
            <h1 class="hero-title">Tous vos outils de prof, <em>dans une seule <span class="hl-anim">trousse</span>.</em></h1>
            <p class="hero-sub">Tirage au sort, groupes, plan de classe, minuteur… Tout est déjà branché sur vos classes. Vous préparez moins, vous enseignez plus.</p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg cta-main" href="#/demo"><${Icon} name="sparkles"/>Essayer sans compte<${Icon} name="arrow-right"/></a>
              <a class="btn btn-lg" href="#/inscription">Créer mon compte</a>
            </div>
            <p class="hero-note"><${Icon} name="shield-check"/>Aucune inscription pour essayer. Une classe fictive vous attend.</p>
          </div>
          <div class="hero-stage" aria-hidden="false">
            <div class="stage-sheet"><${MiniPlan}/></div>
            <${MiniDraw}/>
            <${MiniTimer}/>
          </div>
        </div>
      </section>

      <section class="strip">
        <div class="strip-inner">
          ${[
            ['presentation', 'Mode projection', 'Une touche, et tout devient lisible du fond de la classe.'],
            ['cloud-off', 'Marche sans réseau', 'Le Wi-Fi du lycée lâche ? Vos modifications attendent sagement.'],
            ['command', 'Ctrl + K', 'N’importe quelle classe, n’importe quel outil, en deux touches.'],
            ['monitor', 'Partout', 'Ordinateur de la salle, tablette, téléphone : vous retrouvez tout.'],
          ].map(([i, t, d], k) => html`<div class="strip-item reveal" style=${`--d:${k * 70}ms`}><span class="strip-ico"><${Icon} name=${i}/></span><div><h3>${t}</h3><p>${d}</p></div></div>`)}
        </div>
      </section>

      <section class="section" id="outils">
        <div class="section-head reveal">
          <p class="eyebrow">Les outils</p>
          <h2>Ce qui vous prenait vingt minutes<br/><em>prend désormais vingt secondes.</em></h2>
        </div>
        <div class="bento">
          ${phase1.map((t, i) => html`<a class=${`bento-card big reveal b-${t.id}`} style=${`--d:${i * 80}ms`} href=${'#/demo/' + t.id}>
            <div class="bento-art" aria-hidden="true">${BentoArt[t.id]()}</div>
            <div class="bento-text"><span class="bento-ico"><${Icon} name=${t.icon}/></span><h3>${t.name}</h3><p>${t.desc}</p>
            <span class="bento-try">Essayer<${Icon} name="arrow-right"/></span></div>
          </a>`)}
          ${later.map((t, i) => html`<div class="bento-card small reveal" style=${`--d:${i * 40}ms`}>
            <span class="bento-ico"><${Icon} name=${t.icon}/></span><div><h3>${t.name}</h3><p>${t.desc}</p></div><span class="badge badge-soon">Bientôt</span></div>`)}
        </div>
      </section>

      <section class="trust" id="confiance">
        <div class="trust-inner">
          <div class="trust-copy reveal">
            <p class="eyebrow">Vos données, et celles de vos élèves</p>
            <h2>Même nous, on ne peut pas lire vos notes.</h2>
            <p class="lead">Tout est chiffré <strong>dans votre navigateur</strong>, avec une clé que vous seul possédez. Le serveur ne stocke que des données illisibles. Ni Google, ni l’auteur du site ne peuvent voir le nom d’un élève.</p>
            <ul class="trust-list">
              <li><${Icon} name="lock"/><span><strong>Chiffrement de bout en bout</strong> AES-256, mot de passe jamais transmis.</span></li>
              <li><${Icon} name="key-round"/><span><strong>Une clé de secours</strong> à imprimer : la seule façon de tout récupérer si vous oubliez votre mot de passe.</span></li>
              <li><${Icon} name="log-out"/><span><strong>Rien ne reste</strong> sur l’ordinateur de la salle après la déconnexion.</span></li>
              <li><${Icon} name="shield-check"/><span><strong>Hébergé en Europe</strong> (Paris). Aucun cookie publicitaire, aucun traqueur. Jamais.</span></li>
            </ul>
          </div>
          <div class="reveal" style="--d:120ms"><${CipherDemo}/></div>
        </div>
      </section>

      <section class="section about" id="apropos">
        <div class="note-card reveal">
          <div class="note-margin" aria-hidden="true"></div>
          <p class="eyebrow">Un mot de l’auteur</p>
          <blockquote>« Je suis professeur de mathématiques. J’ai créé Trousse parce que je voulais des outils simples, beaux et respectueux de mes élèves — sans publicité, sans abonnement, sans revendre quoi que ce soit. C’est un projet bénévole : il est à vous. »</blockquote>
          <p class="sig">Johann Staal<span>professeur de mathématiques</span></p>
        </div>
      </section>

      <section class="final seyes">
        <div class="final-inner reveal">
          <h2>Prêt pour lundi, 8 h ?</h2>
          <p>Découvrez tout en une minute avec une classe de démonstration.</p>
          <div class="hero-cta center"><a class="btn btn-primary btn-lg" href="#/demo"><${Icon} name="sparkles"/>Essayer sans compte</a>
            <button class="btn btn-lg" onClick=${openPalette}><${Icon} name="search"/>Ou appuyez sur <span class="kbd">Ctrl</span><span class="kbd">K</span></button></div>
        </div>
      </section>
    </main>
    <${Footer}/>
  </div>`;
}

export function Footer() {
  return html`<footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand"><${Logo} size=${26}/><span>trousse</span><p>Des outils libres et gratuits pour les professeurs. Projet non lucratif.</p></div>
      <nav aria-label="Informations légales" class="footer-links">
        <a href="#/mentions-legales">Mentions légales</a><a href="#/confidentialite">Confidentialité</a><a href="#/cgu">Conditions d’utilisation</a>
      </nav>
      <p class="footer-small">Polices Fraunces et Atkinson Hyperlegible (licence OFL) · icônes Lucide (ISC) · aucun cookie.</p>
    </div>
  </footer>`;
}

// Petites illustrations vivantes pour les cartes d'outils.
const BentoArt = {
  tirage: () => html`<div class="art-draw"><span>Hugo</span><span>Lina</span><span class="on">Sacha<svg viewBox="0 0 200 80" class="red-circle static"><path d="M30 46c-2-18 40-30 82-28 40 2 66 12 62 28-4 18-52 24-92 20-34-3-54-10-50-24 2-8 14-14 30-17"/></svg></span><span>Emma</span><span>Théo</span></div>`,
  groupes: () => html`<div class="art-groups">${[['Inès', 'Noah', 'Léa'], ['Adam', 'Jade', 'Rayan'], ['Zoé', 'Hugo', 'Lina']].map((g, i) => html`<div class="ag" style=${`--i:${i}`}><b>Groupe ${i + 1}</b>${g.map((n) => html`<span>${n}</span>`)}</div>`)}</div>`,
  minuteur: () => html`<div class="art-timer"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="ring-bg"/><circle cx="60" cy="60" r="50" class="ring-fg"/></svg><span class="tnum">05:00</span></div>`,
  bruit: () => html`<div class="art-noise"><svg viewBox="0 0 160 96"><path d="M20 86 A60 60 0 0 1 64 30" class="an-g"/><path d="M64 30 A60 60 0 0 1 112 34" class="an-o"/><path d="M112 34 A60 60 0 0 1 140 86" class="an-r"/><line x1="80" y1="86" x2="56" y2="40" class="an-n"/><circle cx="80" cy="86" r="6" class="an-h"/></svg><b>Calme</b></div>`,
  appreciations: () => html`<div class="art-apprec"><div class="aa-crit">${[['Travail', 3], ['Attitude', 2], ['Oral', 1], ['Progrès', 2]].map(([l, v]) => html`<span><b>${l}</b>${[0, 1, 2, 3].map((k) => html`<i class=${k <= v ? 'on' : ''}></i>`)}</span>`)}</div>
    <p>« Inès fournit un travail sérieux et régulier. Elle participe volontiers à l’oral. Les progrès sont encourageants : c’est un bon trimestre. »</p></div>`,
  plan: () => html`<div class="art-plan">${Array.from({ length: 12 }, (_, i) => html`<span class=${i === 4 || i === 9 ? 'on' : ''}></span>`)}</div>`,
};
