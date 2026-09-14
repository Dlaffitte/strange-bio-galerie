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

