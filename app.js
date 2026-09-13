(function () {
  "use strict";

  document.getElementById("year").textContent = new Date().getFullYear();

  var gallery = document.getElementById("gallery");
  var emptyState = document.getElementById("empty-state");
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxCaption = document.getElementById("lightbox-caption");
  var closeBtn = document.querySelector(".lightbox-close");
  var prevBtn = document.querySelector(".lightbox-prev");
  var nextBtn = document.querySelector(".lightbox-next");

  var items = [];
  var currentIndex = -1;

  function openLightbox(index) {
    currentIndex = index;
    var item = items[index];
    lightboxImg.src = item.full;
    lightboxImg.alt = item.title;
    lightboxCaption.textContent = item.title;
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }

  function showRelative(delta) {
    if (!items.length) return;
    var next = (currentIndex + delta + items.length) % items.length;
    openLightbox(next);
  }

  closeBtn.addEventListener("click", closeLightbox);
  prevBtn.addEventListener("click", function () { showRelative(-1); });
  nextBtn.addEventListener("click", function () { showRelative(1); });
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (lightbox.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showRelative(-1);
    if (e.key === "ArrowRight") showRelative(1);
  });

  // Dissuasion basique : bloque le menu contextuel, le glisser-déposer
  // et le raccourci d'enregistrement. Ce n'est pas une protection absolue
  // (aucune ne l'est côté client), mais dissuade la copie occasionnelle ;
  // la vraie protection vient du filigrane gravé dans les images.
  document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  document.addEventListener("keydown", function (e) {
    var key = e.key ? e.key.toLowerCase() : "";
    if ((e.ctrlKey || e.metaKey) && (key === "s" || key === "u")) {
      e.preventDefault();
    }
  });

  fetch("images/manifest.json")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      items = data;
      if (!items.length) {
        emptyState.hidden = false;
        return;
      }
      var frag = document.createDocumentFragment();
      items.forEach(function (item, index) {
        var card = document.createElement("div");
        card.className = "card" + (item.type === "text" ? " card-text" : "");

        var img = document.createElement("img");
        img.src = item.thumb;
        img.alt = item.title;
        img.loading = "lazy";
        img.draggable = false;

        var title = document.createElement("div");
        title.className = "card-title";
        title.textContent = item.title;

        card.appendChild(img);
        card.appendChild(title);
        card.addEventListener("click", function () { openLightbox(index); });

        frag.appendChild(card);
      });
      gallery.appendChild(frag);
    })
    .catch(function (err) {
      console.error("Impossible de charger la galerie :", err);
      emptyState.hidden = false;
    });
})();
