// « Favori magique » pour École Directe : il remplit les cases « Appréciations Matières »
// de la page ouverte, dans le navigateur du professeur. Rien n'est envoyé nulle part.
//
// Fonctionnement :
//  1. Trousse copie dans le presse-papiers : TROUSSE1 + JSON [{ f: prénom, l: nom, t: texte }]
//  2. Sur la page de saisie d'École Directe, le favori lit ce contenu (ou demande de le coller),
//     retrouve la ligne de chaque élève par son nom, et remplit la case correspondante.

export const ED_LIMIT = 500;
export const PAYLOAD_PREFIX = 'TROUSSE1';

export function payloadFor(students, texts) {
  const items = students.filter((s) => texts[s.id]).map((s) => ({ f: s.first, l: s.last, t: texts[s.id] }));
  return PAYLOAD_PREFIX + JSON.stringify(items);
}

// Le code ci-dessous s'exécute dans la page d'École Directe (et non dans Trousse).
function edFiller() {
  var P = 'TROUSSE1';
  var norm = function (s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var old = document.getElementById('trousse-box'); if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'trousse-box';
  box.style.cssText = 'position:fixed;z-index:2147483647;top:20px;right:20px;width:380px;background:#fffdf9;color:#1a1d36;border:2px solid #2e44c9;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.3);padding:18px;font:15px/1.45 Arial,sans-serif';
  document.body.appendChild(box);
  var say = function (html) { box.innerHTML = '<div style="font-weight:700;font-size:17px;margin-bottom:8px">Trousse</div>' + html + '<div style="margin-top:12px;text-align:right"><button id="trousse-close" style="font:inherit;padding:6px 14px;border-radius:8px;border:1px solid #999;background:#fff;cursor:pointer">Fermer</button></div>'; document.getElementById('trousse-close').onclick = function () { box.remove(); }; };
  var fill = function (ta, text) {
    var setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    ta.focus(); setter.call(ta, text);
    ['input', 'change', 'keyup'].forEach(function (ev) { ta.dispatchEvent(new Event(ev, { bubbles: true })); });
    ta.blur();
    ta.style.background = '#fff4c2';
  };
  var run = function (raw) {
    raw = (raw || '').trim();
    if (raw.indexOf(P) !== 0) { say('<p>Je ne trouve pas les appréciations de Trousse.</p><p>Dans Trousse, cliquez d’abord sur <b>« Copier les appréciations »</b>, puis revenez ici et cliquez de nouveau sur le favori.</p>'); return; }
    var items; try { items = JSON.parse(raw.slice(P.length)); } catch (e) { say('<p>Le contenu copié est incomplet. Recommencez la copie dans Trousse.</p>'); return; }
    var tas = Array.prototype.slice.call(document.querySelectorAll('textarea')).filter(function (t) { return t.offsetParent !== null && !t.disabled && !t.readOnly && !t.closest('#trousse-box'); });
    if (!tas.length) { say('<p>Je ne trouve aucune case d’appréciation sur cette page.</p><p>Ouvrez la page de <b>saisie des appréciations</b> de la classe, puis recliquez sur le favori.</p>'); return; }
    // Texte de la ligne de chaque case (nom de l'élève).
    var rowText = tas.map(function (t) { var r = t.closest('tr') || t.parentElement; for (var k = 0; k < 6 && r && norm(r.innerText).length < 4; k++) r = r.parentElement; return norm(r ? r.innerText : ''); });
    var used = {}, plan = [], missing = [];
    items.forEach(function (it) {
      var f = norm(it.f), l = norm(it.l), best = -1;
      for (var i = 0; i < tas.length; i++) { if (used[i]) continue; var rt = ' ' + rowText[i] + ' '; if ((l && rt.indexOf(' ' + l + ' ') >= 0 || !l) && rt.indexOf(' ' + f + ' ') >= 0) { best = i; break; } }
      if (best < 0) for (var j = 0; j < tas.length; j++) { if (used[j]) continue; if (l && rowText[j].indexOf(l) >= 0) { best = j; break; } }
      if (best >= 0) { used[best] = 1; plan.push([tas[best], it.t]); } else missing.push(it.f + ' ' + it.l);
    });
    var go = function (pl, extra) {
      pl.forEach(function (p) { fill(p[0], p[1]); });
      var long = pl.filter(function (p) { return p[1].length > 500; }).length;
      say('<p style="font-size:16px"><b>✓ ' + pl.length + ' appréciation' + (pl.length > 1 ? 's' : '') + ' remplie' + (pl.length > 1 ? 's' : '') + '</b> (surlignées en jaune).</p>' + (extra || '') + (long ? '<p style="color:#b9302a">' + long + ' dépasse' + (long > 1 ? 'nt' : '') + ' 500 caractères : vérifiez-les.</p>' : '') + '<p><b>Relisez</b>, puis cliquez sur le bouton <b>Enregistrer</b> d’École Directe.</p>');
    };
    if (missing.length && plan.length < items.length / 2 && tas.length === items.length) {
      // Les noms ne sont pas visibles à côté des cases : on propose l'ordre de la liste.
      say('<p>Je ne retrouve pas les noms des élèves à côté des cases.</p><p>Il y a <b>' + tas.length + ' cases</b> et <b>' + items.length + ' appréciations</b>. Voulez-vous les remplir <b>dans l’ordre de la liste</b> ? Vérifiez bien ensuite que chaque appréciation est en face du bon élève.</p><p><button id="trousse-order" style="font:inherit;font-weight:700;padding:8px 14px;border-radius:8px;border:0;background:#2e44c9;color:#fff;cursor:pointer">Remplir dans l’ordre</button></p>');
      document.getElementById('trousse-order').onclick = function () { go(items.map(function (it, i) { return [tas[i], it.t]; }), '<p>Remplies <b>dans l’ordre de la liste</b> : vérifiez chaque nom.</p>'); };
      return;
    }
    go(plan, missing.length ? '<p style="color:#a8620c">Élève' + (missing.length > 1 ? 's' : '') + ' non trouvé' + (missing.length > 1 ? 's' : '') + ' sur la page : ' + missing.join(', ') + '.</p>' : '');
  };
  var ask = function () {
    say('<p>Collez ici les appréciations copiées depuis Trousse (<b>Ctrl + V</b>) :</p><textarea id="trousse-paste" style="width:100%;height:80px;font:13px monospace;border:1px solid #999;border-radius:8px;padding:6px"></textarea>');
    var t = document.getElementById('trousse-paste'); t.focus();
    t.addEventListener('input', function () { if (t.value.trim()) run(t.value); });
  };
  say('<p>Lecture des appréciations copiées…</p>');
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (x) { if (x && x.trim().indexOf(P) === 0) run(x); else ask(); }, ask);
  else ask();
}

/** Le lien du favori (à glisser dans la barre de favoris). */
export const BOOKMARKLET = 'javascript:' + encodeURIComponent('(' + edFiller.toString() + ')()');
