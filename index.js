// index.js
// 一覧画面（地図＋保存した場所リスト）専用の処理です。
// common.js の関数（loadPlaces / savePlaces / formatDate など）に依存しています。

(function () {
  'use strict';

  var places = loadPlaces();
  var map = null;
  var markersLayer = null;

  var els = {
    viewDate: document.getElementById('viewDate'),
    todayBtn: document.getElementById('todayBtn'),
    mapNote: document.getElementById('mapNote'),
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
    clearAllBtn: document.getElementById('clearAllBtn'),
  };

  init();

  function init() {
    els.viewDate.value = formatDate(new Date());
    initMap();
    bindEvents();
    renderPlaceList();
    renderMapMarkers();
  }

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5); // 初期中心地: 東京

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  }

  function bindEvents() {
    els.viewDate.addEventListener('change', function () {
      renderMapMarkers();
      renderPlaceList();
    });

    els.todayBtn.addEventListener('click', function () {
      els.viewDate.value = formatDate(new Date());
      renderMapMarkers();
      renderPlaceList();
    });

    els.clearAllBtn.addEventListener('click', function () {
      if (places.length === 0) return;
      if (confirm('保存されている場所を全て削除します。よろしいですか？')) {
        places = [];
        savePlaces(places);
        renderPlaceList();
        renderMapMarkers();
      }
    });
  }

  function getViewDate() {
    return els.viewDate.value || formatDate(new Date());
  }

  function deletePlace(id) {
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces(places);
    renderPlaceList();
    renderMapMarkers();
  }

  // ---------- 地図の表示 ----------

  function renderMapMarkers() {
    markersLayer.clearLayers();
    var viewDate = getViewDate();
    var activePlaces = places.filter(function (p) { return isActiveOn(p, viewDate); });

    activePlaces.forEach(function (p) {
      var marker = L.marker([p.lat, p.lng], { icon: createPlaceIcon() }).addTo(markersLayer);
      marker.bindPopup(buildPopupContent(p));
    });

    if (activePlaces.length > 0) {
      var bounds = L.latLngBounds(activePlaces.map(function (p) { return [p.lat, p.lng]; }));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 12 });
    }

    if (places.length === 0) {
      els.mapNote.textContent = '保存された場所はまだありません';
    } else {
      els.mapNote.textContent = viewDate + ' 時点で表示中: ' + activePlaces.length + ' / ' + places.length + ' 件';
    }
  }

  function buildPopupContent(p) {
    var wrap = document.createElement('div');

    var nameEl = document.createElement('span');
    nameEl.className = 'popup-place-name';
    nameEl.textContent = p.name;
    wrap.appendChild(nameEl);

    var datesEl = document.createElement('span');
    datesEl.className = 'popup-place-dates';
    datesEl.textContent = p.startDate + ' 〜 ' + p.endDate;
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

  // ---------- リストの表示 ----------

  function renderPlaceList() {
    var viewDate = getViewDate();
    els.placeCount.textContent = '(' + places.length + ')';
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'まだ場所が保存されていません。右下の + から追加できます';
      els.placeList.appendChild(emptyLi);
      return;
    }

    var sorted = places.slice().sort(function (a, b) {
      return a.startDate.localeCompare(b.startDate);
    });

    sorted.forEach(function (p) {
      var active = isActiveOn(p, viewDate);

      var li = document.createElement('li');
      li.className = 'place-item ' + (active ? 'active' : 'inactive');

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
        stubMain.appendChild(linkEl);
      }

      var actions = document.createElement('div');
      actions.className = 'place-actions';

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = active ? '表示中' : '期間外';
      actions.appendChild(badge);

      var focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'focus-btn';
      focusBtn.textContent = '地図で見る';
      focusBtn.addEventListener('click', function () {
        map.setView([p.lat, p.lng], 14);
        var mapEl = document.getElementById('map');
        if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (active) {
          markersLayer.eachLayer(function (m) {
            var ll = m.getLatLng();
            if (Math.abs(ll.lat - p.lat) < 1e-6 && Math.abs(ll.lng - p.lng) < 1e-6) {
              m.openPopup();
            }
          });
        }
      });
      actions.appendChild(focusBtn);

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', function () {
        if (confirm('「' + p.name + '」を削除しますか？')) {
          deletePlace(p.id);
        }
      });
      actions.appendChild(delBtn);

      stubMain.appendChild(actions);

      // 右側: チケット風の日付スタブ
      var stubSide = document.createElement('div');
      stubSide.className = 'stub-side';

      var dateEl = document.createElement('div');
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
})();
