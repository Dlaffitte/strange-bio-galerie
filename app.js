(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var gallery = document.getElementById("gallery");
  var emptyState = document.getElementById("empty-state");

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxTitle = document.getElementById("lightbox-title");
  var lightboxCounter = document.getElementById("lightbox-counter");
  var lightboxTag = document.getElementById("lightbox-tag");
  var closeBtn = document.getElementById("lightbox-close");
  var prevBtn = document.getElementById("lightbox-prev");
  var nextBtn = document.getElementById("lightbox-next");

  var items = [];
  var currentIndex = -1;

  function renderGallery() {
    gallery.innerHTML = "";

    if (!items.length) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    var frag = document.createDocumentFragment();

    items.forEach(function (item, idx) {
      var card = document.createElement("article");
      card.className = "card" + (item.type === "text" ? " card-text" : "");
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", item.title + " (ouvrir l'aperçu)");

      var media = document.createElement("div");
      media.className = "card-media";

      var img = document.createElement("img");
      img.src = item.thumb;
      img.alt = item.title;
      img.loading = "lazy";
      img.draggable = false;

      var badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = item.type === "text" ? "Texte" : "Œuvre";

      var indexBadge = document.createElement("span");
      indexBadge.className = "card-index";
      var displayNum = idx + 1;
      indexBadge.textContent = "#" + (displayNum < 10 ? "0" + displayNum : displayNum);

      media.appendChild(img);
      media.appendChild(badge);
      media.appendChild(indexBadge);

      var info = document.createElement("div");
      info.className = "card-info";

      var subtitle = document.createElement("div");
      subtitle.className = "card-subtitle";
      subtitle.textContent = item.type === "text" ? "Carton d'exposition" : "Illustration originale";

      var title = document.createElement("h2");
      title.className = "card-title";
      title.textContent = item.title;

      info.appendChild(subtitle);
      info.appendChild(title);

      card.appendChild(media);
      card.appendChild(info);

      card.addEventListener("click", function () {
        openLightbox(idx);
      });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(idx);
        }
      });

      frag.appendChild(card);
    });

    gallery.appendChild(frag);
  }

  function openLightbox(idx) {
    if (!items.length) return;
    currentIndex = idx;
    var item = items[idx];

    lightboxImg.src = item.full;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;

    lightboxCounter.textContent = (idx + 1) + " / " + items.length;
    
    if (item.type === "text") {
      lightboxTag.textContent = "📜 Carton / Texte";
      lightboxTag.style.color = "#38bdf8";
      lightboxTag.style.borderColor = "rgba(14, 165, 233, 0.4)";
      lightboxTag.style.background = "rgba(14, 165, 233, 0.12)";
    } else {
      lightboxTag.textContent = "🎨 Œuvre originale";
      lightboxTag.style.color = "#c084fc";
      lightboxTag.style.borderColor = "rgba(139, 92, 246, 0.4)";
      lightboxTag.style.background = "rgba(139, 92, 246, 0.12)";
    }

    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  function showRelative(delta) {
    if (!items.length) return;
    var next = (currentIndex + delta + items.length) % items.length;
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

  // Chargement des données
  fetch("images/manifest.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      items = data;
      renderGallery();
    })
    .catch(function (err) {
      console.error("Impossible de charger la galerie :", err);
      emptyState.hidden = false;
    });
})();

