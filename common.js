// common.js
// index.html / add.html / list.html / detail.html すべてから読み込む共通処理です。
// 保存データの読み書き、日付処理、地図ピンのアイコン生成、地名検索(Nominatim)などをまとめています。

var STORAGE_KEY = 'ikitai_places_v1';

// ---------- 保存データ ----------

function loadPlaces() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('読み込みエラー', e);
    return [];
  }
}

function savePlaces(places) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
    return true;
  } catch (e) {
    console.error('保存エラー', e);
    return false;
  }
}

// ---------- 日付・期間 ----------

function formatDate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function formatDateShort(isoDate) {
  var parts = isoDate.split('-');
  return parts[0] + '/' + parts[1] + '/' + parts[2];
}

// place に期間が設定されているかどうか
function hasPeriod(place) {
  return !!(place.startDate && place.endDate);
}

// dateStr が place の期間内かどうか。期間が設定されていない場所は常に対象になる。
function isActiveOn(place, dateStr) {
  if (!hasPeriod(place)) return true;
  return place.startDate <= dateStr && dateStr <= place.endDate;
}

// 一覧・詳細で使う「期間」の表示用ラベル
function formatPeriodLabel(place) {
  if (!hasPeriod(place)) return '期限なし';
  return formatDateShort(place.startDate) + ' 〜 ' + formatDateShort(place.endDate);
}

// チケット風スタブ(右側の日付表示)の中身を組み立てる
function renderPeriodStub(el, place) {
  if (hasPeriod(place)) {
    el.innerHTML =
      formatDateShort(place.startDate) +
      '<div class="to">〜</div>' +
      formatDateShort(place.endDate);
  } else {
    el.innerHTML = '<div class="no-period">期限<br>なし</div>';
  }
}

// ---------- 地図ピン ----------

// 保存済みの場所用ピン（涙型・紺色×金縁）
function createPlaceIcon() {
  return L.divIcon({
    className: 'place-marker',
    html: '<div class="place-marker-inner"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22],
  });
}

// 追加画面で選択中の座標を示すピン（金色の丸）
function createSelectionIcon() {
  return L.divIcon({
    className: 'selection-marker',
    html: '<div class="selection-marker-inner"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// ---------- 地名検索 (OpenStreetMap Nominatim) ----------

function geocodeSearch(query) {
  var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ja&q=' + encodeURIComponent(query);
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('geocode request failed');
    return res.json();
  });
}

function showSearchLoading(resultsEl) {
  resultsEl.innerHTML = '';
  var li = document.createElement('li');
  li.className = 'search-loading';
  li.textContent = '検索中...';
  resultsEl.appendChild(li);
}

function showSearchError(resultsEl, message) {
  resultsEl.innerHTML = '';
  var li = document.createElement('li');
  li.className = 'search-error';
  li.textContent = message;
  resultsEl.appendChild(li);
}

// results: Nominatim の検索結果配列 / onSelect(result) はクリックされた項目を受け取るコールバック
function renderSearchResultsList(resultsEl, results, onSelect) {
  resultsEl.innerHTML = '';

  if (!results || results.length === 0) {
    var emptyLi = document.createElement('li');
    emptyLi.className = 'search-empty';
    emptyLi.textContent = '見つかりませんでした';
    resultsEl.appendChild(emptyLi);
    return;
  }

  results.forEach(function (r) {
    var li = document.createElement('li');
    li.textContent = r.display_name;
    li.addEventListener('click', function () {
      onSelect(r);
    });
    resultsEl.appendChild(li);
  });
}
