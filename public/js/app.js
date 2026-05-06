/* global Api, Favorites, MuseumMap, bootstrap */

(function () {
  const state = {
    view: 'search',
    query: '',
    source: 'both',
    hasImage: true,
    page: 1,
    totalPages: 1,
    totalRecords: 0,
    results: [],
    loading: false,
    searchSeq: 0,
    detail: null,
    detailLoads: {
      bio: false,
      related: false,
      map: false,
    },
  };

  const els = {
    navSearch: document.getElementById('nav-search'),
    navFavorites: document.getElementById('nav-favorites'),
    navBrand: document.getElementById('nav-brand'),
    favBadge: document.getElementById('favorites-badge'),
    viewSearch: document.getElementById('view-search'),
    viewDetail: document.getElementById('view-detail'),
    viewFavorites: document.getElementById('view-favorites'),
    searchInput: document.getElementById('search-input'),
    sourceSelect: document.getElementById('source-select'),
    hasImage: document.getElementById('has-image'),
    searchBtn: document.getElementById('search-btn'),
    searchValidation: document.getElementById('search-validation'),
    resultsAlert: document.getElementById('results-alert'),
    resultsCount: document.getElementById('results-count'),
    resultsGrid: document.getElementById('results-grid'),
    resultsEmpty: document.getElementById('results-empty'),
    paginationWrap: document.getElementById('pagination-wrap'),
    pagePrev: document.getElementById('page-prev'),
    pageNext: document.getElementById('page-next'),
    pageInfo: document.getElementById('page-info'),
    backBtn: document.getElementById('back-btn'),
    detailImageWrap: document.getElementById('detail-image-wrap'),
    detailImage: document.getElementById('detail-image'),
    detailNoImageTitle: document.getElementById('detail-no-image-title'),
    favToggleBtn: document.getElementById('fav-toggle-btn'),
    detailTitle: document.getElementById('detail-title'),
    detailArtist: document.getElementById('detail-artist'),
    overviewFields: document.getElementById('overview-fields'),
    museumSiteLink: document.getElementById('museum-site-link'),
    bioLoading: document.getElementById('bio-loading'),
    bioContent: document.getElementById('bio-content'),
    bioEmpty: document.getElementById('bio-empty'),
    bioThumb: document.getElementById('bio-thumb'),
    bioName: document.getElementById('bio-name'),
    bioWikiLink: document.getElementById('bio-wiki-link'),
    bioExtract: document.getElementById('bio-extract'),
    relatedLoading: document.getElementById('related-loading'),
    relatedGrid: document.getElementById('related-grid'),
    relatedEmpty: document.getElementById('related-empty'),
    mapMuseumName: document.getElementById('map-museum-name'),
    mapMuseumSub: document.getElementById('map-museum-sub'),
    mapContainer: document.getElementById('map-container'),
    mapFallback: document.getElementById('map-fallback'),
    tabOverviewBtn: document.getElementById('tab-overview-btn'),
    tabBioBtn: document.getElementById('tab-bio-btn'),
    tabRelatedBtn: document.getElementById('tab-related-btn'),
    tabMapBtn: document.getElementById('tab-map-btn'),
    favoritesGrid: document.getElementById('favorites-grid'),
    favoritesEmpty: document.getElementById('favorites-empty'),
    navToggle: document.getElementById('nav-toggle'),
    navLinks: document.getElementById('nav-links'),
  };

  let relatedHoverEl = null;

  function ensureRelatedHoverEl() {
    if (!relatedHoverEl) {
      relatedHoverEl = document.createElement('div');
      relatedHoverEl.className = 'ae-related-cursor-tip';
      document.body.appendChild(relatedHoverEl);
    }
    return relatedHoverEl;
  }

  function onRelatedMouseMove(e) {
    const tip = ensureRelatedHoverEl();
    const title = e.currentTarget && e.currentTarget.dataset.title;
    if (!title) {
      tip.style.display = 'none';
      return;
    }
    tip.textContent = title;
    tip.style.display = 'block';
    const offsetX = 14;
    const offsetY = 18;
    tip.style.left = `${e.clientX + offsetX}px`;
    tip.style.top = `${e.clientY + offsetY}px`;
  }

  function onRelatedMouseLeave() {
    hideRelatedHover();
  }

  function hideRelatedHover() {
    if (relatedHoverEl) relatedHoverEl.style.display = 'none';
  }

  function debounce(fn, ms) {
    let t = null;
    return function debounced(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function showView(name) {
    state.view = name;
    els.viewSearch.classList.toggle('d-none', name !== 'search');
    els.viewDetail.classList.toggle('d-none', name !== 'detail');
    els.viewFavorites.classList.toggle('d-none', name !== 'favorites');
    els.navSearch.classList.toggle('active', name === 'search');
    els.navFavorites.classList.toggle('active', name === 'favorites');
    closeNavMenu();
    hideRelatedHover();
  }

  function closeNavMenu() {
    if (els.navLinks) els.navLinks.classList.remove('is-open');
    if (els.navToggle) els.navToggle.setAttribute('aria-expanded', 'false');
  }

  function toggleNavMenu() {
    if (!els.navLinks || !els.navToggle) return;
    const next = !els.navLinks.classList.contains('is-open');
    els.navLinks.classList.toggle('is-open', next);
    els.navToggle.setAttribute('aria-expanded', String(next));
  }

  function updateFavBadge() {
    const n = Favorites.count();
    if (n > 0) {
      els.favBadge.textContent = String(n);
      els.favBadge.classList.remove('d-none');
    } else {
      els.favBadge.classList.add('d-none');
    }
  }

  function hideSearchValidation() {
    els.searchValidation.classList.add('d-none');
  }

  function showSearchValidation() {
    els.searchValidation.classList.remove('d-none');
  }

  function setResultsAlert(msg) {
    if (!msg) {
      els.resultsAlert.classList.add('d-none');
      els.resultsAlert.textContent = '';
      return;
    }
    els.resultsAlert.textContent = msg;
    els.resultsAlert.classList.remove('d-none');
  }

  function renderSkeletons() {
    els.resultsGrid.innerHTML = '';
    for (let i = 0; i < 20; i += 1) {
      const col = document.createElement('div');
      col.className = 'col';
      col.innerHTML = `
        <div class="ae-skeleton-card">
          <div class="ae-skeleton-img"></div>
          <div class="ae-skeleton-body">
            <div class="ae-skeleton-line"></div>
            <div class="ae-skeleton-line short"></div>
          </div>
        </div>`;
      els.resultsGrid.appendChild(col);
    }
  }

  function sourceBadgeClass(source) {
    return source === 'harvard' ? 'ae-source-harvard' : 'ae-source-met';
  }

  function sourceBadgeLabel(source) {
    return source === 'harvard' ? 'Harvard' : 'Met';
  }

  function createResultCard(item, { onClick, showRemove }) {
    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = 'card ae-card h-100';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'ae-card-img-wrap';

    const badge = document.createElement('span');
    badge.className = `ae-source-badge ${sourceBadgeClass(item.source)}`;
    badge.textContent = sourceBadgeLabel(item.source);
    imgWrap.appendChild(badge);

    if (item.hasImage && item.imageUrl) {
      const img = document.createElement('img');
      img.className = 'ae-card-img';
      img.src = item.imageUrl;
      img.alt = item.title || '';
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'ae-no-img-placeholder';
      ph.textContent = 'No Image Available';
      imgWrap.appendChild(ph);
    }

    const body = document.createElement('div');
    body.className = 'card-body d-flex flex-column';

    const title = document.createElement('div');
    title.className = 'ae-card-title';
    title.textContent = item.title || 'Untitled';

    const artist = document.createElement('div');
    artist.className = 'ae-card-meta ae-card-artist';
    artist.textContent = item.artist || 'Unknown artist';

    const date = document.createElement('div');
    date.className = 'ae-card-meta-sub ae-card-date';
    date.textContent = item.date || '';

    body.appendChild(title);
    body.appendChild(artist);
    body.appendChild(date);

    if (showRemove) {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn ae-remove-btn';
      rm.innerHTML = '&times;';
      rm.setAttribute('aria-label', 'Remove from Favorites');
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        Favorites.remove(item.source, item.id);
        updateFavBadge();
        renderFavorites();
      });
      imgWrap.appendChild(rm);
    }

    card.appendChild(imgWrap);
    card.appendChild(body);
    col.appendChild(card);

    if (onClick) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        onClick(item);
      });
    }

    return col;
  }

  function renderResults() {
    els.resultsGrid.innerHTML = '';
    els.resultsEmpty.classList.add('d-none');
    els.resultsCount.classList.remove('d-none');
    els.resultsCount.textContent = `${state.totalRecords} results found`;

    if (!state.results.length) {
      els.resultsCount.classList.add('d-none');
      els.resultsEmpty.classList.remove('d-none');
      els.paginationWrap.classList.add('d-none');
      return;
    }

    for (const item of state.results) {
      els.resultsGrid.appendChild(
        createResultCard(item, {
          onClick: (it) => openDetail(it.source, it.id),
        })
      );
    }

    els.paginationWrap.classList.remove('d-none');
    els.pageInfo.textContent = `Page ${state.page} of ${state.totalPages}`;
    els.pagePrev.disabled = state.page <= 1;
    els.pageNext.disabled = state.page >= state.totalPages;
  }

  async function performSearch(pageOverride) {
    const q = els.searchInput.value.trim();
    const page = pageOverride != null ? pageOverride : state.page;
    const source = els.sourceSelect.value;
    const hasImage = els.hasImage.checked;

    if (!q) {
      state.results = [];
      state.totalPages = 1;
      state.totalRecords = 0;
      state.page = 1;
      els.resultsGrid.innerHTML = '';
      els.resultsEmpty.classList.add('d-none');
      els.resultsCount.classList.add('d-none');
      els.paginationWrap.classList.add('d-none');
      setResultsAlert('');
      return;
    }

    const seq = ++state.searchSeq;
    state.loading = true;
    setResultsAlert('');
    renderSkeletons();
    els.resultsEmpty.classList.add('d-none');
    els.paginationWrap.classList.add('d-none');
    els.resultsCount.classList.add('d-none');

    try {
      const data = await Api.search({ q, page, source, hasImage });
      if (seq !== state.searchSeq) return;

      state.query = q;
      state.source = source;
      state.hasImage = hasImage;
      state.page = data.page || page;
      state.totalPages = data.totalPages || 1;
      state.totalRecords = data.totalRecords != null ? data.totalRecords : (data.items || []).length;
      state.results = data.items || [];
      renderResults();
    } catch (e) {
      if (seq !== state.searchSeq) return;
      state.results = [];
      els.resultsGrid.innerHTML = '';
      els.resultsEmpty.classList.add('d-none');
      els.paginationWrap.classList.add('d-none');
      els.resultsCount.classList.add('d-none');
      setResultsAlert(e.message || 'Search failed.');
    } finally {
      state.loading = false;
    }
  }

  const debouncedSearch = debounce(() => {
    state.page = 1;
    performSearch(1);
  }, 300);

  function onSearchButtonClick() {
    const q = els.searchInput.value.trim();
    if (!q) {
      showSearchValidation();
      return;
    }
    hideSearchValidation();
    state.page = 1;
    performSearch(1);
  }

  function resetDetailTabData() {
    state.detailLoads = { bio: false, related: false, map: false };
    els.bioLoading.classList.remove('d-none');
    els.bioContent.classList.add('d-none');
    els.bioEmpty.classList.add('d-none');
    els.relatedLoading.classList.remove('d-none');
    els.relatedGrid.classList.add('d-none');
    els.relatedEmpty.classList.add('d-none');
    els.relatedGrid.innerHTML = '';
    els.mapFallback.classList.add('d-none');
    MuseumMap.destroy();
    hideRelatedHover();
  }

  function showOverview(detail) {
    els.overviewFields.innerHTML = '';
    const rows = [
      ['Date', detail.date],
      ['Medium', detail.medium],
      ['Dimensions', detail.dimensions],
      ['Department', detail.department],
      ['Museum', detail.museumName],
    ];
    for (const [k, v] of rows) {
      if (!v) continue;
      const dt = document.createElement('dt');
      dt.className = 'col-sm-3';
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.className = 'col-sm-9';
      dd.textContent = v;
      els.overviewFields.appendChild(dt);
      els.overviewFields.appendChild(dd);
    }
    if (detail.objectUrl) {
      els.museumSiteLink.href = detail.objectUrl;
      els.museumSiteLink.classList.remove('d-none');
    } else {
      els.museumSiteLink.classList.add('d-none');
    }
  }

  function updateFavToggle() {
    const d = state.detail;
    if (!d) return;
    const on = Favorites.isFavorite(d.source, d.id);
    els.favToggleBtn.classList.toggle('active', on);
    els.favToggleBtn.innerHTML = on ? '♥ Remove from Favorites' : '♡ Add to Favorites';
  }

  async function loadBio() {
    if (state.detailLoads.bio) return;
    const d = state.detail;
    const name = (d.artistNameForWiki || d.artist || '').trim();
    if (!name) {
      els.bioLoading.classList.add('d-none');
      els.bioEmpty.classList.remove('d-none');
      state.detailLoads.bio = true;
      return;
    }
    try {
      const wiki = await Api.getArtistBio(name);
      els.bioLoading.classList.add('d-none');
      if (!wiki.found || !wiki.extract) {
        els.bioEmpty.classList.remove('d-none');
        state.detailLoads.bio = true;
        return;
      }
      els.bioContent.classList.remove('d-none');
      els.bioName.textContent = wiki.title || name;
      els.bioExtract.textContent = wiki.extract;
      if (wiki.thumbnail && wiki.thumbnail.source) {
        els.bioThumb.src = wiki.thumbnail.source;
        els.bioThumb.classList.remove('d-none');
        els.bioThumb.alt = wiki.title || name;
      } else {
        els.bioThumb.classList.add('d-none');
      }
      const url = wiki.content_urls && wiki.content_urls.desktop && wiki.content_urls.desktop.page;
      if (url) {
        els.bioWikiLink.href = url;
        els.bioWikiLink.classList.remove('d-none');
      } else {
        els.bioWikiLink.classList.add('d-none');
      }
    } catch {
      els.bioLoading.classList.add('d-none');
      els.bioEmpty.classList.remove('d-none');
    }
    state.detailLoads.bio = true;
  }

  async function loadRelated() {
    if (state.detailLoads.related) return;
    const d = state.detail;
    const name = (d.artistNameForWiki || d.artist || '').trim();
    if (!name) {
      els.relatedLoading.classList.add('d-none');
      els.relatedEmpty.classList.remove('d-none');
      state.detailLoads.related = true;
      return;
    }
    try {
      const data = await Api.getRelatedWorks(name, d.source, d.id);
      const items = data.items || [];
      els.relatedLoading.classList.add('d-none');
      if (!items.length) {
        els.relatedEmpty.classList.remove('d-none');
        state.detailLoads.related = true;
        return;
      }
      els.relatedGrid.classList.remove('d-none');
      els.relatedGrid.innerHTML = '';
      for (const it of items) {
        const cell = document.createElement('div');
        cell.className = 'ae-related-cell';
        const img = document.createElement('img');
        img.className = 'ae-related-thumb';
        img.alt = it.title || '';
        if (it.imageUrl) {
          img.src = it.imageUrl;
        } else {
          img.src =
            'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect fill="#e5e7eb" width="120" height="120"/></svg>'
            );
        }
        img.dataset.title = it.title || '';
        img.addEventListener('mousemove', onRelatedMouseMove);
        img.addEventListener('mouseleave', onRelatedMouseLeave);
        img.addEventListener('click', () => openDetail(it.source, it.id));
        cell.appendChild(img);
        els.relatedGrid.appendChild(cell);
      }
    } catch {
      els.relatedLoading.classList.add('d-none');
      els.relatedEmpty.classList.remove('d-none');
    }
    state.detailLoads.related = true;
  }

  function loadMap() {
    if (state.detailLoads.map) return;
    const d = state.detail;
    const loc = d.museumLocation;
    if (!loc || loc.lat == null || loc.lng == null) {
      els.mapFallback.classList.remove('d-none');
      state.detailLoads.map = true;
      return;
    }
    els.mapMuseumName.textContent = loc.displayName || d.museumName || 'Museum';
    els.mapMuseumSub.textContent = loc.address || '';
    MuseumMap.init(
      'map-container',
      loc.lat,
      loc.lng,
      loc.displayName || d.museumName,
      loc.address || ''
    );
    state.detailLoads.map = true;
  }

  async function openDetail(source, id) {
    showView('detail');
    window.scrollTo(0, 0);
    resetDetailTabData();

    const tab = bootstrap.Tab.getOrCreateInstance(els.tabOverviewBtn);
    tab.show();

    els.detailTitle.textContent = '';
    els.detailArtist.textContent = '';
    els.detailImage.classList.add('d-none');
    els.detailNoImageTitle.classList.add('d-none');

    try {
      const detail = await Api.getArtwork(source, id);
      state.detail = detail;
      els.detailTitle.textContent = detail.title || 'Untitled';
      els.detailArtist.textContent = detail.artist || '';

      const hasImg = Boolean(detail.imageUrl);
      if (hasImg) {
        els.detailImage.src = detail.imageUrl;
        els.detailImage.alt = detail.title || '';
        els.detailImage.classList.remove('d-none');
        els.detailNoImageTitle.classList.add('d-none');
      } else {
        els.detailImage.classList.add('d-none');
        els.detailNoImageTitle.textContent = detail.title || 'Untitled';
        els.detailNoImageTitle.classList.remove('d-none');
      }

      showOverview(detail);
      updateFavToggle();
    } catch (e) {
      state.detail = null;
      els.detailTitle.textContent = 'Unable to load artwork';
      els.detailArtist.textContent = e.message || '';
    }
  }

  els.favToggleBtn.addEventListener('click', () => {
    const d = state.detail;
    if (!d) return;
    if (Favorites.isFavorite(d.source, d.id)) {
      Favorites.remove(d.source, d.id);
    } else {
      Favorites.add(d);
    }
    updateFavBadge();
    updateFavToggle();
  });

  els.backBtn.addEventListener('click', () => {
    MuseumMap.destroy();
    showView('search');
  });

  els.navSearch.addEventListener('click', () => showView('search'));
  els.navFavorites.addEventListener('click', () => {
    renderFavorites();
    showView('favorites');
  });
  els.navBrand.addEventListener('click', (e) => {
    e.preventDefault();
    showView('search');
  });

  els.searchBtn.addEventListener('click', onSearchButtonClick);
  els.searchInput.addEventListener('input', () => {
    hideSearchValidation();
    debouncedSearch();
  });

  els.sourceSelect.addEventListener('change', () => {
    if (els.searchInput.value.trim()) {
      state.page = 1;
      performSearch(1);
    }
  });

  els.hasImage.addEventListener('change', () => {
    if (els.searchInput.value.trim()) {
      state.page = 1;
      performSearch(1);
    }
  });

  els.pagePrev.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    performSearch(state.page);
  });

  els.pageNext.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;
    state.page += 1;
    performSearch(state.page);
  });

  els.tabBioBtn.addEventListener('shown.bs.tab', () => {
    loadBio();
  });
  els.tabRelatedBtn.addEventListener('shown.bs.tab', () => {
    loadRelated();
  });
  els.tabMapBtn.addEventListener('shown.bs.tab', () => {
    loadMap();
    setTimeout(() => MuseumMap.invalidateSize(), 250);
  });

  function renderFavorites() {
    const list = Favorites.getAll();
    els.favoritesGrid.innerHTML = '';
    if (!list.length) {
      els.favoritesEmpty.classList.remove('d-none');
      els.favoritesGrid.classList.add('d-none');
      return;
    }
    els.favoritesEmpty.classList.add('d-none');
    els.favoritesGrid.classList.remove('d-none');
    for (const item of list) {
      els.favoritesGrid.appendChild(
        createResultCard(item, {
          showRemove: true,
          onClick: (it) => openDetail(it.source, it.id),
        })
      );
    }
  }

  if (els.navToggle) {
    els.navToggle.addEventListener('click', toggleNavMenu);
  }

  updateFavBadge();
})();
