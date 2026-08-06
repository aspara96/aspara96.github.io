// index.js
// 一覧画面（地図＋その場所リスト）専用の処理です。
// common.js の関数に依存しています。

(function () {
  'use strict';

  var places = loadPlaces();
  var dateFilteredPlaces = []; // 期間の条件に一致する場所（地図上のピン全体）
  var map = null;
  var markersLayer = null;

  var els = {
    mapSearchQuery: document.getElementById('mapSearchQuery'),
    mapSearchBtn: document.getElementById('mapSearchBtn'),
    mapSearchResults: document.getElementById('mapSearchResults'),
    viewDate: document.getElementById('viewDate'),
    todayBtn: document.getElementById('todayBtn'),
    clearDateBtn: document.getElementById('clearDateBtn'),
    mapNote: document.getElementById('mapNote'),
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
    clearAllBtn: document.getElementById('clearAllBtn'),
  };

  init();

  function init() {
    initMap();
    bindEvents();
    refreshMarkersForDateFilter();
    handleFocusParam();
  }

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5); // 初期中心地: 東京

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // 地図の表示範囲が変わるたび、下部のリストを再計算する
    map.on('moveend', updateVisibleList);
  }

  function bindEvents() {
    els.mapSearchBtn.addEventListener('click', onMapSearch);
    els.mapSearchQuery.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onMapSearch();
      }
    });

    els.viewDate.addEventListener('change', refreshMarkersForDateFilter);

    els.todayBtn.addEventListener('click', function () {
      els.viewDate.value = formatDate(new Date());
      refreshMarkersForDateFilter();
    });

    els.clearDateBtn.addEventListener('click', function () {
      els.viewDate.value = '';
      refreshMarkersForDateFilter();
    });

    els.clearAllBtn.addEventListener('click', function () {
      if (places.length === 0) return;
      if (confirm('保存されている場所を全て削除します。よろしいですか？')) {
        places = [];
        savePlaces(places);
        refreshMarkersForDateFilter();
      }
    });
  }

  // ---------- 地図上を移動するための検索（場所の登録は行わない） ----------

  function onMapSearch() {
    var q = els.mapSearchQuery.value.trim();
    if (!q) return;

    showSearchLoading(els.mapSearchResults);

    geocodeSearch(q)
      .then(function (data) {
        renderSearchResultsList(els.mapSearchResults, data, function (r) {
          var lat = parseFloat(r.lat);
          var lng = parseFloat(r.lon);
          els.mapSearchResults.innerHTML = '';
          els.mapSearchQuery.value = r.display_name.split(',')[0];
          map.setView([lat, lng], 15); // moveend 経由で下部リストも更新される
        });
      })
      .catch(function () {
        showSearchError(els.mapSearchResults, '検索に失敗しました。時間をおいて再度お試しください。');
      });
  }

  // ---------- 期間フィルター ----------

  function getViewDate() {
    return els.viewDate.value; // 空文字 = 期間指定なし（すべて表示）
  }

  // 期間の条件に合わせてピンを張り直す（日付変更・今日・すべて・追加・削除のたびに呼ぶ）
  // 期限が設定されていない場所は、表示基準日に関わらず常に対象になる（isActiveOn 参照）
  function refreshMarkersForDateFilter() {
    var viewDate = getViewDate();

    dateFilteredPlaces = viewDate
      ? places.filter(function (p) { return isActiveOn(p, viewDate); })
      : places.slice();

    markersLayer.clearLayers();
    dateFilteredPlaces.forEach(function (p) {
      var marker = L.marker([p.lat, p.lng], { icon: createPlaceIcon() }).addTo(markersLayer);
      marker.bindPopup(buildPopupContent(p));
    });

    if (dateFilteredPlaces.length > 0) {
      var bounds = L.latLngBounds(dateFilteredPlaces.map(function (p) { return [p.lat, p.lng]; }));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 12 });
    }

    // fitBounds で表示範囲が変わらない場合に備えて明示的にも呼ぶ
    updateVisibleList();
  }

  function buildPopupContent(p) {
    var wrap = document.createElement('div');

    // 場所の名前をタップすると詳細画面に遷移する
    var nameEl = document.createElement('a');
    nameEl.className = 'popup-place-name';
    nameEl.href = 'detail.html?id=' + encodeURIComponent(p.id);
    nameEl.textContent = p.name;
    wrap.appendChild(nameEl);

    var datesEl = document.createElement('span');
    datesEl.className = 'popup-place-dates';
    datesEl.textContent = formatPeriodLabel(p);
    wrap.appendChild(datesEl);

    if (p.memo) {
      var memoEl = document.createElement('span');
      memoEl.className = 'popup-place-memo';
      memoEl.textContent = p.memo;
      wrap.appendChild(memoEl);
    }

    if (p.url) {
      var linkEl = document.createElement('a');
      linkEl.className = 'popup-place-link';
      linkEl.href = p.url;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.textContent = '参考リンクを開く';
      wrap.appendChild(linkEl);
    }

    return wrap;
  }

  function deletePlace(id) {
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces(places);
    refreshMarkersForDateFilter();
  }

  // ---------- 地図の表示範囲に応じた下部リストの更新 ----------

  function updateVisibleList() {
    var bounds = map.getBounds();
    var visible = dateFilteredPlaces.filter(function (p) {
      return bounds.contains(L.latLng(p.lat, p.lng));
    });

    renderPlaceList(visible);

    var viewDate = getViewDate();
    var periodLabel = viewDate ? viewDate : 'すべての期間';

    if (places.length === 0) {
      els.mapNote.textContent = '保存された場所はまだありません';
    } else {
      els.mapNote.textContent = periodLabel + ' ／ この範囲に ' + visible.length + ' 件';
    }
  }

  function renderPlaceList(visiblePlaces) {
    els.placeCount.textContent = '(' + visiblePlaces.length + ')';
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      var noneLi = document.createElement('li');
      noneLi.className = 'empty-state';
      noneLi.textContent = 'まだ場所が保存されていません。右下の + から追加できます';
      els.placeList.appendChild(noneLi);
      return;
    }

    if (visiblePlaces.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'この範囲に表示できる場所がありません。地図を動かすか、期間の指定を見直してください';
      els.placeList.appendChild(emptyLi);
      return;
    }

    var sorted = visiblePlaces.slice().sort(function (a, b) {
      return a.startDate.localeCompare(b.startDate);
    });

    sorted.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'place-item';
      li.tabIndex = 0;

      // アイテム（行）自体をタップ/Enterで詳細画面へ
      var goToDetail = function () {
        window.location.href = 'detail.html?id=' + encodeURIComponent(p.id);
      };
      li.addEventListener('click', goToDetail);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDetail();
        }
      });

      // 左側: 場所の情報
      var stubMain = document.createElement('div');
      stubMain.className = 'stub-main';

      var nameEl = document.createElement('div');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      stubMain.appendChild(nameEl);

      if (p.memo) {
        var memoEl = document.createElement('div');
        memoEl.className = 'place-memo';
        memoEl.textContent = p.memo;
        stubMain.appendChild(memoEl);
      }

      if (p.url) {
        var linkEl = document.createElement('a');
        linkEl.className = 'place-link';
        linkEl.href = p.url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = '🔗 参考リンク';
        linkEl.addEventListener('click', function (e) { e.stopPropagation(); });
        stubMain.appendChild(linkEl);
      }

      var actions = document.createElement('div');
      actions.className = 'place-actions';

      var focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'focus-btn';
      focusBtn.textContent = '地図で見る';
      focusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        map.setView([p.lat, p.lng], 15);
        markersLayer.eachLayer(function (m) {
          var ll = m.getLatLng();
          if (Math.abs(ll.lat - p.lat) < 1e-6 && Math.abs(ll.lng - p.lng) < 1e-6) {
            m.openPopup();
          }
        });
      });
      actions.appendChild(focusBtn);

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('「' + p.name + '」を削除しますか？')) {
          deletePlace(p.id);
        }
      });
      actions.appendChild(delBtn);

      stubMain.appendChild(actions);

      // 右側: チケット風の期間スタブ
      var stubSide = document.createElement('div');
      stubSide.className = 'stub-side';

      var dateEl = document.createElement('div');
      dateEl.className = 'stub-date';
      renderPeriodStub(dateEl, p);
      stubSide.appendChild(dateEl);

      li.appendChild(stubMain);
      li.appendChild(stubSide);
      els.placeList.appendChild(li);
    });
  }

  // list.html / detail.html から「地図で見る」で遷移してきた場合、その場所にフォーカスする
  function handleFocusParam() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('focus');
    if (!id) return;

    var target = places.find(function (p) { return p.id === id; });
    if (!target) return;

    // 期間指定があるとフォーカス対象が表示されない場合があるため、いったん解除する
    els.viewDate.value = '';
    refreshMarkersForDateFilter();

    map.setView([target.lat, target.lng], 15);
    markersLayer.eachLayer(function (m) {
      var ll = m.getLatLng();
      if (Math.abs(ll.lat - target.lat) < 1e-6 && Math.abs(ll.lng - target.lng) < 1e-6) {
        m.openPopup();
      }
    });

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', 'index.html');
    }
  }
})();
