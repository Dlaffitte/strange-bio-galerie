#!/usr/bin/env python3
"""
Génère le site vitrine "Bonbobio" à partir du dossier source d'œuvres.

- Toutes les images du diaporama sont incluses : les œuvres (fichiers
  > SIZE_THRESHOLD) ET les cartons de texte/intention (fichiers plus légers,
  fond blanc + texte) qui accompagnent chaque œuvre dans la présentation
  d'origine.
- Les œuvres reçoivent un filigrane répété en diagonale, "gravé" dans les
  pixels (pas juste en CSS) pour dissuader la copie. Les cartons de texte
  ne sont pas filigranés (ce ne sont pas des visuels à protéger) mais
  restent réduits en résolution comme le reste.
- Génère deux tailles : vignette (grille) et image "grande" (visionneuse).
- Écrit images/manifest.json consommé par index.html.

Usage: python3 build.py
"""
import json
import os
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    import pytesseract  # OCR optionnel : utilisé pour titrer les cartons de texte
    # Désactivé par défaut : la reconnaissance de texte sur ces cartons
    # (police stylisée) produit des titres peu fiables ("B10" pour "Bio",
    # mots tronqués...). On garde un identifiant simple et lisible à la
    # place ; réactiver ci-dessous si l'OCR est amélioré/relu manuellement.
    pytesseract = None
except ImportError:
    pytesseract = None

SOURCE_DIR = Path(__file__).resolve().parent.parent / "Diaporama Expo"
SITE_DIR = Path(__file__).resolve().parent
THUMBS_DIR = SITE_DIR / "images" / "thumbs"
FULL_DIR = SITE_DIR / "images" / "full"
MANIFEST_PATH = SITE_DIR / "images" / "manifest.json"

SIZE_THRESHOLD = 500_000  # octets : sépare cartons de texte (petits) des œuvres (gros)
WATERMARK_TEXT = "BONBOBIO"
FULL_MAX_DIM = 1400
THUMB_MAX_DIM = 520
JPEG_QUALITY = 78

NOISE_SUBSTRINGS = [
    r"la\s*saillante", r"copie", r"copy", r"cmjn", r"\btif\b", r"\ba4\b",
]


