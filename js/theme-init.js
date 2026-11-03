// Applique le thème avant l'affichage pour éviter tout flash blanc.
(function () {
  try {
    var p = localStorage.getItem('trousse.theme') || 'system';
    var dark = p === 'dark' || (p === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
