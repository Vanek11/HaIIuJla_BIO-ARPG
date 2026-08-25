/* =========================================================
   BIO-ARPG :: global click delegation
   Any element with [data-call] triggers window[fn] on click.
   Optional attributes:
     data-args      comma-separated argument list (numbers auto-parsed)
     data-self-only fire only when the element itself was clicked
                    (used for modal backdrops)
   ========================================================= */
document.addEventListener('click', function(e){
  const el = e.target.closest('[data-call]');
  if(!el) return;
  if(el.hasAttribute('data-self-only') && e.target !== el) return;
  const fn = window[el.dataset.call];
  if(typeof fn !== 'function') return;
  const raw = el.getAttribute('data-args');
  const args = raw ? raw.split(',').map(function(s){
    s = s.trim();
    if(s === '') return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
  }) : [];
  fn.apply(null, args);
});
