#!/usr/bin/env node
// Vérifie que la fiche d'un plugin (README.md, plugin.json) dit vrai sur son code :
//  - touches : chaque touche en gras de la section « Commandes » est lue quelque part dans le code ;
//  - niveaux : « 40 niveaux » dans la fiche, et le code a bien une liste de 40 niveaux ;
//  - synchro : syncMode « aucune » ne garde rien, les autres gardent bien quelque chose, et syncInfo est rempli quand ça synchronise.
// node tools/sheet-check.js <dossier d'un plugin> [<autre dossier>…]   → une ligne par écart ; code de sortie 1 s'il y en a.
// shortcut: lecture du code par expressions régulières, pas par un vrai analyseur : une touche lue via une table calculée peut sortir à tort, à revoir si ça arrive souvent
'use strict';
const fs = require('fs'), path = require('path');

// une touche de la fiche → ce que le code doit contenir pour la lire (e.key, e.code ou un événement de souris)
const MOUSE = { souris: /mouse|pointer/i, clic: /click|pointerdown|mousedown/i, 'clic droit': /contextmenu|button\s*===?\s*2/i, 'double-clic': /dblclick|detail\s*===?\s*2/i,
  molette: /wheel/i, glisser: /pointermove|mousemove|drag/i, toucher: /touch|pointer/i };
const NAMED = { '←': ['ArrowLeft'], '→': ['ArrowRight'], '↑': ['ArrowUp'], '↓': ['ArrowDown'], espace: ["' '", '" "', 'Space'], 'échap': ['Escape'], 'entrée': ['Enter'],
  tab: ['Tab'], 'retour arrière': ['Backspace'], suppr: ['Delete'], maj: ['shiftKey', 'Shift'], ctrl: ['ctrlKey', 'Control'], alt: ['altKey'] };
function keyNeeds(tok) {
  const t = tok.trim().toLowerCase();
  if (MOUSE[t]) return [MOUSE[t]];
  if (/^f\d{1,2}$/.test(t)) return [new RegExp("['\"]" + tok.trim() + "['\"]")];
  return tok.split(/\s*\+\s*|\s+/).filter(Boolean).map(p => {
    const l = p.toLowerCase();
    if (NAMED[l]) return new RegExp(NAMED[l].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
    if (/^[a-z]$/.test(l)) return new RegExp(`['"\`]${l}['"\`]|['"\`]${l.toUpperCase()}['"\`]|Key${l.toUpperCase()}|[[,\\s'"]${l}[\\]'",]|[{,]\\s*${l}\\s*:|\\.${l}\\b`);  // 'q', 'Q', KeyQ, une liste, une table {q: …} ou keys.q
    if (/^\d$/.test(l)) return new RegExp(`['"][0-9]*${l}[0-9]*['"]|Digit${l}|Numpad${l}|\\[[0-9]-[0-9]\\]`);  // '1', '12345'.indexOf(e.key), /^[1-9]$/
    return null;  // un mot de la phrase, pas une touche
  }).filter(Boolean);
}
console.assert(keyNeeds('Q')[0].test('{ArrowLeft: -1, q: -1}') && keyNeeds('5')[0].test("'12345'.indexOf(e.key)") && keyNeeds('4')[0].test('/^[1-9]$/') && keyNeeds('← →').length === 2 && keyNeeds('Espace')[0].test("e.key === ' '") && keyNeeds('Q D')[0].test("'KeyQ'") && keyNeeds('Clic')[0].test('onclick'), 'keyNeeds');

const codeOf = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return /^(node_modules|locales|screenshots|\.git)$/.test(e.name) ? [] : codeOf(p);
  return /\.(js|html)$/.test(e.name) ? [fs.readFileSync(p, 'utf8')] : [];
}).join('\n');

