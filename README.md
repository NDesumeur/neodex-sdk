# SDK des plugins NeoDex

NeoDex est un cœur minimal (accueil, navigateur, NeoStore, autorisations). Tout le reste —
jeux, outils, bureautique, lecteurs — est un **plugin** : un dépôt GitHub que NeoStore trouve,
télécharge et installe, indépendamment de NeoDex.

Ce dépôt décrit le format d'un plugin, l'API mise à disposition et la façon d'en publier un.

## Créer un plugin en 4 étapes

1. Crée un dépôt GitHub et ajoute-lui le *topic* **`neodex-plugin`** (Settings → Topics).
   C'est ainsi que NeoStore trouve les plugins.
2. Mets à la racine un fichier **`plugin.json`** (voir le format plus bas) et le code du plugin.
3. Publie une **Release** GitHub. Joins-y l'archive du plugin (`<id>-<version>.zip`) : c'est le
   fichier que NeoStore télécharge.
4. (Officiel) Fais approuver ton plugin pour qu'il reçoive une attestation signée et entre au
   catalogue officiel. Voir « Approbation ».

L'exemple complet le plus simple est dans [`examples/hello`](examples/hello).

## Le fichier `plugin.json`

```json
{
  "id": "neodex.hello",
  "name": "Bonjour",
  "version": "1.0.0",
  "author": "TonPseudo",
  "description": "Un plugin d'exemple.",
  "icon": "icon.png",
  "entry": "index.js",
  "view": "hello",
  "neobase": ">=4.1.0",
  "sdk": "2.1.0",
  "type": "app",
  "category": "Outils",
  "mobile": true,
  "compatibility": ["windows", "android", "linux"],
  "system": false,
  "dependencies": {},
  "permissions": ["storage"]
}
```

