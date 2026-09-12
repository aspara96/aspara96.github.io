// index.js
// 一覧画面（地図＋その場所リスト）専用の処理です。
// common.js の関数に依存しています。

(function () {
  'use strict';

  var places = loadPlaces();
  var categories = loadCategories();
  var dateFilteredPlaces = []; // 期間の条件に一致する場所（地図上のピン全体）
  var map = null;
  var markersLayer = null;

  var els = {
    mapSearchQuery: document.getElementById('mapSearchQuery'),
    mapSearchBtn: document.getElementById('mapSearchBtn'),
    mapSearchClearBtn: document.getElementById('mapSearchClearBtn'),
    mapSearchResults: document.getElementById('mapSearchResults'),
    viewDate: document.getElementById('viewDate'),
    todayBtn: document.getElementById('todayBtn'),
    clearDateBtn: document.getElementById('clearDateBtn'),
    categoryFilter: document.getElementById('categoryFilter'),
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
  };

  init();

  function init() {
    initMap();
    bindEvents();
    populateCategoryFilterOptions();
    updateMapSearchClearVisibility();
    refreshMarkersForDateFilter(true); // 初回表示時のみ、全ピンが収まるように表示範囲を合わせる
    handleFocusParam();
  }

  // カテゴリー一覧を絞り込み用の選択肢として反映する。
  // 「未設定」はどのカテゴリーにも属さない特別な選択肢のため、一覧の最後に追加する。
  function populateCategoryFilterOptions() {
    categories.forEach(function (c) {
      var option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.icon + ' ' + c.name;
      els.categoryFilter.appendChild(option);
    });

    var unsetOption = document.createElement('option');
    unsetOption.value = UNSET_CATEGORY_FILTER_VALUE;
    unsetOption.textContent = '未設定';
    els.categoryFilter.appendChild(unsetOption);
  }

  function initMap() {
    map = L.map('map').setView([35.681236, 139.767125], 5); // 初期中心地: 東京

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // ピンの密集対策: 近接するピンは自動的にクラスター（数字入りの丸）にまとめる。
    // maxClusterRadius はかなり小さめ（15px）にしており、ピン同士がほぼ重なる距離に
    // ある場合のみクラスター化する（軽く近い程度では個々のピンのまま表示する）。
    // 独自の見た目（createClusterIcon）を使うため MarkerCluster.Default.css は読み込んでいない
    // （MarkerCluster.css のみ。スパイダーファイ時のアニメーション・脚線に必要）。
    markersLayer = L.markerClusterGroup({
      maxClusterRadius: 15,
      showCoverageOnHover: false, // タップ操作前提のため、ホバー時の範囲表示は不要
      iconCreateFunction: createClusterIcon,
    }).addTo(map);

    // 地図の表示範囲が変わるたび、下部のリストを再計算する
    map.on('moveend', updateVisibleList);
  }

  // クラスターアイコンの見た目。
  // サイズは「件数の桁数」に応じて最低限だけ大きくする（1桁なら基準サイズ、桁が
  // 1つ増えるごとに、その数字が収まる分だけ一定量ずつ拡大する。10件と40件のように
  // 桁数が同じ場合はサイズを変えない）。
  // 色は個々のピンと同じ考え方で、クラスターに含まれる場所の期限状態から決める
  // （優先順位: 1ヶ月以内に終了するものが1件でもあれば赤 > 期限切れのものしかなければ黒 > それ以外は青）。
  function createClusterIcon(cluster) {
    var referenceDate = getReferenceDate();
    var markers = cluster.getAllChildMarkers();

    var hasEndingSoon = false;
    var allPastDeadline = true;
    markers.forEach(function (m) {
      var place = m.placeData;
      if (!place) return;
      if (isEndingSoon(place, referenceDate)) hasEndingSoon = true;
      if (!isPastDeadline(place)) allPastDeadline = false;
    });

    var colorClass;
    if (hasEndingSoon) {
      colorClass = 'cluster-red';
    } else if (allPastDeadline) {
      colorClass = 'cluster-black';
    } else {
      colorClass = 'cluster-blue';
    }

    var count = cluster.getChildCount();
    var digits = String(count).length;
    // 1桁を基準（28px・12px）とし、桁が1つ増えるごとに最低限（6px・1px）だけ拡大する
    var size = 28 + (digits - 1) * 6;
    var fontSize = 12 + (digits - 1) * 1;

    return L.divIcon({
      html: '<div class="place-cluster-inner ' + colorClass + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + fontSize + 'px;">' + count + '</div>',
      className: 'place-cluster',
      iconSize: [size, size],
    });
  }

  function bindEvents() {
    els.mapSearchBtn.addEventListener('click', onMapSearch);
    els.mapSearchQuery.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onMapSearch();
      }
    });
    els.mapSearchQuery.addEventListener('input', updateMapSearchClearVisibility);

    els.mapSearchClearBtn.addEventListener('click', function () {
      els.mapSearchQuery.value = '';
      els.mapSearchResults.innerHTML = ''; // 検索結果も閉じる
      updateMapSearchClearVisibility();
      els.mapSearchQuery.focus();
    });

    // 日付の変更では、現在の地図の表示範囲（パン・ズーム）を維持する
    els.viewDate.addEventListener('change', function () {
      refreshMarkersForDateFilter(false);
    });

    els.todayBtn.addEventListener('click', function () {
      els.viewDate.value = formatDate(new Date());
      refreshMarkersForDateFilter(false);
    });

    els.clearDateBtn.addEventListener('click', function () {
      els.viewDate.value = '';
      refreshMarkersForDateFilter(false);
    });

    els.categoryFilter.addEventListener('change', function () {
      refreshMarkersForDateFilter(false);
    });
  }

  // ---------- 地図上を移動するための検索（場所の登録は行わない） ----------

  function updateMapSearchClearVisibility() {
    els.mapSearchClearBtn.hidden = !els.mapSearchQuery.value;
  }

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
          updateMapSearchClearVisibility();
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

  // ピンの色分け・「あと1ヶ月」判定の基準日。表示基準日が未指定の場合は今日を使う。
  function getReferenceDate() {
    return getViewDate() || formatDate(new Date());
  }

  // 期間の条件に合わせてピンを張り直す（日付変更・今日・すべて・カテゴリー・追加・削除のたびに呼ぶ）
  // 期限が設定されていない場所や、開始日/終了日の片方のみ設定された場所も isActiveOn の
  // ルールに従って表示・非表示が決まる。
  // fitBoundsToResults に true を渡した場合のみ、表示範囲をピンに合わせて調整する
  // （初回表示時のみ true にし、日付・カテゴリーの変更時は現在の表示範囲を維持する）。
  function refreshMarkersForDateFilter(fitBoundsToResults) {
    var viewDate = getViewDate();
    var referenceDate = getReferenceDate();
    var categoryId = els.categoryFilter.value;

    dateFilteredPlaces = places.filter(function (p) {
      if (!matchesCategoryFilter(categoryId, p.categoryId)) return false;
      return viewDate ? isActiveOn(p, viewDate) : true;
    });

    markersLayer.clearLayers();
    dateFilteredPlaces.forEach(function (p) {
      var colorClass = getPinColorClass(p, referenceDate);
      var marker = L.marker([p.lat, p.lng], { icon: createPlaceIcon(colorClass) }).addTo(markersLayer);
      marker.placeData = p; // クラスターアイコンの色分け判定に使う（createClusterIcon参照）
      marker.bindPopup(buildPopupContent(p));
    });

    if (fitBoundsToResults && dateFilteredPlaces.length > 0) {
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

    return wrap;
  }

  function deletePlace(id) {
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces(places);
    refreshMarkersForDateFilter(true);
  }

  // ---------- 地図の表示範囲に応じた下部リストの更新 ----------

  function updateVisibleList() {
    var bounds = map.getBounds();
    var visible = dateFilteredPlaces.filter(function (p) {
      return bounds.contains(L.latLng(p.lat, p.lng));
    });

    renderPlaceList(visible);
  }

  function renderPlaceList(visiblePlaces) {
    els.placeCount.textContent = '(' + visiblePlaces.length + ')';
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      var noneLi = document.createElement('li');
      noneLi.className = 'empty-state';
      noneLi.textContent = 'まだ場所が保存されていません。右下の + から追加できます。';
      els.placeList.appendChild(noneLi);
      return;
    }

    if (visiblePlaces.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'この範囲に表示できる場所がありません。地図を動かすか、期間の指定を見直してください。';
      els.placeList.appendChild(emptyLi);
      return;
    }

    var sorted = visiblePlaces.slice().sort(comparePlaces);

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

      var category = findCategoryById(categories, p.categoryId);
      var iconEl = document.createElement('span');
      iconEl.className = 'place-category-icon';
      if (category) {
        iconEl.textContent = category.icon;
      } else {
        iconEl.setAttribute('aria-hidden', 'true'); // 見た目の位置揃え用の空欄なので読み上げ対象外にする
      }
      li.appendChild(iconEl);

      var infoEl = document.createElement('div');
      infoEl.className = 'place-info';

      var nameEl = document.createElement('span');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      infoEl.appendChild(nameEl);

      var periodEl = document.createElement('span');
      periodEl.className = 'place-period';
      periodEl.textContent = formatPeriodLabel(p);
      infoEl.appendChild(periodEl);

      li.appendChild(infoEl);

      var actions = document.createElement('div');
      actions.className = 'place-actions';

      var focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.className = 'focus-btn';
      focusBtn.textContent = '地図';
      focusBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        focusOnMarkerAt(p.lat, p.lng);
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

      li.appendChild(actions);
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
    refreshMarkersForDateFilter(false); // 直後に focusOnMarkerAt 内で setView するため、ここでの表示範囲調整は不要

    focusOnMarkerAt(target.lat, target.lng);

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', 'index.html');
    }
  }

  // 指定した座標に対応するマーカーを探す（クラスター内にまとめられていても見つかる。
  // マーカー自体は常に markersLayer に保持されており、クラスターは表示上の見せ方でしかないため）。
  function findMarkerAt(lat, lng) {
    var found = null;
    markersLayer.eachLayer(function (m) {
      var ll = m.getLatLng();
      if (Math.abs(ll.lat - lat) < 1e-6 && Math.abs(ll.lng - lng) < 1e-6) {
        found = m;
      }
    });
    return found;
  }

  // 指定した座標のマーカーへズームし、ポップアップを開く。
  // 対象が現在クラスターにまとめられている場合は zoomToShowLayer が必要な分だけ
  // 自動的にズームイン（またはスパイダーファイ）してからコールバックを呼ぶため、
  // クラスター化されていても確実にポップアップを開ける。
  function focusOnMarkerAt(lat, lng) {
    var marker = findMarkerAt(lat, lng);
    if (!marker) return;

    map.setView([lat, lng], 15);
    markersLayer.zoomToShowLayer(marker, function () {
      marker.openPopup();
    });
  }
})();