// le nombre d'éléments d'une liste littérale qui commence à text[i] ('[') ; ne compte que le premier niveau
function arrayLen(text, i) {
  let depth = 0, n = 0, any = false, q = null;
  for (let j = i; j < text.length; j++) {
    const c = text[j];
    if (q) { if (c === '\\') j++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; any = true; continue; }
    if (c === '/' && text[j + 1] === '/') { j = text.indexOf('\n', j); continue; }
    if ('[{('.includes(c)) { depth++; if (depth > 1) any = true; continue; }
    if (']})'.includes(c)) { depth--; if (depth === 0) return n + (any ? 1 : 0); continue; }
    if (depth === 1 && c === ',') { n++; any = false; } else if (depth === 1 && /\S/.test(c)) any = true;
  }
  return -1;
}
console.assert(arrayLen('[1, [2, 3], {a: 4}]', 0) === 3 && arrayLen("['a,b', 'c',]", 0) === 2, 'arrayLen');

function check(dir) {
  const out = [], m = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf8'));
  const readme = fs.existsSync(path.join(dir, 'README.md')) ? fs.readFileSync(path.join(dir, 'README.md'), 'utf8') : '';
  const code = codeOf(dir);
  // touches
  const cmds = /^##\s+Commandes\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(readme)?.[1] || '';
  for (const [, tok] of cmds.matchAll(/\*\*([^*]+)\*\*/g)) {
    for (const alt of tok.split(/\s*(?:,|\/| ou )\s*/)) {
      const needs = keyNeeds(alt); if (!needs.length) continue;
      const missing = needs.filter(re => !re.test(code));
      if (missing.length) out.push(`touche « ${alt.trim()} » annoncée dans Commandes, introuvable dans le code`);
    }
  }
  // niveaux
  const lv = /(?<!tous les |\()\b(\d+)\s+niveaux(?! de difficulté)/i.exec(readme);  // pas « tous les 4 niveaux », « 4 niveaux de difficulté », « (5 niveaux ; … »
  if (lv) {
    const want = +lv[1], lens = [];
    for (const mm of code.matchAll(/\b(LEVELS|LVLS|NIVEAUX|LEVEL_LIST|MAPS|PUZZLES|STAGES|WORLDS)\s*[:=]\s*\[/gi)) lens.push(arrayLen(code, mm.index + mm[0].length - 1));
    if (!lens.length) out.push(`« ${want} niveaux » dans la fiche : pas de liste de niveaux trouvée dans le code (à vérifier à la main)`);
    else if (!lens.includes(want)) out.push(`« ${want} niveaux » dans la fiche, le code en a ${[...new Set(lens)].join(' ou ')}`);
  }
  // synchro
  // ce qui écrit des données gardées : le dossier du plugin (folder.write…), le stockage simple, la sauvegarde des jeux (g.save), les anciennes API
  const keeps = /\bstorage\s*\.\s*set\b|\bfolder\s*\.\s*(write|writeFile)\s*\(|\bfolder\(\s*['"](write|writeFile)|_*storeSet\s*\(|\bg\s*\.\s*save\s*\(|\bwriteDoc\s*\(|\bmusicStorage\s*\(|\bapi\(\s*['"](games|journal|budget|anime)|\bgames\s*[?.]\s*\w+\s*=/.test(code);
  const mode = m.syncMode || 'aucune';
  if (mode === 'aucune' && String(m.syncInfo || '').trim() && !/^Rien\b/i.test(m.syncInfo.trim())) out.push('syncMode « aucune » (rien ne part en synchro), mais syncInfo annonce : « ' + m.syncInfo + ' »');
  if (mode !== 'aucune' && !keeps) out.push(`syncMode « ${mode} », mais le code ne garde aucune donnée`);
  if (mode !== 'aucune' && !String(m.syncInfo || '').trim()) out.push(`syncMode « ${mode} » sans syncInfo : la fiche ne dit pas ce qui est synchronisé`);
  return out;
}

if (require.main === module) {
  let bad = 0;
  for (const dir of process.argv.slice(2)) {
    let errs; try { errs = check(dir); } catch (e) { errs = ['illisible : ' + e.message]; }
    for (const e of errs) console.log(path.basename(dir) + ' : ' + e);
    bad += errs.length;
  }
  if (bad) { console.log(bad + ' écart(s)'); process.exitCode = 1; } else console.log('fiches conformes');
}
module.exports = { check, keyNeeds, arrayLen };
