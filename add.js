// add.js
// 行き先の登録・編集画面（add.html）専用の処理です。
// URLに ?id={id} が付いている場合は「編集モード」として動作し、既存の行き先を
// 上書き保存します（詳細画面の「編集」ボタンから遷移してくる想定）。
// パラメータがない場合は通常の「新規登録モード」です。
//
// 場所の指定は「住所」欄への入力を正としつつ、検索結果の選択や地図タップでも
// 住所欄を自動入力できるようにしています。
// 住所からの座標検索には common.js の addressSearch（国土地理院→Nominatimの順で検索）を
// 使用しており、検索結果の選択を経なくても、入力した住所だけで自動的にピンが立ちます。

(function () {
  'use strict';

  // 住所欄の内容と紐づいた「確定済みの座標」。検索結果の選択・地図タップ・住所からの
  // 自動解決で設定され、住所欄がユーザーによって手入力・編集されると null に戻る。
  var confirmedLocation = null; // { lat, lng }

  var map = null;
  var marker = null;

  var isEditMode = false;
  var editingId = null;

  var els = {
    form: document.getElementById('placeForm'),
    pageTitle: document.getElementById('pageTitle'),
    backBtn: document.getElementById('backBtn'),
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

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (id) {
      var place = loadPlaces().find(function (p) { return p.id === id; });
      if (place) {
        enterEditMode(place);
      }
    }

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

    // 住所欄から離れたタイミングで、検索結果を選ばなくても自動的にピンを立てる
    els.address.addEventListener('blur', onAddressBlur);
  }

  // ---------- 編集モードへの切り替え ----------

  function enterEditMode(place) {
    isEditMode = true;
    editingId = place.id;

    els.pageTitle.textContent = '行き先を編集';
    document.title = '行き先を編集 | 行きたい場所マップ';
    els.saveBtn.textContent = getSaveLabel();

    // 編集画面からの「戻る」は詳細画面に戻す。history.pushState ではなく replace を使うことで、
    // 「詳細→編集→詳細」という往復が履歴に余計な1件として残らないようにする
    // （残ると、詳細画面で戻るボタンを押したときに編集画面へ戻ってしまう）。
    var backUrl = 'detail.html?id=' + encodeURIComponent(place.id);
    els.backBtn.href = backUrl;
    els.backBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.replace(backUrl);
    });

    els.name.value = place.name || '';
    els.address.value = place.address || '';
    els.url.value = place.url || '';
    els.startDate.value = place.startDate || '';
    els.endDate.value = place.endDate || '';
    els.memo.value = place.memo || '';

    // 既存の座標はそのまま確定済みとして扱う（住所欄を編集しない限り再検索しない）
    confirmedLocation = { lat: place.lat, lng: place.lng };
    placeMarkerAt(place.lat, place.lng);
    map.setView([place.lat, place.lng], 15);
  }

  function getSaveLabel() {
    return isEditMode ? '更新' : '登録';
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

  // 住所文字列から座標を解決する（国土地理院→Nominatimの順で検索、common.jsのaddressSearchを利用）
  function resolveAddressLocation(address) {
    return addressSearch(address).then(function (results) {
      if (!results || results.length === 0) {
        throw new Error('no results');
      }
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    });
  }

  // ---------- 住所欄から手を離したら、自動的に座標を解決してピンを立てる ----------

  function onAddressBlur() {
    var address = els.address.value.trim();
    if (!address || confirmedLocation) return; // 空欄、または既に確定済みなら何もしない

    resolveAddressLocation(address)
      .then(function (loc) {
        // 解決している間に住所欄が編集された場合は、その結果を反映しない
        if (els.address.value.trim() !== address) return;
        confirmedLocation = loc;
        placeMarkerAt(loc.lat, loc.lng);
        map.setView([loc.lat, loc.lng], 15);
        updateSaveButtonState();
      })
      .catch(function () {
        // ここでは失敗を通知しない（保存時に改めて案内する）
      });
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

    addressSearch(q)
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
      // 検索選択・地図タップ・住所の自動解決済みで、住所欄も編集されていない → その座標をそのまま使う
      finishSave(name, address, confirmedLocation.lat, confirmedLocation.lng, startDate, endDate, url);
      return;
    }

    // まだ座標が確定していない（自動解決前に保存が押された等）→ ここで住所から座標を検索する
    els.saveBtn.disabled = true;
    els.saveBtn.textContent = '住所を確認中...';

    resolveAddressLocation(address)
      .then(function (loc) {
        finishSave(name, address, loc.lat, loc.lng, startDate, endDate, url);
      })
      .catch(function () {
        els.saveBtn.disabled = false;
        els.saveBtn.textContent = getSaveLabel();
        alert('入力された住所から場所を特定できませんでした。住所を見直すか、検索結果の選択・地図タップをお試しください。');
      });
  }

  function finishSave(name, address, lat, lng, startDate, endDate, url) {
    var memo = els.memo.value.trim();
    var places = loadPlaces();

    if (isEditMode) {
      var idx = places.findIndex(function (p) { return p.id === editingId; });
      var updatedPlace = {
        id: editingId,
        name: name,
        address: address,
        lat: lat,
        lng: lng,
        startDate: startDate, // 空文字の場合あり
        endDate: endDate,     // 空文字の場合あり
        memo: memo,
        url: url,
      };

      if (idx !== -1) {
        places[idx] = updatedPlace;
      } else {
        // 万一元のデータが見つからない場合（他タブで削除された等）は新規として追加する
        places.push(updatedPlace);
      }
      savePlaces(places);

      // 更新後は詳細画面に戻る（replace により編集画面を履歴に残さない。理由は enterEditMode 内のコメント参照）
      window.location.replace('detail.html?id=' + encodeURIComponent(editingId));
      return;
    }

    places.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      address: address,
      lat: lat,
      lng: lng,
      startDate: startDate, // 空文字の場合あり
      endDate: endDate,     // 空文字の場合あり
      memo: memo,
      url: url,
    });
    savePlaces(places);

    // 新規登録後は一覧画面に戻る
    window.location.href = 'index.html';
  }
})();