def clean_title(stem: str) -> str:
    """Dérive un titre lisible depuis le nom de fichier."""
    # retire un préfixe numérique du type "12.2" ou "00"
    text = re.sub(r"^\d+(\.\d+)?", "", stem).strip()
    # supprime les mentions techniques/bruit, même collées (ex: "CopieLaSaillante")
    for pat in NOISE_SUBSTRINGS:
        text = re.sub(pat, " ", text, flags=re.IGNORECASE)
    # sépare les mots collés en camelCase ou lettre+chiffre
    text = re.sub(r"(?<=[a-zà-ÿ])(?=[A-ZÀ-Ý])", " ", text)
    text = re.sub(r"(?<=[a-zA-Zà-ÿÀ-Ý])(?=\d)", " ", text)
    text = re.sub(r"(?<=\d)(?=[a-zA-Zà-ÿÀ-Ý])", " ", text)
    text = re.sub(r"[_\-]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" '’")
    if not text:
        text = stem.strip() or "Sans titre"
    # jolie casse : capitalise chaque mot sans casser les apostrophes internes
    words = []
    for w in text.split(" "):
        if not w:
            continue
        words.append(w[0].upper() + w[1:] if len(w) > 1 else w.upper())
    return " ".join(words)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "oeuvre"


def get_dominant_color(img: Image.Image) -> tuple:
    """Estime la couleur dominante d'une image (échantillon réduit + quantification)."""
    small = img.convert("RGB").copy()
    small.thumbnail((150, 150))
    try:
        result = small.quantize(colors=6, method=Image.MEDIANCUT)
        palette = result.getpalette()
        counts = sorted(result.getcolors(), reverse=True)
        _, idx = counts[0]
        r, g, b = palette[idx * 3: idx * 3 + 3]
        return (r, g, b)
    except Exception:
        return (255, 255, 255)


def watermark_color_from_dominant(rgb: tuple) -> tuple:
    """Dérive une couleur de filigrane lisible à partir de la couleur dominante :
    on éclaircit les teintes sombres et on assombrit les teintes claires, pour
    garder un filigrane visible mais toujours accordé à l'image."""
    r, g, b = rgb
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

    def clamp(v):
        return max(0, min(255, int(round(v))))

    if luminance > 0.55:
        # couleur claire -> on l'assombrit pour qu'elle reste visible
        r2, g2, b2 = r * 0.4, g * 0.4, b * 0.4
    else:
        # couleur sombre -> on l'éclaircit
        r2 = r + (255 - r) * 0.6
        g2 = g + (255 - g) * 0.6
        b2 = b + (255 - b) * 0.6
    return (clamp(r2), clamp(g2), clamp(b2))


def load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def make_watermark_layer(size, text=WATERMARK_TEXT, color=(255, 255, 255)):
    """Crée un calque RGBA de filigrane répété en diagonale."""
    w, h = size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    diag = int((w ** 2 + h ** 2) ** 0.5)
    tile = Image.new("RGBA", (diag, diag), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    font_size = max(16, w // 22)
    font = load_font(font_size)
    step_y = font_size * 4
    step_x_text = font_size * len(text) // 2 + font_size * 6
    fill = (color[0], color[1], color[2], 110)
    y = 0
    row = 0
    while y < diag:
        x = -diag if row % 2 == 0 else -diag // 2
        while x < diag:
            draw.text((x, y), text, font=font, fill=fill)
            x += step_x_text
        y += step_y
        row += 1
    tile = tile.rotate(35, expand=False)
    # recadre au centre à la taille finale
    tw, th = tile.size
    left = (tw - w) // 2
    top = (th - h) // 2
    tile = tile.crop((left, top, left + w, top + h))
    return tile


def process_image(src_path: Path, out_path: Path, max_dim: int, watermark: bool):
    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    w, h = img.size
    scale = min(1.0, max_dim / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)

    if watermark:
        dominant = get_dominant_color(img)
        wm_color = watermark_color_from_dominant(dominant)

        rgba = img.convert("RGBA")
        wm = make_watermark_layer(rgba.size, color=wm_color)
        combined = Image.alpha_composite(rgba, wm).convert("RGB")

        # ajoute une mention de copyright discrète en bas d'image, plus lisible
        draw = ImageDraw.Draw(combined)
        font = load_font(max(14, combined.size[0] // 45))
        label = "\u00a9 Bonbobio — aperçu non contractuel"
        tw = draw.textlength(label, font=font)
        pad = 10
        x = combined.size[0] - tw - pad * 2
        y = combined.size[1] - font.size - pad * 2
        draw.rectangle([x, y, combined.size[0], combined.size[1]], fill=(0, 0, 0, 160))
        draw.text((x + pad, y + pad // 2), label, font=font, fill=(255, 255, 255, 230))
    else:
        combined = img

    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def ocr_title(src_path: Path, fallback: str) -> str:
    """Essaie d'extraire le texte d'un carton de présentation via OCR.
    Retombe sur `fallback` si l'OCR n'est pas disponible ou échoue."""
    if pytesseract is None:
        return fallback
    try:
        img = Image.open(src_path)
        img = ImageOps.exif_transpose(img).convert("L")
        text = pytesseract.image_to_string(img, lang="fra")
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if not lines:
            return fallback
        title = lines[0]
        title = re.sub(r"\s+", " ", title).strip(" .")
        return title[:80] if title else fallback
    except Exception:
        return fallback


def main():
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Dossier source introuvable : {SOURCE_DIR}")

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    FULL_DIR.mkdir(parents=True, exist_ok=True)

    entries = []
    seen_slugs = {}
    files = sorted(SOURCE_DIR.glob("*.jpg")) + sorted(SOURCE_DIR.glob("*.jpeg"))

    def order_key(path: Path):
        """Ordre naturel du diaporama : groupe numérique (1, 2, 3…, pas
        alphabétique) puis sous-rang (le carton de texte "N.1" avant les
        œuvres "N.2"/"N.3", les fichiers "N.jpg" sans suffixe en dernier)."""
        m = re.match(r"^(\d+)(?:\.(\d+))?", path.stem)
        group_num = int(m.group(1)) if m else 999
        subnum = int(m.group(2)) if (m and m.group(2)) else 100
        return (group_num, subnum, path.name)

    files.sort(key=order_key)

    for position, f in enumerate(files):
        stem = f.stem
        m = re.match(r"^(\d+)", stem)
        group_num = int(m.group(1)) if m else 999
        is_text_card = f.stat().st_size < SIZE_THRESHOLD

        if is_text_card:
            title = ocr_title(f, fallback=f"Note d'intention {group_num}")
        else:
            title = clean_title(stem)

        slug_base = slugify(title)
        n = seen_slugs.get(slug_base, 0)
        seen_slugs[slug_base] = n + 1
        slug = slug_base if n == 0 else f"{slug_base}-{n+1}"
        if n > 0:
            title = f"{title} (suite)" if is_text_card else f"{title} (variante {n+1})"

        thumb_out = THUMBS_DIR / f"{slug}.jpg"
        full_out = FULL_DIR / f"{slug}.jpg"
        kind = "texte" if is_text_card else "œuvre"
        print(f"→ [{kind}] {f.name}  =>  {slug}")
        process_image(f, thumb_out, THUMB_MAX_DIM, watermark=not is_text_card)
        process_image(f, full_out, FULL_MAX_DIM, watermark=not is_text_card)

        entries.append({
            "id": slug,
            "title": title,
            "order": position,
            "group": group_num,
            "type": "text" if is_text_card else "artwork",
            "thumb": f"images/thumbs/{slug}.jpg",
            "full": f"images/full/{slug}.jpg",
        })

    entries.sort(key=lambda e: e["order"])

    # Regroupe les entrées par groupe (texte + œuvre(s) d'une même pièce)
    # afin que le site puisse afficher le carton de texte au-dessus/en dessous
    # de l'illustration correspondante, plutôt qu'en grille façon planche de livre.
    groups = []
    groups_by_num = {}
    for e in entries:
        g = groups_by_num.get(e["group"])
        if g is None:
            g = {"group": e["group"], "items": []}
            groups_by_num[e["group"]] = g
            groups.append(g)
        g["items"].append(e)

    MANIFEST_PATH.write_text(json.dumps(groups, ensure_ascii=False, indent=2))
    print(f"\n{len(entries)} éléments exportés ({sum(1 for e in entries if e['type']=='artwork')} œuvres, "
          f"{sum(1 for e in entries if e['type']=='text')} cartons de texte) en {len(groups)} groupes. "
          f"Manifest : {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
