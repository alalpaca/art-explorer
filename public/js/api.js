/* global Api — backend JSON helpers */

const Api = {
  async _json(res) {
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: 'Invalid JSON', raw: text };
    }
    if (!res.ok) {
      const msg = (data && data.error) || res.statusText || 'Request failed';
      const err = new Error(msg);
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  },

  buildSearchUrl({ q, page, source, hasImage }) {
    const u = new URL('/api/search', window.location.origin);
    u.searchParams.set('q', q);
    u.searchParams.set('page', String(page));
    u.searchParams.set('source', source);
    u.searchParams.set('hasImage', hasImage ? 'true' : 'false');
    return u.toString();
  },

  async search(params) {
    const res = await fetch(this.buildSearchUrl(params));
    return this._json(res);
  },

  async getArtwork(source, id) {
    const res = await fetch(`/api/artwork/${encodeURIComponent(source)}/${encodeURIComponent(id)}`);
    return this._json(res);
  },

  async getArtistBio(name) {
    const enc = encodeURIComponent(name.trim());
    const res = await fetch(`/api/artist/${enc}`);
    return this._json(res);
  },

  async getRelatedWorks(name, excludeSource, excludeId) {
    const enc = encodeURIComponent(name.trim());
    const u = new URL(`/api/artist/${enc}/works`, window.location.origin);
    if (excludeSource && excludeId != null) {
      u.searchParams.set('excludeSource', excludeSource);
      u.searchParams.set('excludeId', String(excludeId));
    }
    const res = await fetch(u.toString());
    return this._json(res);
  },
};
