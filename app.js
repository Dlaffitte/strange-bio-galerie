(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var gallery = document.getElementById("gallery");
  var emptyState = document.getElementById("empty-state");
  var viewStats = document.getElementById("view-stats");

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxTitle = document.getElementById("lightbox-title");
  var lightboxCounter = document.getElementById("lightbox-counter");
  var lightboxTag = document.getElementById("lightbox-tag");
  var closeBtn = document.getElementById("lightbox-close");
  var prevBtn = document.getElementById("lightbox-prev");
  var nextBtn = document.getElementById("lightbox-next");

  var filterBtns = document.querySelectorAll(".filter-btn");
  var countAll = document.getElementById("count-all");
  var countArtwork = document.getElementById("count-artwork");
  var countText = document.getElementById("count-text");

  var allItems = [];
  var filteredItems = [];
  var currentFilter = "all";
  var currentFilteredIndex = -1;

  function renderGallery() {
    gallery.innerHTML = "";

    if (currentFilter === "all") {
      filteredItems = allItems;
    } else {
      filteredItems = allItems.filter(function (item) {
        return item.type === currentFilter;
      });
    }

    if (filteredItems.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
    }

    if (viewStats) {
      if (currentFilter === "all") {
        viewStats.textContent = "Affichage séquentiel (" + filteredItems.length + " pièces)";
      } else if (currentFilter === "artwork") {
        viewStats.textContent = "Affichage des œuvres (" + filteredItems.length + " pièces)";
      } else {
        viewStats.textContent = "Affichage des cartons et textes (" + filteredItems.length + " pièces)";
      }
    }

    var frag = document.createDocumentFragment();

    filteredItems.forEach(function (item, idx) {
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
      var originalIndex = allItems.indexOf(item) + 1;
      indexBadge.textContent = "#" + (originalIndex < 10 ? "0" + originalIndex : originalIndex);

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

  function openLightbox(filteredIdx) {
    if (!filteredItems.length) return;
    currentFilteredIndex = filteredIdx;
    var item = filteredItems[filteredIdx];

    lightboxImg.src = item.full;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;

    var globalIndex = allItems.indexOf(item) + 1;
    lightboxCounter.textContent = (filteredIdx + 1) + " / " + filteredItems.length + " (N°" + globalIndex + ")";
    
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
    if (!filteredItems.length) return;
    var next = (currentFilteredIndex + delta + filteredItems.length) % filteredItems.length;
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

  // Gestion des filtres
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filterBtns.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentFilter = btn.dataset.filter;
      renderGallery();
    });
  });

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
      allItems = data;
      var artCount = allItems.filter(function (i) { return i.type === "artwork"; }).length;
      var textCount = allItems.filter(function (i) { return i.type === "text"; }).length;

      if (countAll) countAll.textContent = allItems.length;
      if (countArtwork) countArtwork.textContent = artCount;
      if (countText) countText.textContent = textCount;

      renderGallery();
    })
    .catch(function (err) {
      console.error("Impossible de charger la galerie :", err);
      emptyState.hidden = false;
    });
})();