| Champ | Rôle |
|-------|------|
| `id` | identifiant unique, en minuscules, style `auteur.nom` (ne change jamais) |
| `name` | nom affiché |
| `version` | version **semver** (`MAJEUR.MINEUR.CORRECTIF`) ; remonte-la à chaque Release |
| `author` | ton nom ou pseudo |
| `description` | une phrase |
| `icon` | fichier image dans l'archive (PNG carré conseillé) |
| `entry` | le script chargé par NeoDex (défaut `index.js`) |
| `view` | identifiant de la vue que le plugin crée (unique) |
| `neobase` | plage de versions de NeoDex compatibles (semver range) |
| `type` | `app` (une application), `mod` (modifie NeoDex : sorties animes, calendrier…) ou `theme` (n'apporte que des thèmes) |
| `category` | catégorie dans NeoStore (Jeux, Outils, Bureautique…) |
| `mobile` | `true` si compatible avec le téléphone |
| `compatibility` | **à déclarer dans chaque plugin** : les systèmes où il marche, parmi `"windows"`, `"android"` et `"linux"`. NeoDex refuse de l'installer sur un autre système et NeoStore affiche la liste sur la fiche. Un plugin qui lance du code natif (`main`, `system:main`, `system:startup`, `system:processes`) doit vérifier qu'il marche vraiment sur chaque système qu'il annonce. (Pour les anciens plugins sans le champ : `windows` et `linux`, plus `android` si `mobile` ; seulement `windows` si le plugin lance du code natif avec `system:main`, `system:startup` ou `system:processes`). NeoDex refuse de l'installer ailleurs et NeoStore l'affiche |
| `system` | réservé : un plugin système ne peut pas être désinstallé et se range dans la catégorie « Système » (fixé par NeoDex, pas par l'auteur). Réservé aux applis qui dépendent du cœur de NeoDex |
| `main` | le **volet système** du plugin : un fichier Node (`main.js`) chargé par NeoDex seulement si le plugin est signé, activé et que l'autorisation `system:main` est accordée (voir plus bas) |
| `commands` | ses commandes : `[{ "id": "find", "title": "Chercher", "keys": "Ctrl+Alt+F", "global": false, "background": false }]`, dans la palette de commandes et la recherche de l'accueil (`ctx.commands.on`) ; `global` : raccourci actif hors de NeoDex (autorisation `shortcuts`) ; `background` : sans passer l'onglet au premier plan |
| `opens` | « ouvrir avec » : les extensions qu'il sait ouvrir, `[".pdf"]` ; Fichiers et la Visionneuse lui envoient les fichiers (`ctx.onFiles`) |
| `accepts` | ce qu'on peut lui partager : `["text", "url"]` (`ctx.onShare`) |
| `widget` | `true` : il pose un widget sur l'accueil (`ctx.widget`) |
| `themes` | des thèmes pour NeoDex : `[{ "id": "menthe", "name": "Menthe", "hue": 150, "sat": 40, "accent": "#33dd99", "light": "#aaffdd", "third": "#ffd84a" }]` |
| `sync` | les règles de fusion de la synchro pour les documents du plugin (voir « Le dossier de données ») |
| `dependencies` | autres plugins requis : `{ "neodex.autreplugin": ">=1.2.0" }` (installés automatiquement depuis le catalogue) |
| `uses` | plugins dont celui-ci lit les données : `["neodex.peche"]` (demande la permission `data:<id>:read`) |
| `exposes` | ce que ce plugin partage : `{ "storage": "read" }` ou `{ "storage": "write" }` |
| `sdk` | version du SDK et du registre des autorisations visée : `"2.1.0"` |
| `permissions` | liste des autorisations demandées (voir plus bas) |

Le schéma de validation est dans [`plugin.schema.json`](plugin.schema.json).

## Le code du plugin

`entry` exporte une fonction par défaut. NeoDex l'appelle avec un contexte `ctx` : le plugin
n'a accès qu'à ce contexte, jamais au reste de NeoDex ni aux autres plugins.

```js
export default async function (ctx) {
  const box = ctx.el('div', 'hello');
  box.textContent = 'Bonjour ' + ctx.id;
  ctx.view.append(box);

  const saved = await ctx.folder.read('notes');      // un document de TON dossier de données : sauvegardé par NeoDex
  box.textContent = saved?.note || 'Bonjour';
  ctx.onOpen(() => box.focus?.());
}
```

### Le bac à sable

Chaque plugin tourne dans une `<iframe sandbox>` à lui, dans son propre processus : il n'a accès ni à NeoDex, ni aux autres plugins, ni au PC.
Il reçoit pourtant le style de NeoDex (polices, couleurs du thème, classes `btn`, `card`…) et ses outils d'interface (`ctx.host`).
Ce que le bac à sable interdit passe par NeoDex, qui vérifie l'autorisation à chaque appel :
- `localStorage` est en mémoire (utilise `ctx.folder` pour garder des données) ;
- `fetch` passe par `ctx.net` (seulement les domaines déclarés) ; `fetch('neoplugin://<son id>/…')` lit son propre volet système ;
- le presse-papiers : écrire est libre, lire demande `clipboard` ;
- `window.neo` est le même pont que `ctx.neo`.

### Ce que contient `ctx`

| Membre | Disponible | Rôle |
|--------|-----------|------|
| `ctx.id`, `ctx.version` | toujours | identité du plugin |
| `ctx.view` | toujours | l'élément HTML à remplir (ta fenêtre) |
| `ctx.el(tag, class?, text?)` | toujours | créer un élément (aide) |
| `ctx.ui.toast(msg, err?)` | toujours | message éphémère |
| `ctx.ui.newTab(url)` | toujours | ouvrir un onglet |
| `ctx.ui.pixIcon(rows)` | toujours | icône pixel art |
| `ctx.onOpen(fn)`, `ctx.onClose(fn)` | toujours | à l'ouverture / fermeture de la vue |
| `ctx.folder.read(nom)` / `.write(nom, json)` / `.remove(nom)` / `.list()` | `storage` | les **documents JSON** de ton dossier de données |
| `ctx.folder.readFile(nom)` / `.writeFile(nom, base64)` / `.removeFile(nom)` / `.listFiles()` | `storage` | les **fichiers** (images, sons…) de ton dossier de données, en base64 |
| `ctx.storage.get()` / `.set(data)` | `storage` | raccourci : le document `storage` de ton dossier |
| `ctx.data.get(idAutrePlugin)` / `.set(idAutrePlugin, données)` | `data:<id>:read` / `:write` | lire ou modifier le document `storage` d'un autre plugin qui le partage (`exposes`) |
| `ctx.host` | toujours | les outils d'interface de NeoDex : `el`, `toast`, `sfx`, `ask`, `newTab`, `pixIcon`, `PIX`, `WX`, `addStyle(css)`, `sky()`, `win('focus' \| 'fs')`, **`confirm(message)`** (boîte de confirmation de NeoDex, renvoie une promesse `true`/`false`, jamais la fenêtre de Windows), `box({title, text, buttons, danger})`, `settings()` (réglages de NeoDex en lecture seule), `tabLabel(texte, titre)` (le texte de ton onglet : messages non lus…), `pref(nom)` (un réglage de NeoDex, lecture seule), **`hooks({audio, mute, onClose, onTabChange, playing})`** : dis à NeoDex si ton plugin joue du son (haut-parleur sur l'onglet, NeoMe qui danse), ce qu'il doit faire quand ton onglet se ferme ou que l'utilisateur change d'onglet (mini-lecteur…) |
| `ctx.legacy` | plugin signé | lecture seule de **ses propres** données d'avant les plugins (`settings()`, `api(nom)`, `local(clé)`), pour reprendre ce que l'utilisateur avait à la première ouverture |
| `ctx.neo.<fonction>(…)` | selon la fonction | les fonctions du PC, chacune derrière son autorisation : `documents` (ouvrir, convertir, PDF, Word/Excel), `screen`, `music`, `system:info`… (liste dans le tableau des autorisations). `ctx.neo.onXxx(fn)` s'abonne à un événement. Une fonction hors de la liste n'existe pas |
| `ctx.commands.on(id, fn)` / `.run(id)` | toujours | exécuter les commandes déclarées dans `commands` |
| `ctx.onFiles(fn)` | `opens` | recevoir les fichiers ouverts avec le plugin (chemins) |
| `ctx.share(données)` / `ctx.onShare(fn)` | toujours / `accepts` | partager un texte ou un lien ; recevoir ce qu'on lui partage |
| `ctx.search.provide(fn)` | `search` | ses résultats dans la recherche de l'accueil : `fn(q)` renvoie `[{ id, title, hint }]` (8 au plus) ; un clic ouvre le plugin et lance sa commande `search` avec l'`id` choisi |
| `ctx.widget.set({ title, text })` ou `({ title, lines: [...], actions: [{ label, command }] })` / `.clear()` | `widget: true` | son widget sur l'accueil (4 lignes au plus) ; `actions` : jusqu'à 3 boutons, chacun lance une de tes `commands` (un id non déclaré est ignoré) |
| `ctx.background.every(minutes, fn)` | `background` | une tâche de fond, même onglet fermé (plugin chargé au démarrage) |
| `ctx.backup.list()` / `.restore(nom)` | `storage` | les sauvegardes de son dossier de données, et revenir à l'une d'elles |
| `ctx.files.add/read/remove` | `files` | fichiers (images, exports…) du plugin |
| `ctx.net(url, opts)` | `network` ou `network:<domaine>` | requêtes réseau sortantes |
| `ctx.permission(nom, raison)` | toujours | demander une autorisation au moment de l'utiliser, en disant pourquoi ; l'utilisateur choisit « cette fois », « toujours » ou « refuser » ; renvoie un booléen |
| `ctx.notifications.send({ title, body, open })` | `notifications` | une notification dans le centre de notifications de NeoDex (et une notification Windows si NeoDex n'est pas au premier plan) ; `open` : ce qu'un clic ouvre (`https://…`, `plugin:<id>`, `neodex:…`) |

### Les autorisations

Toutes les autorisations viennent d'un seul registre, [`permissions.json`](permissions.json) (registre 2, SDK 2.1.0).
Pour chacune, il donne son identifiant, son libellé, la phrase montrée à l'utilisateur et son niveau de risque.
Une autorisation absente du registre fait échouer la validation du plugin.

Un plugin ne reçoit que les autorisations qu'il déclare **et** que l'utilisateur accorde.
L'utilisateur les voit dans l'appli **Autorisations**, par plugin ou par autorisation, et peut les retirer quand il veut.
Le plugin redemande une autorisation au moment où il en a besoin, avec `ctx.permission(nom, raison)`.

NeoDex contrôle chaque appel lui-même. Un appel sans l'autorisation échoue avec une erreur dont le message commence par `PERMISSION_DENIED`.

| Autorisation | Risque | Donne accès à |
|--------------|--------|---------------|
| `storage` | faible | ses propres données : sans plafond pour un plugin signé, 1 Go au plus pour un plugin non vérifié |
| `files` | faible | les fichiers livrés avec le plugin, rien d'autre sur le PC |
| `notifications` | faible | le centre de notifications de NeoDex |
| `network:exemple.org` | faible | ce domaine seulement ; `network:*.exemple.org` couvre aussi ses sous-domaines |
| `network` | moyen | tous les sites Internet (préfère les domaines) |
| `clipboard` | moyen | lire et écrire le presse-papiers |
| `data:<id>:read` | moyen | lire les données qu'un autre plugin partage |
| `data:<id>:write` | élevé | modifier les données qu'un autre plugin partage |
| `system:exec:<programme>` | élevé | lancer un programme de la liste blanche du registre (`explorer`, `notepad`, `winget`…). Plugins **signés** seulement, toujours demandé à l'utilisateur |
| `documents` | élevé | les fichiers du PC que l'utilisateur choisit ou glisse : ouvrir, convertir, lire un PDF, importer et exporter Word/Excel/PowerPoint (`ctx.neo.pdfRead`, `convRun`, `officeImport`, `pathOf`…) |
| `screen` | élevé | une capture de l'écran (`screenCapture`) |
| `music` | moyen | la bibliothèque de NeoMusic (`music*`) |
| `agenda` | faible | ses événements dans l'emploi du temps (`ctx.host.agenda.sync`) |
| `taskbar` | faible | un compagnon sur la barre des tâches (`tbPet*`) |
| `background` | moyen | des tâches de fond, et être chargé au démarrage |
| `search` | moyen | ses résultats dans la recherche de l'accueil |
| `shortcuts` | moyen | des raccourcis globaux (hors de NeoDex) |
| `system:info` | moyen | l'état du PC : processeur, mémoire, programmes ouverts, icônes des programmes |
| `system:processes` | élevé | fermer un programme. Plugins **signés** seulement |
| `system:startup` | élevé | les programmes lancés au démarrage de Windows. Plugins **signés** seulement |
| `system:terminal` | élevé | un terminal (PowerShell). Plugins **signés** seulement |
| `system:update` | élevé | les mises à jour de NeoDex et des plugins. Plugins **signés** seulement |
| `system:main` | élevé | charger son **volet système** (`main`, code Node). Plugins **signés** seulement, demandé à la première ouverture |
| `full` | élevé | **accès complet** : le plugin tourne dans la page de NeoDex, sans bac à sable. Réservé aux rares plugins **signés** qui pilotent NeoDex lui-même (onglets, pages web intégrées). Jamais accordé d'office : NeoDex le demande à la première ouverture, avec un avertissement. Préfère toujours les autorisations précises |

**Partager ses données.** Un plugin ne lit les données d'un autre que si ce dernier les partage dans son manifeste.
- `"exposes": { "storage": "read" }` : les autres peuvent les lire.
- `"exposes": { "storage": "write" }` : les autres peuvent les lire et les modifier.

L'accord de l'utilisateur ne suffit pas. `ctx.data.get(id)` lit les données, `ctx.data.set(id, données)` les modifie.

**Mises à jour.** Une nouvelle version qui demande plus d'autorisations ne s'installe pas d'office.
NeoDex montre ce qui s'ajoute et attend l'accord de l'utilisateur. D'ici là, l'ancienne version reste en place.

**Migration.** Déclare `"sdk": "2.1.0"` dans ton manifeste.
- Les anciens noms sont convertis tout seuls, d'après la table `legacy` du registre : `data:<id>` devient `data:<id>:read`.
- Un plugin sans `sdk` dont les données sont lues sans `exposes` reste lisible pour l'instant, avec un message de dépréciation dans le journal.
- Ce cas sera refusé dans une prochaine version du registre.

Demande le minimum : un plugin qui réclame trop d'autorisations est refusé à l'examen.

## Le dossier de données du plugin

Chaque plugin a son **dossier de données**, `plugindata/<id>/` dans les données de NeoDex. Il contient :

- des **documents JSON** (`ctx.folder.read/write`) ;
- des **fichiers** (`ctx.folder.readFile/writeFile`), rangés dans `files/`.

NeoDex s'en sert pour la **sauvegarde cloud** : chaque document devient une section de la synchro
entre appareils (fusionnée champ par champ, avec gestion des conflits dans fgestion), chaque fichier est
copié dans le fichier de synchro, et le tout est dans les sauvegardes automatiques. Tu n'as rien à faire :
écris tes données dans ton dossier et elles suivent l'utilisateur d'un appareil à l'autre.

Règles :

- noms de documents et de fichiers : lettres, chiffres, `.`, `_`, `-` (80 caractères au plus, jamais `..`) ;
- 8 Mo au plus par document, 15 Mo au plus par fichier ;
- une structure **avec des listes d'objets portant un `id`** se fusionne finement entre appareils
  (deux appareils qui ajoutent chacun une ligne gardent les deux) ;
- un plugin **ne lit jamais** le dossier d'un autre, sauf via `ctx.data.get` après autorisation.

### Reprendre les données d'avant

Un plugin qui remplace une ancienne appli de NeoDex (`full` uniquement) peut lire **une fois**, à la
première ouverture, ce que l'utilisateur avait (`ctx.legacy`), le copier dans son dossier, puis ne plus
jamais y toucher. Exemple : si `ctx.folder.read('budget')` renvoie `null`, lire `await ctx.legacy.api('budget')`
et l'écrire dans le dossier.

### Les règles de fusion de la synchro

Chaque document du dossier part dans le fichier de synchro (une section `pd/<id>/<nom>`), sur tous tes PC et, plus tard, tes téléphones. Quand deux appareils ont changé le même morceau, NeoDex garde les deux versions et te demande de choisir. Pour un document fait de compteurs, de caches ou d'une liste qui ne fait que grandir, déclare comment fusionner dans `plugin.json` :

```json
"sync": { "library": { "auto": ["session", "stats.*"], "union": ["stats.history"] } }
```

- `auto` : des chemins dans le document, où le plus récent gagne sans rien demander (`*` = un niveau).
- `union` : des listes sans identifiant qui ne font que grandir : on garde l'union des deux.

## Le volet système d'un plugin (`main`)

Un plugin qui a besoin de Node ou d'Electron (lancer un programme, lire des fichiers du PC, des raccourcis globaux, servir des fichiers) met ce code dans un fichier `main.js`, nommé par le champ `main`. NeoDex le charge **seulement** si le plugin est signé, activé et a reçu l'autorisation `system:main` : aucun code de ce genre ne vit dans le cœur.

```js
module.exports = api => {
  api.ipcMain.handle('mon:salut', async (_, nom) => 'Salut ' + nom);   // appelé par la page du plugin
  api.protocol(async (req, url) => api.serveFile(monFichier, req));    // sert neoplugin://<id>/…
  api.emit('mon:evenement', { x: 1 });                                  // prévient la page
  return () => { /* nettoyage quand le plugin est désactivé ou mis à jour */ };
};
```

`api` contient : `id`, `electron`, `getWin`, `dataDir`, `ipcMain.handle`, `emit`, `protocol`, `serveFile`, `onShortcutReset`, `readDoc` et `writeDoc` (les documents du dossier du plugin).

Dans la page du plugin : `await ctx.neo.pluginMain('<id>', 'mon:salut', 'toi')` appelle ce code, et `ctx.neo.onPluginMain(e => …)` reçoit ses événements (`e.id`, `e.name`, `e.data`). Les fichiers servis sont à l'adresse `neoplugin://<id>/…`. Mets `main.js` (et les fichiers qu'il utilise) dans l'archive, à côté de `plugin.json` et `index.js`. Un plugin peut appeler le volet système d'un autre en le déclarant dans `dependencies`.

## Isolation, désinstallation

- Un plugin ne peut pas lire ni modifier les fichiers d'un autre plugin ni le cœur de NeoDex.
- Son **code** est retéléchargé sur chaque appareil depuis sa Release (signature revérifiée) : un plugin
  installé sur un appareil apparaît installé sur les autres.
- À la désinstallation, NeoDex propose de **garder** les données (elles restent dans la synchro et
  reviennent à la réinstallation) ou de les **effacer** (l'effacement est envoyé aux autres appareils).

### Fichiers livrés, plugin toujours actif, menu

- Tout fichier ajouté à l'archive (images, bibliothèques) est posé dans le dossier du plugin ; un plugin d'accès complet le lit avec `neo.pluginFileRead(ctx.id, 'chemin')` (base64).
- `"autoload": true` dans `plugin.json` : le plugin se charge au démarrage, sans attendre son ouverture (accès complet et signature exigés).
- `ctx.host.menuItem(nom, infobulle, fn)` ajoute une entrée au menu de NeoDex ; `ctx.host.closeTab(onglet)` ferme un onglet ; `ctx.host.statCount(clé)` compte un usage pour Stats ; `ctx.icon` est l'adresse de l'icône du plugin.

### L'emploi du temps de NeoDex

Un plugin d'accès complet peut y mettre ses événements : `ctx.host.agenda.sync('mon-plugin', [événements])` **remplace** à chaque
appel tous les événements de ce plugin (ils portent son nom dans `src`). Un événement :
`{ id, kind: 'event', title, date: 'AAAA-MM-JJ', start: 'HH:MM', end: 'HH:MM', allDay: false, color, place }`. Les identifiants doivent être
stables (`monplugin:<identifiant du match>`) : deux PC synchronisés obtiennent les mêmes événements. Appelle `sync(nom, [])` pour les
retirer quand l'utilisateur décoche le réglage. Les plugins « Sorties anime » et « NBA » s'en servent.

### Les captures d'un plugin

Mets une ou plusieurs captures dans le dépôt, dans `screenshots/1.jpg` (le thème Néon de NeoDex, 1280 × 800) : NeoStore les montre sur la
fiche du plugin quand le catalogue les référence. Elles ne font pas partie de l'archive.

### Le style d'un plugin

Un plugin apporte **son propre style** : `ctx.host.addStyle(css)` (accès complet) l'ajoute à la page et le retire quand le plugin
est déchargé. Pour rester dans l'esprit de NeoDex, sers-toi des variables du thème, qui suivent les couleurs choisies par
l'utilisateur : `--magenta`, `--win`, `--line`, `--line2`, `--lilac`, `--shell`, `--muted`, `--bg0`, `--text` (police), `--title`
(police des titres), `--pkr` (couleur d'accent en R, G, B, pour `rgba(var(--pkr), .3)`). Les classes communes du système
(`btn`, `px`, `tab`, `label`, `hint`, `appWrap`, `agHead`, `f` pour un champ…) restent disponibles sans rien écrire.
Le sélecteur de ta vue est `#plug_<id avec des _ au lieu des points>`.

Le guide complet, de zéro à la Release : [`docs/PUBLIER.md`](docs/PUBLIER.md).

## Publier une version

1. Monte `version` dans `plugin.json`.
2. Crée une archive `.zip` contenant `plugin.json`, `index.js` à la racine et les dossiers de fichiers livrés (voir le guide).
3. Publie une Release GitHub dont le tag est la version (`v1.0.0`) et joins-y le `.zip`.
4. Pour un plugin officiel, joins aussi l'`attestation.json` signée (voir « Approbation »).

Avant de publier, vérifie ces règles (l'outil d'approbation refuse un plugin officiel qui ne les suit pas) :

- `compatibility` est déclaré dans `plugin.json` (voir plus haut) ;
- `locales/en.json` traduit tous les textes affichés : `node tools/i18n.js missing <dossier du plugin>` ne doit rien lister ;
- il y a un `README.md` et un `README.en.md` ;
- `node tools/sheet-check.js <dossier du plugin>` passe.

`node tools/sheet-check.js <dossier du plugin>` vérifie que ta fiche dit vrai : chaque touche de la section « Commandes » du README est lue par le code, « N niveaux » correspond à la liste de niveaux du code, et `syncMode` / `syncInfo` correspondent à ce que le plugin garde vraiment.

## Approbation (plugins officiels)

Un plugin **approuvé** a été examiné par NeoDex et déclaré compatible avec une plage de versions.
L'approbation est une **attestation signée** jointe à la Release :

```json
{
  "pluginId": "neodex.hello",
  "repo": "TonPseudo/neobase-hello",
  "version": "1.0.0",
  "sha256": "<empreinte du .zip>",
  "approvedAt": "2026-10-31T00:00:00Z",
  "neobase": ">=4.0.0",
  "signature": "<signature ed25519, base64>"
}
```

NeoDex embarque la clé publique officielle et refuse un plugin dont la signature est invalide,
dont l'empreinte ne correspond pas au fichier téléchargé, ou dont l'approbation ne vise pas la
version publiée. Chaque nouvelle version demande une nouvelle approbation.

Un plugin **proposé** (topic `neodex-plugin` mais sans attestation) reste installable, mais
NeoStore le signale comme non vérifié.

Pour proposer un plugin à l'approbation officielle : voir le dépôt du catalogue NeoStore.
