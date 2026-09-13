#!/usr/bin/env python3
"""
Génère le site vitrine "Strange Bio" à partir du dossier source d'œuvres.

- Repère les images "œuvre" (fichiers > SIZE_THRESHOLD, les petits fichiers
  sont des cartons de titre non affichés).
- Redimensionne + applique un filigrane répété en diagonale, "gravé" dans les
  pixels (pas juste en CSS) pour dissuader la copie.
- Génère deux tailles : vignette (grille) et image "grande" (visionneuse),
  toutes deux filigranées et volontairement en résolution/qualité réduites
  (jamais la définition originale n'est servie).
- Écrit images/manifest.json consommé par index.html.

Usage: python3 build.py
"""
import json
import os
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

SOURCE_DIR = Path(__file__).resolve().parent.parent / "Diaporama Expo"
SITE_DIR = Path(__file__).resolve().parent
THUMBS_DIR = SITE_DIR / "images" / "thumbs"
FULL_DIR = SITE_DIR / "images" / "full"
MANIFEST_PATH = SITE_DIR / "images" / "manifest.json"

SIZE_THRESHOLD = 500_000  # octets : sépare cartons de titre (petits) des œuvres (gros)
WATERMARK_TEXT = "STRANGE BIO \u2022 APERÇU \u2022 NE PAS COPIER"
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


def make_watermark_layer(size, text=WATERMARK_TEXT):
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
    y = 0
    row = 0
    while y < diag:
        x = -diag if row % 2 == 0 else -diag // 2
        while x < diag:
            draw.text((x, y), text, font=font, fill=(255, 255, 255, 90))
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


def process_image(src_path: Path, out_path: Path, max_dim: int):
    img = Image.open(src_path)
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    w, h = img.size
    scale = min(1.0, max_dim / max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    rgba = img.convert("RGBA")
    watermark = make_watermark_layer(rgba.size)
    combined = Image.alpha_composite(rgba, watermark).convert("RGB")

    # ajoute une mention de copyright discrète en bas d'image, plus lisible
    draw = ImageDraw.Draw(combined)
    font = load_font(max(14, combined.size[0] // 45))
    label = "\u00a9 Strange Bio — aperçu non contractuel"
    tw = draw.textlength(label, font=font)
    pad = 10
    x = combined.size[0] - tw - pad * 2
    y = combined.size[1] - font.size - pad * 2
    draw.rectangle([x, y, combined.size[0], combined.size[1]], fill=(0, 0, 0, 160))
    draw.text((x + pad, y + pad // 2), label, font=font, fill=(255, 255, 255, 230))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True)


def main():
    if not SOURCE_DIR.exists():
        raise SystemExit(f"Dossier source introuvable : {SOURCE_DIR}")

    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    FULL_DIR.mkdir(parents=True, exist_ok=True)

    entries = []
    seen_slugs = {}
    files = sorted(SOURCE_DIR.glob("*.jpg")) + sorted(SOURCE_DIR.glob("*.jpeg"))
    for f in files:
        if f.stat().st_size < SIZE_THRESHOLD:
            continue  # carton de titre, pas une œuvre
        stem = f.stem
        m = re.match(r"^(\d+)", stem)
        order_num = int(m.group(1)) if m else 999
        title = clean_title(stem)
        slug_base = slugify(title)
        n = seen_slugs.get(slug_base, 0)
        seen_slugs[slug_base] = n + 1
        slug = slug_base if n == 0 else f"{slug_base}-{n+1}"
        if n > 0:
            title = f"{title} (variante {n+1})"

        thumb_out = THUMBS_DIR / f"{slug}.jpg"
        full_out = FULL_DIR / f"{slug}.jpg"
        print(f"→ {f.name}  =>  {slug}")
        process_image(f, thumb_out, THUMB_MAX_DIM)
        process_image(f, full_out, FULL_MAX_DIM)

        entries.append({
            "id": slug,
            "title": title,
            "order": order_num,
            "thumb": f"images/thumbs/{slug}.jpg",
            "full": f"images/full/{slug}.jpg",
        })

    entries.sort(key=lambda e: (e["order"], e["title"]))
    MANIFEST_PATH.write_text(json.dumps(entries, ensure_ascii=False, indent=2))
    print(f"\n{len(entries)} œuvres exportées. Manifest : {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
