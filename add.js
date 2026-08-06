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
    // 期間は任意項目のため、初期値は空欄のままにする
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
    if (!name) return;

    var startDate = els.startDate.value;
    var endDate = els.endDate.value;

    // 期間は「両方入力」か「両方空欄（期限なし）」のどちらかのみ許可する
    if ((startDate && !endDate) || (!startDate && endDate)) {
      alert('開始日・終了日は両方入力するか、両方空欄にしてください（空欄の場合は期限なしとして登録されます）');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
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
      startDate: startDate, // 空文字の場合は「期限なし」
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
