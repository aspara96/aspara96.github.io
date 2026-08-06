// add.js
// 追加画面（add.html）専用の処理です。
// common.js の関数（loadPlaces / savePlaces / formatDate / createSelectionIcon / geocodeSearch など）に依存しています。

(function () {
  'use strict';

  var selectedCoords = null; // { lat, lng }
  var map = null;
  var selectionMarker = null;

  var els = {
    form: document.getElementById('placeForm'),
    name: document.getElementById('placeName'),
    url: document.getElementById('placeUrl'),
    searchQuery: document.getElementById('searchQuery'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    coordsText: document.getElementById('coordsText'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    memo: document.getElementById('placeMemo'),
    saveBtn: document.getElementById('saveBtn'),
  };

  init();

  function init() {
    var today = formatDate(new Date());
    els.startDate.value = today;
    els.endDate.value = today;
    initMap();
    bindEvents();
  }

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', function (e) {
      setSelectedCoords(e.latlng.lat, e.latlng.lng);
    });
  }

  function bindEvents() {
    els.form.addEventListener('submit', onSave);
    els.searchBtn.addEventListener('click', onSearch);
    els.searchQuery.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSearch();
      }
    });
  }

  function setSelectedCoords(lat, lng) {
    selectedCoords = { lat: lat, lng: lng };
    els.coordsText.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    els.saveBtn.disabled = false;

    if (selectionMarker) {
      selectionMarker.setLatLng([lat, lng]);
    } else {
      selectionMarker = L.marker([lat, lng], { icon: createSelectionIcon() }).addTo(map);
    }
    map.panTo([lat, lng]);
  }

  function onSearch() {
    var q = els.searchQuery.value.trim();
    if (!q) return;

    showSearchLoading(els.searchResults);

    geocodeSearch(q)
      .then(function (data) {
        renderSearchResultsList(els.searchResults, data, function (r) {
          var lat = parseFloat(r.lat);
          var lng = parseFloat(r.lon);
          setSelectedCoords(lat, lng);
          map.setView([lat, lng], 14);
          els.searchResults.innerHTML = '';
          if (!els.name.value) {
            els.name.value = r.display_name.split(',')[0];
          }
        });
      })
      .catch(function () {
        showSearchError(els.searchResults, '検索に失敗しました。地図を直接タップして選択してください。');
      });
  }

  function onSave(e) {
    e.preventDefault();

    if (!selectedCoords) {
      alert('地図をタップするか、検索結果から場所を選択してください');
      return;
    }

    var name = els.name.value.trim();
    var startDate = els.startDate.value;
    var endDate = els.endDate.value;

    if (!name || !startDate || !endDate) return;

    if (startDate > endDate) {
      alert('終了日は開始日以降の日付にしてください');
      return;
    }

    var url = els.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    var place = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      startDate: startDate,
      endDate: endDate,
      memo: els.memo.value.trim(),
      url: url,
    };

    var places = loadPlaces();
    places.push(place);
    savePlaces(places);

    // 保存後は一覧画面に戻る
    window.location.href = 'index.html';
  }
})();
