(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var gallery = document.getElementById("gallery");
  var emptyState = document.getElementById("empty-state");

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxTitle = document.getElementById("lightbox-title");
  var lightboxCounter = document.getElementById("lightbox-counter");
  var closeBtn = document.getElementById("lightbox-close");
  var prevBtn = document.getElementById("lightbox-prev");
  var nextBtn = document.getElementById("lightbox-next");

  var groups = [];
  var flatItems = []; // pour la navigation prev/next de la visionneuse
  var currentIndex = -1;

  function renderStory() {
    gallery.innerHTML = "";
    flatItems = [];
    if (scrollGlowObserver) scrollGlowObserver.disconnect();
    visibleArtworks.clear();

    if (!groups.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    var frag = document.createDocumentFragment();

    groups.forEach(function (group, groupIdx) {
      var section = document.createElement("section");
      section.className = "work";

      var indexLabel = document.createElement("div");
      indexLabel.className = "work-index";
      var num = groupIdx + 1;
      indexLabel.textContent = "Pièce " + (num < 10 ? "0" + num : num);
      section.appendChild(indexLabel);

      // Toutes les illustrations du groupe d'abord, puis toutes les
      // légendes (texte OCR ou carton image de secours) en dessous.
      var artworkItems = group.items.filter(function (i) { return i.type === "artwork"; });
      var textItems = group.items.filter(function (i) { return i.type === "text"; });

      artworkItems.concat(textItems).forEach(function (item) {
        if (item.type === "text" && item.caption) {
          section.appendChild(buildCaptionBlock(item));
          return;
        }

        var flatIdx = flatItems.length;
        flatItems.push(item);

        var isArtwork = item.type === "artwork";
        var card = document.createElement("div");
        card.className = isArtwork ? "artwork-card" : "text-card";
        card.setAttribute("tabindex", "0");
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", item.title + " (ouvrir l'aperçu)");

        var img = document.createElement("img");
        img.src = item.thumb;
        img.alt = item.title;
        img.loading = "lazy";
        img.draggable = false;

        card.appendChild(img);
        card.addEventListener("click", function () { openLightbox(flatIdx); });
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLightbox(flatIdx);
          }
        });

        if (isArtwork) {
          observeScrollGlow(img);
        }

        var wrap = document.createElement("div");
        wrap.className = isArtwork ? "work-artworks" : "work-texts";
        wrap.appendChild(card);
        section.appendChild(wrap);

        if (isArtwork) {
          var caption = document.createElement("div");
          caption.className = "work-caption";
          caption.textContent = item.title;
          section.appendChild(caption);
        }
      });

      frag.appendChild(section);
    });

    gallery.appendChild(frag);
  }

  function buildCaptionBlock(item) {
    var block = document.createElement("div");
    block.className = "caption-block";

    var lines = item.caption.slice();
    var kicker = document.createElement("p");
    kicker.className = "caption-kicker";
    kicker.textContent = lines.shift();
    block.appendChild(kicker);

    if (lines.length) {
      var body = document.createElement("div");
      body.className = "caption-body";
      lines.forEach(function (line) {
        var p = document.createElement("p");
        p.textContent = line;
        body.appendChild(p);
      });
      block.appendChild(body);
    }

    return block;
  }

  function openLightbox(idx) {
    if (!flatItems.length) return;
    currentIndex = idx;
    var item = flatItems[idx];

    lightboxImg.src = item.full;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;

    lightboxCounter.textContent = (idx + 1) + " / " + flatItems.length;

    lightbox.hidden = false;
    document.body.style.overflow = "hidden";

    applyDominantBackground(lightboxImg);
  }

  // Estime la couleur dominante de l'image affichée (moyenne de pixels sur
  // une vignette réduite) pour teinter l'arrière-plan de la visionneuse.
  var glowCanvas = document.createElement("canvas");
  var glowCtx = glowCanvas.getContext && glowCanvas.getContext("2d");

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    var d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case r: h = ((g - b) / d) % 6; break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var rp, gp, bp;
    if (h < 60) { rp = c; gp = x; bp = 0; }
    else if (h < 120) { rp = x; gp = c; bp = 0; }
    else if (h < 180) { rp = 0; gp = c; bp = x; }
    else if (h < 240) { rp = 0; gp = x; bp = c; }
    else if (h < 300) { rp = x; gp = 0; bp = c; }
    else { rp = c; gp = 0; bp = x; }
    return [
      Math.round((rp + m) * 255),
      Math.round((gp + m) * 255),
      Math.round((bp + m) * 255)
    ];
  }

  function applyDominantBackground(imgEl) {
    computeDominantColor(imgEl, function (rgb) {
      lightbox.style.setProperty("--glow-color", rgb[0] + "," + rgb[1] + "," + rgb[2]);
    });
  }

  var colorCache = {}; // src -> [r,g,b], évite de recalculer la même image en boucle

  function computeDominantColor(imgEl, onReady) {
    if (!glowCtx) return;
    var cacheKey = imgEl.currentSrc || imgEl.src;
    if (colorCache[cacheKey]) {
      onReady(colorCache[cacheKey]);
      return;
    }

    function extract() {
      var w = 40, h = 40;
      glowCanvas.width = w;
      glowCanvas.height = h;
      try {
        // Recadre sur le centre de l'image (les scans d'origine ont souvent
        // une marge blanche qui fausserait la moyenne vers le blanc).
        var iw = imgEl.naturalWidth, ih = imgEl.naturalHeight;
        var cropW = iw * 0.7, cropH = ih * 0.7;
        var sx = (iw - cropW) / 2, sy = (ih - cropH) / 2;
        glowCtx.drawImage(imgEl, sx, sy, cropW, cropH, 0, 0, w, h);
        var data = glowCtx.getImageData(0, 0, w, h).data;
        var r = 0, g = 0, b = 0, count = 0;
        for (var i = 0; i < data.length; i += 4) {
          var pr = data[i], pg = data[i + 1], pb = data[i + 2];
          // Ignore les pixels quasi blancs/noirs pour privilégier les
          // couleurs vraiment caractéristiques de l'image.
          var isNearWhite = pr > 235 && pg > 235 && pb > 235;
          var isNearBlack = pr < 20 && pg < 20 && pb < 20;
          if (isNearWhite || isNearBlack) continue;
          r += pr;
          g += pg;
          b += pb;
          count++;
        }
        if (count < 10) {
          // Image trop uniforme (peu de pixels colorés) : refait le calcul sans filtre.
          count = 0; r = 0; g = 0; b = 0;
          for (var j = 0; j < data.length; j += 4) {
            r += data[j];
            g += data[j + 1];
            b += data[j + 2];
            count++;
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Renforce la saturation pour un halo plus visible et fidèle.
        var hsl = rgbToHsl(r, g, b);
        hsl[1] = Math.min(1, hsl[1] * 2.1 + 0.15);
        hsl[2] = Math.min(0.58, Math.max(0.32, hsl[2]));
        var boosted = hslToRgb(hsl[0], hsl[1], hsl[2]);

        colorCache[cacheKey] = boosted;
        onReady(boosted);
      } catch (err) {
        // Image non lisible par le canvas (rare, cas cross-origin) : on garde le fond neutre.
      }
    }

    if (imgEl.complete && imgEl.naturalWidth) {
      extract();
    } else {
      imgEl.addEventListener("load", extract, { once: true });
    }
  }

  // --- Halo d'arrière-plan qui suit le défilement de la page ---
  // Repère, parmi les œuvres visibles à l'écran, celle la plus proche du
  // centre du viewport, et teinte le fond du site avec sa couleur dominante.
  var scrollGlowEl = document.querySelector(".scroll-glow");
  var visibleArtworks = new Map(); // img -> ratio d'intersection
  var scrollGlowObserver = null;

  if (scrollGlowEl && "IntersectionObserver" in window) {
    scrollGlowObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            visibleArtworks.set(entry.target, entry.intersectionRatio);
          } else {
            visibleArtworks.delete(entry.target);
          }
        });
        updateScrollGlow();
      },
      { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1] }
    );
  }

  function observeScrollGlow(imgEl) {
    if (scrollGlowObserver) scrollGlowObserver.observe(imgEl);
  }

  function updateScrollGlow() {
    if (!scrollGlowEl || !visibleArtworks.size) return;
    var bestImg = null, bestRatio = -1;
    visibleArtworks.forEach(function (ratio, img) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestImg = img;
      }
    });
    if (!bestImg) return;
    computeDominantColor(bestImg, function (rgb) {
      scrollGlowEl.style.setProperty("--scroll-glow-color", rgb[0] + "," + rgb[1] + "," + rgb[2]);
    });
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  function showRelative(delta) {
    if (!flatItems.length) return;
    var next = (currentIndex + delta + flatItems.length) % flatItems.length;
    openLightbox(next);
  }

  // Contrôles Lightbox
  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", function (e) { e.stopPropagation(); showRelative(-1); });
  nextBtn.addEventListener("click", function (e) { e.stopPropagation(); showRelative(1); });

  lightbox.addEventListener("click", function (e) {
    if (e.target.classList.contains("lightbox-backdrop") || e.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showRelative(-1);
    if (e.key === "ArrowRight") showRelative(1);
  });

  // Support du balayage tactile (swipe) sur mobile
  var touchStartX = 0;
  var touchEndX = 0;
  lightbox.addEventListener("touchstart", function (e) {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox.addEventListener("touchend", function (e) {
    touchEndX = e.changedTouches[0].screenX;
    var diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 45) {
      if (diff < 0) {
        showRelative(1); // Swipe gauche -> suivant
      } else {
        showRelative(-1); // Swipe droite -> précédent
      }
    }
  }, { passive: true });

  // Protection anti-copie basique
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  document.addEventListener("keydown", function (e) {
    var key = e.key ? e.key.toLowerCase() : "";
    if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "u")) {
      e.preventDefault();
    }
  });

  // Chargement des données (groupes texte + illustration)
  fetch("images/manifest.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      groups = data;
      renderStory();
    })
    .catch(function (err) {
      console.error("Impossible de charger la galerie :", err);
      emptyState.hidden = false;
    });
})();

