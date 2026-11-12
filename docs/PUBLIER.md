# Publier un plugin NeoDex, pas à pas

Ce guide va de zéro à un plugin que n'importe qui peut installer depuis NeoStore.

## 1. Le dépôt

1. Crée un dépôt **public** sur GitHub, par exemple `neodex-plugin-monplugin`.
2. Ajoute-lui le *topic* **`neodex-plugin`** (page du dépôt → roue dentée à côté de « About »). C'est
   ce qui permet à NeoStore de le trouver.
3. Mets-y au minimum :
   - `plugin.json` : l'identité du plugin (voir le [README](../README.md)), avec `compatibility` : les systèmes où il marche (`windows`, `android`, `linux`) ;
   - `index.js` : le code ;
   - `icon.png` : l'icône (carrée, de préférence en pixel art, 64 × 64 ou plus) ;
   - `README.md` et `README.en.md` : ce que fait le plugin, en français et en anglais ;
   - `locales/en.json` : la traduction anglaise de chaque texte affiché (`node tools/i18n.js missing <dossier>` liste ce qui manque).

L'identifiant (`id`) est de la forme `auteur.nom`, en minuscules, chiffres et points (`mondev.monplugin`).
Pas de tiret. Il ne change jamais d'une version à l'autre.

## 2. Le code

`index.js` exporte une fonction par défaut qui reçoit `ctx` :

```js
export default async function (ctx) {
  ctx.view.textContent = 'Bonjour !';
  const notes = (await ctx.folder.read('notes')) || {};   // tes données : sauvegardées et synchronisées par NeoDex
  ctx.onOpen(() => { /* la vue vient d'être affichée */ });
}
```

Règles d'or :

- **Tes données vont dans `ctx.folder`**, jamais ailleurs. NeoDex les sauvegarde, les synchronise entre les
  PC et les efface à la désinstallation si l'utilisateur le demande.
- **N'utilise rien du cœur de NeoDex** qui ne soit pas dans `ctx` : il peut changer d'une version à l'autre.
- **Demande le minimum d'autorisations.** `storage` suffit à la plupart des plugins.

### Livrer des fichiers avec le plugin (images, polices, bibliothèques)

Tout ce que tu ajoutes à l'archive à côté de `plugin.json` et `index.js` est posé dans le dossier du plugin.
Un plugin d'accès complet les lit ainsi :

```js
const b64 = await neo.pluginFileRead(ctx.id, 'img/portrait.png');           // le contenu, en base64
const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' }));
```

### Un plugin qui agit sans être ouvert

Par défaut un plugin ne se charge qu'à sa première ouverture. S'il doit agir dès le démarrage (un compagnon
sur l'accueil, un écouteur d'événements…), ajoute `"autoload": true` dans `plugin.json` (accès complet et
signature exigés).

### S'ajouter au menu de NeoDex

Un plugin d'accès complet peut ajouter une entrée au menu : `ctx.host.menuItem('Nom', 'info-bulle', () => { … })`.

### Reprendre les données d'avant

Si ton plugin remplace une appli qui existait déjà, lis ses anciennes données **une seule fois** à la
première ouverture avec `ctx.legacy`, écris-les dans ton dossier, et ne les relis plus (voir le README).

## 3. Tester chez toi

Publie une première Release, puis installe ton plugin depuis NeoStore (onglet « Découvrir » : il apparaît
« non vérifié », c'est normal tant qu'il n'est pas approuvé). Pour changer de version, publie une nouvelle
Release et mets-le à jour depuis NeoStore.

## 4. Créer l'archive

Dans le dossier du plugin, avec PowerShell (Windows 10/11) :

```powershell
tar -a -cf monplugin-1.0.0.zip plugin.json index.js icon.png img
```

Liste exactement ce qui doit partir : `plugin.json` et `index.js` à la racine, plus les dossiers de fichiers
livrés. Nomme l'archive `<id>-<version>.zip` (par exemple `mondev.monplugin-1.0.0.zip`).

## 5. La Release

1. Monte `version` dans `plugin.json` (`1.0.0`, puis `1.0.1`, `1.1.0`… : trois nombres).
2. Sur GitHub : Releases → *Draft a new release*, tag `v1.0.0`, joins l'archive, publie.
3. NeoStore voit le plugin dans « À découvrir », en **non vérifié** : il demande confirmation, passe
   l'antivirus et n'a jamais l'accès complet.

## 6. Demander l'approbation officielle

Un plugin **approuvé** est examiné par NeoDex, reçoit une attestation signée, entre au catalogue et peut
demander l'accès complet. La procédure est décrite dans
[`APPROBATION.md`](https://github.com/NDesumeur/neodex-store-catalog/blob/main/APPROBATION.md) du catalogue.
En bref : ouvre une *issue* « Proposer un plugin » avec le lien de ton dépôt.

## Mettre à jour

Nouvelle version = nouveau tag et nouvelle archive. Pour un plugin approuvé, chaque version doit être
approuvée à nouveau : l'attestation est liée à l'empreinte exacte de l'archive.
