/* global MuseumMap — Leaflet helpers */

const MuseumMap = {
  _map: null,

  init(containerId, lat, lng, label, address) {
    const el = document.getElementById(containerId);
    if (!el || typeof L === 'undefined') return;

    this.destroy();

    this._map = L.map(el).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this._map);

    const popupHtml = `<strong>${label || 'Museum'}</strong>${address ? `<br/>${address}` : ''}`;
    L.marker([lat, lng]).addTo(this._map).bindPopup(popupHtml).openPopup();

    setTimeout(() => {
      if (this._map) this._map.invalidateSize(true);
    }, 200);
  },

  destroy() {
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  },

  invalidateSize() {
    if (this._map) {
      this._map.invalidateSize(true);
    }
  },
};
