(function () {
  'use strict';

  const STORAGE_KEY = 'ikitai_places_v1';

  let places = loadPlaces();
  let selectedCoords = null; // { lat, lng }
  let map = null;
  let markersLayer = null;
  let selectionMarker = null;

  const els = {
    form: document.getElementById('placeForm'),
    name: document.getElementById('placeName'),
    searchQuery: document.getElementById('searchQuery'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    coordsText: document.getElementById('coordsText'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    memo: document.getElementById('placeMemo'),
    saveBtn: document.getElementById('saveBtn'),
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
    viewDate: document.getElementById('viewDate'),
    todayBtn: document.getElementById('todayBtn'),
    mapNote: document.getElementById('mapNote'),
    clearAllBtn: document.getElementById('clearAllBtn'),
  };

  init();

  function init() {
    const today = formatDate(new Date());
    els.viewDate.value = today;
    els.startDate.value = today;
    els.endDate.value = today;

    initMap();
    bindEvents();
    renderPlaceList();
    renderMapMarkers();
  }

  // ---------- Map setup ----------

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5); // 東京を初期中心に

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      setSelectedCoords(e.latlng.lat, e.latlng.lng);
    });
  }

  function createPlaceIcon() {
    return L.divIcon({
      className: 'place-marker',
      html: '<div class="place-marker-inner"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      popupAnchor: [0, -22],
    });
  }

  function createSelectionIcon() {
    return L.divIcon({
      className: 'selection-marker',
      html: '<div class="selection-marker-inner"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }

  // ---------- Events ----------

  function bindEvents() {
    els.form.addEventListener('submit', onSave);
    els.searchBtn.addEventListener('click', onSearch);
    els.searchQuery.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSearch();
      }
    });
    els.viewDate.addEventListener('change', () => {
      renderMapMarkers();
      renderPlaceList();
    });
    els.todayBtn.addEventListener('click', () => {
      els.viewDate.value = formatDate(new Date());
      renderMapMarkers();
      renderPlaceList();
    });
    els.clearAllBtn.addEventListener('click', () => {
      if (places.length === 0) return;
      if (confirm('保存されている場所を全て削除します。よろしいですか？')) {
        places = [];
        savePlaces();
        renderPlaceList();
        renderMapMarkers();
      }
    });
  }

  // ---------- Location selection ----------

  function setSelectedCoords(lat, lng) {
    selectedCoords = { lat, lng };
    els.coordsText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    els.saveBtn.disabled = false;

    if (selectionMarker) {
      selectionMarker.setLatLng([lat, lng]);
    } else {
      selectionMarker = L.marker([lat, lng], { icon: createSelectionIcon() }).addTo(map);
    }
    map.panTo([lat, lng]);
  }

  async function onSearch() {
    const q = els.searchQuery.value.trim();
    if (!q) return;

    els.searchResults.innerHTML = '';
    const loadingLi = document.createElement('li');
    loadingLi.className = 'search-loading';
    loadingLi.textContent = '検索中...';
    els.searchResults.appendChild(loadingLi);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ja&q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('request failed');
      const data = await res.json();
      renderSearchResults(data);
    } catch (err) {
      els.searchResults.innerHTML = '';
      const errLi = document.createElement('li');
      errLi.className = 'search-error';
      errLi.textContent = '検索に失敗しました。地図を直接クリックして選択してください。';
      els.searchResults.appendChild(errLi);
    }
  }

  function renderSearchResults(results) {
    els.searchResults.innerHTML = '';

    if (!results || results.length === 0) {
      const li = document.createElement('li');
      li.className = 'search-empty';
      li.textContent = '見つかりませんでした';
      els.searchResults.appendChild(li);
      return;
    }

    results.forEach((r) => {
      const li = document.createElement('li');
      li.textContent = r.display_name;
      li.addEventListener('click', () => {
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        setSelectedCoords(lat, lng);
        map.setView([lat, lng], 14);
        els.searchResults.innerHTML = '';
        if (!els.name.value) {
          els.name.value = r.display_name.split(',')[0];
        }
      });
      els.searchResults.appendChild(li);
    });
  }

  // ---------- Save / delete ----------

  function onSave(e) {
    e.preventDefault();

    if (!selectedCoords) {
      alert('地図をクリックするか、検索結果から場所を選択してください');
      return;
    }

    const name = els.name.value.trim();
    const startDate = els.startDate.value;
    const endDate = els.endDate.value;

    if (!name || !startDate || !endDate) return;

    if (startDate > endDate) {
      alert('終了日は開始日以降の日付にしてください');
      return;
    }

    const place = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      startDate,
      endDate,
      memo: els.memo.value.trim(),
    };

    places.push(place);
    savePlaces();
    resetForm();
    renderPlaceList();
    renderMapMarkers();
  }

  function resetForm() {
    els.form.reset();
    const today = formatDate(new Date());
    els.startDate.value = today;
    els.endDate.value = today;
    els.searchResults.innerHTML = '';
    els.coordsText.textContent = '未選択';
    els.saveBtn.disabled = true;
    selectedCoords = null;

    if (selectionMarker) {
      map.removeLayer(selectionMarker);
      selectionMarker = null;
    }
  }

  function deletePlace(id) {
    places = places.filter((p) => p.id !== id);
    savePlaces();
    renderPlaceList();
    renderMapMarkers();
  }

  // ---------- Period filtering ----------

  function isActiveOn(place, dateStr) {
    return place.startDate <= dateStr && dateStr <= place.endDate;
  }

  function getViewDate() {
    return els.viewDate.value || formatDate(new Date());
  }

  // ---------- Rendering: map ----------

  function renderMapMarkers() {
    markersLayer.clearLayers();
    const viewDate = getViewDate();
    const activePlaces = places.filter((p) => isActiveOn(p, viewDate));

    activePlaces.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: createPlaceIcon() }).addTo(markersLayer);
      marker.bindPopup(buildPopupContent(p));
    });

    if (activePlaces.length > 0) {
      const bounds = L.latLngBounds(activePlaces.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 12 });
    }

    if (places.length === 0) {
      els.mapNote.textContent = '保存された場所はまだありません';
    } else {
      els.mapNote.textContent = `${viewDate} 時点で表示中: ${activePlaces.length} / ${places.length} 件`;
    }
  }

  function buildPopupContent(p) {
    const wrap = document.createElement('div');

    const nameEl = document.createElement('span');
    nameEl.className = 'popup-place-name';
    nameEl.textContent = p.name;
    wrap.appendChild(nameEl);

    const datesEl = document.createElement('span');
    datesEl.className = 'popup-place-dates';
    datesEl.textContent = `${p.startDate} 〜 ${p.endDate}`;
    wrap.appendChild(datesEl);

    if (p.memo) {
      const memoEl = document.createElement('span');
      memoEl.className = 'popup-place-memo';
      memoEl.textContent = p.memo;
      wrap.appendChild(memoEl);
    }

    return wrap;
  }

  // ---------- Rendering: sidebar list ----------

  function renderPlaceList() {
    const viewDate = getViewDate();
    els.placeCount.textContent = `(${places.length})`;
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = 'まだ場所が保存されていません';
      els.placeList.appendChild(li);
      return;
    }

    const sorted = [...places].sort((a, b) => a.startDate.localeCompare(b.startDate));

    sorted.forEach((p) => {
      const active = isActiveOn(p, viewDate);

      const li = document.createElement('li');
      li.className = 'place-item ' + (active ? 'active' : 'inactive');

      // 左側: 場所の情報
      const stubMain = document.createElement('div');
      stubMain.className = 'stub-main';

      const nameEl = document.createElement('div');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      stubMain.appendChild(nameEl);

      if (p.memo) {
        const memoEl = document.createElement('div');
        memoEl.className = 'place-memo';
        memoEl.textContent = p.memo;
        stubMain.appendChild(memoEl);
      }

      const actions = document.createElement('div');
      actions.className = 'place-actions';

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = active ? '表示中' : '期間外';
      actions.appendChild(badge);

      const focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'focus-btn';
      focusBtn.textContent = '地図で見る';
      focusBtn.addEventListener('click', () => {
        map.setView([p.lat, p.lng], 14);
        if (active) {
          markersLayer.eachLayer((m) => {
            const ll = m.getLatLng();
            if (Math.abs(ll.lat - p.lat) < 1e-6 && Math.abs(ll.lng - p.lng) < 1e-6) {
              m.openPopup();
            }
          });
        }
      });
      actions.appendChild(focusBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', () => {
        if (confirm(`「${p.name}」を削除しますか？`)) {
          deletePlace(p.id);
        }
      });
      actions.appendChild(delBtn);

      stubMain.appendChild(actions);

      // 右側: チケット風の日付スタブ
      const stubSide = document.createElement('div');
      stubSide.className = 'stub-side';

      const dateEl = document.createElement('div');
      dateEl.className = 'stub-date';
      dateEl.innerHTML =
        formatDateShort(p.startDate) +
        '<div class="to">〜</div>' +
        formatDateShort(p.endDate);
      stubSide.appendChild(dateEl);

      li.appendChild(stubMain);
      li.appendChild(stubSide);
      els.placeList.appendChild(li);
    });
  }

  // ---------- Storage ----------

  function loadPlaces() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('読み込みエラー', e);
      return [];
    }
  }

  function savePlaces() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    } catch (e) {
      console.error('保存エラー', e);
      alert('データの保存に失敗しました');
    }
  }

  // ---------- Date helpers ----------

  function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDateShort(isoDate) {
    const [y, m, d] = isoDate.split('-');
    return `${y}/${m}/${d}`;
  }
})();
