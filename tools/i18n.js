// The texts of a plugin (or of NeoDex) that a person reads, found in its source, and the check that its locales/en.json translates
// them all. NeoDex shows the English text in place of the French one when the interface is in English; the approval tool refuses
// to sign a plugin whose locales/en.json is missing or incomplete.
//   node tools/i18n.js missing <plugin folder>   -> the texts not yet translated (exit code 1 if any)
//   node tools/i18n.js list <plugin folder>      -> every text found
// locales/en.json: { "Texte en français": "English text", … } — the keys are the French texts exactly as written (spaces collapsed).
const fs = require('fs'), path = require('path');

const norm = s => String(s).replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const FR_WORDS = /(?:^|[\s'’(«])(?:de|la|le|les|un|une|des|et|à|pour|ton|ta|tes|ce|cette|ces|est|pas|du|en|sur|avec|dans|ou|au|aux|plus|se|ne|qui|que|tu|il|elle|ils|son|sa|ses|mon|ma|mes|par|sans|vers|chez|leur|leurs|rien|tout|tous|toutes)(?=$|[\s'’,.!?:;)»…])/i;
// is it something a person reads (a label, a sentence), not code (an id, a class list, CSS, a URL)?
function isText(s) {
  s = norm(s);
  if (s.length < 2 || s.length > 1500 || !/\p{L}/u.test(s)) return false;
  if (/^(https?:|data:|blob:|neoplugin:|file:|mailto:|#[\w-]|\.[a-z][\w-]*\s*[{,]|@media|var\(--)/i.test(s)) return false;  // addresses, selectors, CSS
  if (/[{};]\s*$|^[\w-]+\s*:\s*[^ ]+;|=>|===|&&|\|\||\bfunction\b|\(\)|\$\{|^\s*</.test(s)) return false;  // code, CSS rules, markup
  if (/^[\w.$/-]+$/.test(s) && !/^\p{Lu}[\p{Ll}-]+$/u.test(s) && !/^\p{Lu}{3,}$/u.test(s) && !/[^\x00-\x7f]/.test(s)) return false;  // an identifier (Capitalised or CAPS words stay: « Annuler », « OUVRIR »)
  if (/[àâäçéèêëîïôöùûüÿœæ«»’…]/i.test(s)) return true;
  const w = s.replace(/\s*\([^()]*\)$/, '').replace(/^[+•·]\s*/, '');  // « Suivant (Alt+→) », « + Dossier »
  if (/\s/.test(w)) return FR_WORDS.test(w) || /^[\p{Lu}\d][\p{L}\d'’-]*(\s+[\p{L}\d'’:/·-]+)+\s*[.!?…]?$/u.test(w) || (/^[\p{Lu}\d'’ -]+\s*[?!]?$/u.test(w) && /\p{Lu}{3}/u.test(w));  // a sentence, « Nouveau compte », « Synchro : fusion », « 7 JOURS »
  return /^\p{Lu}[\p{Ll}'’-]+$/u.test(w) || /^\p{Lu}[\p{Lu}'’-]{2,}$/u.test(w);  // shortcut: a lone lowercase word (« lancer ») is not told apart from code, a word list would
}
// the readable parts of some HTML: text between tags, and title / placeholder / aria-label / alt
function fromHtml(h, out) {
  for (const m of h.matchAll(/\s(?:title|placeholder|aria-label|alt)="([^"]*)"/g)) if (isText(decode(m[1]))) out.add(norm(decode(m[1])));
  for (const m of h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').matchAll(/>([^<>]+)</g)) { const t = decode(m[1]); if (isText(t)) out.add(norm(t)); }
}
// the string literals of a JS (or HTML) file: '…', "…", `…` (the fixed parts of a template), comments skipped
function extract(src, out = new Set()) {
  if (/^\s*<(!doctype|html|div|body)/i.test(src)) {  // a page: its markup, and the code of its inline scripts
    fromHtml(src, out);
    for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) extract(m[1], out);
    return out;
  }
  let i = 0; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '', parts = [];
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') { const e = src[j + 1]; s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'u' ? String.fromCharCode(parseInt(src.substr(j + 2, 4), 16)) : e; j += e === 'u' ? 6 : 2; continue; }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') { parts.push(s); s = ''; let depth = 1; j += 2; while (j < n && depth) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; } continue; }
        if (c !== '`' && src[j] === '\n') break;  // not a string (a regex with a quote, say): give up on it
        s += src[j++];
      }
      parts.push(s);
      for (const p of parts) { if (/<[a-z][^>]*>/i.test(p)) fromHtml(p, out); else if (isText(p)) out.add(norm(p)); }
      i = j + 1; continue;
    }
    i++;
  }
  return out;
}
// every text of a plugin folder: plugin.json's name and description, its .js / .html / .mjs files (not the vendored ones)
function pluginTexts(dir) {
  const out = new Set(), m = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
  for (const s of [m.name, m.description, m.syncInfo, ...(m.notifications || []).flatMap(n => [n?.name, n?.description]), ...(m.commands || []).map(c => c?.title)]) if (typeof s === 'string' && s.trim()) out.add(norm(s));  // what NeoDex shows of plugin.json
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (/^(\.git|node_modules|vendor|lib|locales|screenshots|engine|dist)$/.test(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f); else if (/\.(m?js|html)$/.test(e.name) && !/\.min\./.test(e.name)) extract(fs.readFileSync(f, 'utf8'), out);
  } };
  walk(dir);
  return out;
}
function missing(dir) {
  let en = {}; try { en = JSON.parse(fs.readFileSync(path.join(dir, 'locales', 'en.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('locales/en.json illisible : ' + e.message); return { file: false, missing: [...pluginTexts(dir)] }; }
  return { file: true, missing: [...pluginTexts(dir)].filter(k => typeof en[k] !== 'string' || !en[k].trim()) };
}

if (require.main === module) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'test' || !cmd) {
    const assert = require('assert');
    for (const s of ['Annuler', 'OUVRIR', 'Nouveau compte', 'pas de réseau', 'Le coffre est vide.', 'Supprimer « ', 'Suivant (Alt+→)', '+ Dossier', 'Coffre-fort', 'Synchro : fusion', '7 JOURS', 'FERMER NEODEX ?', "AUJOURD'HUI"]) assert(isText(s), s);
    for (const s of ['btn px', 'allow-scripts allow-pointer-lock', 'click', '#prList', 'https://x.fr', 'display:none;', 'a => b', 'neodex.budget', 'px']) assert(!isText(s), s);
    const got = extract(`const H = "<div title=\\"Fermer la fenêtre\\"><b>Bonjour</b> <span class=\\"x\\">2</span></div>"; toast('Mot de passe copié'); el('div', 'hint px', \`Il reste \${n} jours\`); // Commentaire ignoré`);
    assert.deepStrictEqual([...got].sort(), ['Bonjour', 'Fermer la fenêtre', 'Il reste', 'Mot de passe copié'].sort());
    console.log('i18n: ok');
  } else if (cmd === 'list') console.log([...pluginTexts(dir)].join('\n'));
  else if (cmd === 'missing') { const r = missing(dir); if (!r.file) console.log('pas de locales/en.json'); for (const k of r.missing) console.log(k); process.exit(r.missing.length || !r.file ? 1 : 0); }
}
module.exports = { extract, isText, pluginTexts, missing, norm };
