/**
 * Art Collection Explorer — Express API proxy for Met, Harvard Art Museums, and Wikipedia.
 */

const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 8080;
const HARVARD_API_KEY = process.env.HARVARD_API_KEY;

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const HARVARD_BASE = 'https://api.harvardartmuseums.org';

const PAGE_SIZE = 20;
const RELATED_SIZE = 8;
const FETCH_CONCURRENCY = 4;
const MET_RETRYABLE_STATUS = new Set([403, 429, 500, 502, 503, 504]);
const MET_OBJECT_CACHE_TTL_MS = 10 * 60 * 1000;

const MUSEUM_COORDS = {
  met: {
    lat: 40.7794,
    lng: -73.9632,
    displayName: 'The Metropolitan Museum of Art',
    address: '1000 5th Ave, New York, NY 10028',
  },
  harvard: {
    lat: 42.3744,
    lng: -71.1143,
    displayName: 'Harvard Art Museums',
    address: '32 Quincy St, Cambridge, MA 02138',
  },
};

const app = express();

/** Met and some CDNs block Node's default User-Agent with 403; use a normal browser UA. */
const EXTERNAL_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

async function fetchJson(url) {
  const isMetUrl = typeof url === 'string' && url.startsWith(MET_BASE);
  const maxRetries = isMetUrl ? 3 : 0;
  let attempt = 0;
  while (true) {
    const res = await fetch(url, { headers: EXTERNAL_FETCH_HEADERS });
    if (res.ok) return res.json();

    const status = res.status;
    const shouldRetry = isMetUrl && MET_RETRYABLE_STATUS.has(status) && attempt < maxRetries;
    if (!shouldRetry) {
      const err = new Error(`HTTP ${status}`);
      err.status = status;
      throw err;
    }

    // Exponential backoff with jitter to reduce burst pressure on Met API.
    const waitMs = 250 * 2 ** attempt + Math.floor(Math.random() * 180);
    attempt += 1;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function normalizeMetSummary(obj) {
  if (!obj || !obj.objectID) return null;
  const imageUrl = obj.primaryImageSmall || obj.primaryImage || '';
  const hasImage = Boolean(imageUrl);
  return {
    id: String(obj.objectID),
    source: 'met',
    title: obj.title || 'Untitled',
    artist: obj.artistDisplayName || '',
    date: obj.objectDate || '',
    imageUrl,
    hasImage,
    museumName: obj.repository || MUSEUM_COORDS.met.displayName,
  };
}

function normalizeMetDetail(obj) {
  const base = normalizeMetSummary(obj);
  if (!base) return null;
  return {
    ...base,
    imageUrl: obj.primaryImage || obj.primaryImageSmall || base.imageUrl,
    medium: obj.medium || '',
    dimensions: obj.dimensions || '',
    department: obj.department || '',
    objectUrl: obj.objectURL || '',
    artistNameForWiki: obj.artistDisplayName || '',
    museumLocation: { ...MUSEUM_COORDS.met },
  };
}

const metObjectCache = new Map();

async function getMetSummaryById(objectId) {
  const key = String(objectId);
  const now = Date.now();
  const cached = metObjectCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const obj = await fetchJson(`${MET_BASE}/objects/${objectId}`);
  const normalized = normalizeMetSummary(obj);
  metObjectCache.set(key, { value: normalized, expiresAt: now + MET_OBJECT_CACHE_TTL_MS });
  return normalized;
}

function harvardPrimaryImage(rec) {
  if (!rec) return '';
  if (rec.primaryimageurl) return rec.primaryimageurl;
  if (rec.images && rec.images.length && rec.images[0].baseimageurl) {
    return rec.images[0].baseimageurl;
  }
  return '';
}

function normalizeHarvardSummary(rec) {
  if (!rec || rec.id == null) return null;
  const imageUrl = harvardPrimaryImage(rec);
  const hasImage = Boolean(imageUrl);
  let artist = '';
  if (Array.isArray(rec.people) && rec.people.length) {
    const lower = (s) => String(s || '').toLowerCase();
    const p =
      rec.people.find((x) => lower(x.role) === 'artist') ||
      rec.people.find((x) => lower(x.role).includes('artist')) ||
      rec.people[0];
    artist = p.name || '';
  }
  return {
    id: String(rec.id),
    source: 'harvard',
    title: rec.title || 'Untitled',
    artist,
    date: rec.dated || rec.date || '',
    imageUrl,
    hasImage,
    museumName: MUSEUM_COORDS.harvard.displayName,
  };
}

function normalizeHarvardDetail(rec) {
  const base = normalizeHarvardSummary(rec);
  if (!base) return null;
  const dims =
    rec.dimensions ||
    (rec.dimensionsformatted && rec.dimensionsformatted.length
      ? rec.dimensionsformatted.join('; ')
      : '');
  const medium = rec.medium || (rec.classification && rec.classification.medium) || '';
  const dept =
    rec.department ||
    (rec.classification &&
    typeof rec.classification === 'object' &&
    !Array.isArray(rec.classification)
      ? rec.classification.department
      : '') ||
    '';
  return {
    ...base,
    imageUrl: harvardPrimaryImage(rec) || base.imageUrl,
    medium,
    dimensions: dims,
    department: dept,
    objectUrl: rec.url || `https://harvardartmuseums.org/collections/object/${rec.id}`,
    artistNameForWiki: base.artist,
    museumLocation: { ...MUSEUM_COORDS.harvard },
  };
}

async function fetchMetObjectsBatch(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (objectId) => {
        try {
          return await getMetSummaryById(objectId);
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (r) out.push(r);
    }
  }
  return out;
}

function interleave(a, b, max = PAGE_SIZE) {
  const out = [];
  let i = 0;
  let j = 0;
  while (out.length < max && (i < a.length || j < b.length)) {
    if (i < a.length) out.push(a[i++]);
    if (out.length >= max) break;
    if (j < b.length) out.push(b[j++]);
  }
  return out;
}

function normalizeUserSearchQuery(q) {
  return String(q || '')
    .replace(/\bgoph\b/gi, 'gogh')
    .trim();
}

function filterHasImage(list, requireImage) {
  if (!requireImage) return list;
  return list.filter((x) => x.hasImage);
}

async function searchMet(q, page, hasImage) {
  const searchUrl = hasImage
    ? `${MET_BASE}/search?q=${encodeURIComponent(q)}&hasImages=true`
    : `${MET_BASE}/search?q=${encodeURIComponent(q)}`;
  const searchData = await fetchJson(searchUrl);
  const objectIDs = searchData.objectIDs || [];
  const totalRecords = objectIDs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const slice = objectIDs.slice(start, start + PAGE_SIZE);
  const items = slice.length ? await fetchMetObjectsBatch(slice) : [];
  return {
    items: filterHasImage(items, hasImage),
    page,
    totalPages,
    totalRecords,
    pageSize: PAGE_SIZE,
  };
}

async function searchHarvard(q, page, hasImage) {
  if (!HARVARD_API_KEY) {
    const err = new Error('Harvard API key not configured');
    err.status = 503;
    throw err;
  }
  const url = `${HARVARD_BASE}/object?apikey=${encodeURIComponent(
    HARVARD_API_KEY
  )}&keyword=${encodeURIComponent(q)}&size=${PAGE_SIZE}&page=${page}`;
  const data = await fetchJson(url);
  const records = data.records || [];
  let items = records.map(normalizeHarvardSummary).filter(Boolean);
  if (hasImage) items = items.filter((x) => x.hasImage);
  const info = data.info || {};
  const totalRecords = info.totalrecords != null ? info.totalrecords : items.length;
  const totalPages = info.pages != null ? Math.max(1, info.pages) : Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  return {
    items,
    page,
    totalPages,
    totalRecords,
    pageSize: PAGE_SIZE,
  };
}

async function searchBoth(q, page, hasImage) {
  const [metRes, harvRes] = await Promise.all([
    searchMet(q, page, hasImage),
    searchHarvard(q, page, hasImage),
  ]);
  const merged = interleave(metRes.items, harvRes.items, PAGE_SIZE);
  const totalPages = Math.max(metRes.totalPages, harvRes.totalPages);
  const totalRecords = metRes.totalRecords + harvRes.totalRecords;
  return {
    items: merged,
    page,
    totalPages,
    totalRecords,
    pageSize: PAGE_SIZE,
  };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/search', async (req, res) => {
  try {
    const q = normalizeUserSearchQuery(req.query.q);
    if (!q) {
      return res.status(400).json({ error: 'Missing required query parameter: q' });
    }
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const sourceRaw = String(req.query.source || 'both').toLowerCase();
    const source = ['met', 'harvard', 'both'].includes(sourceRaw) ? sourceRaw : 'both';
    const hasImage = String(req.query.hasImage || '') === 'true';

    if ((source === 'harvard' || source === 'both') && !HARVARD_API_KEY) {
      return res.status(503).json({ error: 'Harvard API key not configured (HARVARD_API_KEY)' });
    }

    let payload;
    if (source === 'met') payload = await searchMet(q, page, hasImage);
    else if (source === 'harvard') payload = await searchHarvard(q, page, hasImage);
    else payload = await searchBoth(q, page, hasImage);

    return res.json(payload);
  } catch (e) {
    console.error('search error', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return res.status(status).json({ error: 'Search failed', details: String(e.message) });
  }
});

app.get('/api/artwork/:source/:id', async (req, res) => {
  try {
    const source = String(req.params.source || '').toLowerCase();
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    if (source === 'met') {
      const obj = await fetchJson(`${MET_BASE}/objects/${id}`);
      const detail = normalizeMetDetail(obj);
      if (!detail) return res.status(404).json({ error: 'Not found' });
      return res.json(detail);
    }

    if (source === 'harvard') {
      if (!HARVARD_API_KEY) {
        return res.status(503).json({ error: 'Harvard API key not configured' });
      }
      const rec = await fetchJson(
        `${HARVARD_BASE}/object/${encodeURIComponent(id)}?apikey=${encodeURIComponent(
          HARVARD_API_KEY
        )}`
      );
      const detail = normalizeHarvardDetail(rec);
      if (!detail) return res.status(404).json({ error: 'Not found' });
      return res.json(detail);
    }

    return res.status(400).json({ error: 'Invalid source' });
  } catch (e) {
    console.error('artwork detail', e);
    if (e.status === 404) return res.status(404).json({ error: 'Not found' });
    return res.status(500).json({ error: 'Failed to load artwork', details: String(e.message) });
  }
});

app.get('/api/artist/:name', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.name || '').trim();
    if (!raw) return res.status(400).json({ error: 'Artist name required' });

    const wikiTitle = raw.replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      wikiTitle
    )}`;
    const r = await fetch(url, { headers: EXTERNAL_FETCH_HEADERS });
    if (r.status === 404) {
      return res.json({
        found: false,
        title: raw,
        extract: '',
        content_urls: null,
        thumbnail: null,
      });
    }
    if (!r.ok) {
      return res.status(502).json({ error: 'Wikipedia request failed', status: r.status });
    }
    const data = await r.json();
    return res.json({
      found: true,
      title: data.title || raw,
      extract: data.extract || '',
      content_urls: data.content_urls || null,
      thumbnail: data.thumbnail || null,
    });
  } catch (e) {
    console.error('wikipedia', e);
    return res.status(500).json({ error: 'Artist lookup failed', details: String(e.message) });
  }
});

app.get('/api/artist/:name/works', async (req, res) => {
  try {
    const raw = decodeURIComponent(req.params.name || '').trim();
    if (!raw) return res.status(400).json({ error: 'Artist name required' });

    const excludeSource = String(req.query.excludeSource || '').toLowerCase();
    const excludeId = String(req.query.excludeId || '');

    const exclude = (item) =>
      excludeSource && excludeId && item.source === excludeSource && String(item.id) === excludeId;

    async function relatedMet() {
      const searchUrl = `${MET_BASE}/search?q=${encodeURIComponent(raw)}&hasImages=true`;
      let objectIDs = [];
      try {
        const sd = await fetchJson(searchUrl);
        objectIDs = sd.objectIDs || [];
      } catch {
        return [];
      }
      const out = [];
      for (let i = 0; i < objectIDs.length && out.length < RELATED_SIZE * 2; i += PAGE_SIZE) {
        const slice = objectIDs.slice(i, i + PAGE_SIZE);
        const items = slice.length ? await fetchMetObjectsBatch(slice) : [];
        for (const it of items) {
          if (!it || exclude(it) || !it.hasImage) continue;
          out.push(it);
          if (out.length >= RELATED_SIZE * 2) break;
        }
      }
      return out;
    }

    async function relatedHarvard() {
      if (!HARVARD_API_KEY) return [];
      const url = `${HARVARD_BASE}/object?apikey=${encodeURIComponent(
        HARVARD_API_KEY
      )}&keyword=${encodeURIComponent(raw)}&size=20&page=1`;
      try {
        const data = await fetchJson(url);
        const records = data.records || [];
        return records
          .map(normalizeHarvardSummary)
          .filter(Boolean)
          .filter((x) => x.hasImage)
          .filter((x) => !exclude(x));
      } catch {
        return [];
      }
    }

    const [metItems, harvItems] = await Promise.all([relatedMet(), relatedHarvard()]);
    const merged = interleave(metItems, harvItems, RELATED_SIZE);
    return res.json({ items: merged });
  } catch (e) {
    console.error('related works', e);
    return res.status(500).json({ error: 'Related works failed', details: String(e.message) });
  }
});

app.listen(PORT, () => {
  console.log(`Art Explorer listening on port ${PORT}`);
});
