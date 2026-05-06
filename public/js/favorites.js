const AE_STORAGE_KEY = 'ae_favorites_v1';

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function favoriteKey(source, id) {
  return `${String(source).toLowerCase()}:${String(id)}`;
}

const Favorites = {
  getAll() {
    try {
      const raw = localStorage.getItem(AE_STORAGE_KEY);
      const list = safeParse(raw, []);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  saveAll(list) {
    try {
      localStorage.setItem(AE_STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  },

  isFavorite(source, id) {
    const k = favoriteKey(source, id);
    return this.getAll().some((x) => favoriteKey(x.source, x.id) === k);
  },

  add(item) {
    const list = this.getAll();
    const k = favoriteKey(item.source, item.id);
    if (list.some((x) => favoriteKey(x.source, x.id) === k)) return list;
    const entry = {
      id: String(item.id),
      source: String(item.source).toLowerCase(),
      title: item.title || 'Untitled',
      artist: item.artist || '',
      date: item.date || '',
      imageUrl: item.imageUrl || '',
      hasImage: Boolean(item.hasImage),
      museumName: item.museumName || '',
    };
    list.unshift(entry);
    this.saveAll(list);
    return list;
  },

  remove(source, id) {
    const k = favoriteKey(source, id);
    const list = this.getAll().filter((x) => favoriteKey(x.source, x.id) !== k);
    this.saveAll(list);
    return list;
  },

  count() {
    return this.getAll().length;
  },
};
