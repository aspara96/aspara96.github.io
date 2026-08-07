// add.js
// 追加画面（add.html）専用の処理です。
// 場所の指定は「住所」欄への入力を正としつつ、検索結果の選択や地図タップでも
// 住所欄を自動入力できるようにしています。
// common.js の関数（loadPlaces / savePlaces / formatDate / createSelectionIcon /
// geocodeSearch / reverseGeocode など）に依存しています。

(function () {
  'use strict';

  // 住所欄の内容と紐づいた「確定済みの座標」。検索結果の選択・地図タップで設定され、
  // 住所欄がユーザーによって手入力・編集されると null に戻る（= 保存時に住所から再検索する）。
  var confirmedLocation = null; // { lat, lng }

  var map = null;
  var marker = null;

  var els = {
    form: document.getElementById('placeForm'),
    name: document.getElementById('placeName'),
    address: document.getElementById('placeAddress'),
    url: document.getElementById('placeUrl'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
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
    updateSaveButtonState();
  }

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', onMapClick);
  }

  function bindEvents() {
    els.form.addEventListener('submit', onSave);
    els.searchBtn.addEventListener('click', onSearch);

    els.address.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSearch();
      }
    });

    // ユーザーが住所欄を直接編集した場合、確定済みの座標は無効化する
    // （プログラムから .value を設定した場合はこのイベントは発火しない）
    els.address.addEventListener('input', function () {
      confirmedLocation = null;
      updateSaveButtonState();
    });
  }

  function updateSaveButtonState() {
    els.saveBtn.disabled = !els.address.value.trim();
  }

  function placeMarkerAt(lat, lng) {
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng], { icon: createSelectionIcon() }).addTo(map);
    }
    map.panTo([lat, lng]);
  }

  // ---------- 地図タップ：逆ジオコーディングで住所を自動入力 ----------

  function onMapClick(e) {
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    placeMarkerAt(lat, lng);
    els.searchResults.innerHTML = '';

    reverseGeocode(lat, lng)
      .then(function (data) {
        var address = data && data.display_name ? data.display_name : '';
        if (address) {
          els.address.value = address; // .value での設定なので input イベントは発火しない
          if (!els.name.value) {
            els.name.value = address.split(',')[0];
          }
        }
        confirmedLocation = { lat: lat, lng: lng };
        updateSaveButtonState();
      })
      .catch(function () {
        alert('住所の自動取得に失敗しました。お手数ですが住所欄をご確認・ご入力ください。');
      });
  }

  // ---------- 検索：選ぶと住所欄に自動入力 ----------

  function onSearch() {
    var q = els.address.value.trim();
    if (!q) return;

    showSearchLoading(els.searchResults);

    geocodeSearch(q)
      .then(function (data) {
        renderSearchResultsList(els.searchResults, data, function (r) {
          var lat = parseFloat(r.lat);
          var lng = parseFloat(r.lon);

          els.address.value = r.display_name; // .value での設定なので input イベントは発火しない
          confirmedLocation = { lat: lat, lng: lng };
          updateSaveButtonState();

          placeMarkerAt(lat, lng);
          map.setView([lat, lng], 15);
          els.searchResults.innerHTML = '';

          if (!els.name.value) {
            els.name.value = r.display_name.split(',')[0];
          }
        });
      })
      .catch(function () {
        showSearchError(els.searchResults, '検索に失敗しました。時間をおいて再度お試しください。');
      });
  }

  // ---------- 保存 ----------

  function onSave(e) {
    e.preventDefault();

    var name = els.name.value.trim();
    if (!name) return;

    var address = els.address.value.trim();
    if (!address) {
      alert('住所を入力するか、検索結果の選択、地図タップのいずれかで場所を指定してください');
      return;
    }

    var startDate = els.startDate.value;
    var endDate = els.endDate.value;
    if (startDate && endDate && startDate > endDate) {
      alert('終了日は開始日以降の日付にしてください');
      return;
    }

    var url = els.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    if (confirmedLocation) {
      // 検索選択・地図タップ済みで、住所欄も編集されていない → その座標をそのまま使う
      finishSave(name, address, confirmedLocation.lat, confirmedLocation.lng, startDate, endDate, url);
      return;
    }

    // 住所欄が手入力・編集されている → 保存時にその住所から座標を検索する
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = '住所を確認中...';

    geocodeSearch(address)
      .then(function (results) {
        if (!results || results.length === 0) {
          throw new Error('no results');
        }
        var lat = parseFloat(results[0].lat);
        var lng = parseFloat(results[0].lon);
        finishSave(name, address, lat, lng, startDate, endDate, url);
      })
      .catch(function () {
        els.saveBtn.disabled = false;
        els.saveBtn.textContent = 'この場所を保存';
        alert('入力された住所から場所を特定できませんでした。住所を見直すか、検索結果の選択・地図タップをお試しください。');
      });
  }

  function finishSave(name, address, lat, lng, startDate, endDate, url) {
    var place = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      address: address,
      lat: lat,
      lng: lng,
      startDate: startDate, // 空文字の場合あり
      endDate: endDate,     // 空文字の場合あり
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
