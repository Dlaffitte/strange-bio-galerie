# Strange Bio — site vitrine

Site statique présentant les œuvres de la série *Strange Bio* avec un
filigrane anti-copie **gravé dans les images** (pas seulement en CSS), pour
pouvoir partager un simple lien de consultation sans risquer que les visuels
soient réutilisés en haute définition.

## Structure

```
site/
  build.py              # génère les images filigranées + le manifest à partir de "Diaporama Expo"
  index.html            # page unique (galerie + visionneuse)
  styles.css
  app.js
  images/
    thumbs/*.jpg         # vignettes filigranées (grille)
    full/*.jpg            # images filigranées, taille réduite (visionneuse)
    manifest.json         # liste générée : titre, chemins, ordre
```

## Régénérer les images (si le dossier source change)

```bash
cd site
pip3 install pillow   # une seule fois
python3 build.py
```

Le script :
- ignore les fichiers < 500 Ko (cartons de titre du diaporama, pas des
  œuvres) ;
- redimensionne chaque œuvre (1400 px pour la visionneuse, 520 px pour les
  vignettes) — **la définition originale n'est jamais servie** ;
- applique un filigrane répété en diagonale + une mention de copyright,
  fusionnés dans les pixels JPEG ;
- déduit un titre lisible à partir du nom de fichier.

⚠️ Les titres sont déduits automatiquement des noms de fichiers et peuvent
nécessiter une relecture manuelle dans `images/manifest.json` (champ
`"title"`) avant publication.

## Prévisualiser en local

```bash
cd site
python3 -m http.server 8765
```

Puis ouvrir http://localhost:8765/

## Mettre en ligne pour obtenir un lien à partager

Le dossier `site/` est 100% statique : n'importe quel hébergeur statique
gratuit convient. Deux options simples :

### Option A — GitHub Pages
1. Créer un dépôt GitHub, y pousser le contenu du dossier `site/`.
2. Dans les paramètres du dépôt → *Pages*, activer la publication depuis la
   branche principale (racine).
3. Le lien public est fourni automatiquement (`https://<user>.github.io/<repo>/`).

### Option B — Netlify Drop (le plus rapide, sans compte requis pour tester)
1. Aller sur https://app.netlify.com/drop
2. Glisser-déposer le dossier `site/` entier.
3. Un lien public est généré immédiatement, prêt à transmettre.

## Limites de la protection

Un filigrane visible + désactivation du clic droit/glisser dissuadent la
copie occasionnelle, mais **aucune protection côté client n'est infalsifiable**
(une capture d'écran reste toujours possible). Le vrai verrou ici est que les
fichiers diffusés sont réduits en résolution et marqués visuellement, donc
inutilisables pour une réimpression ou une réutilisation commerciale.
