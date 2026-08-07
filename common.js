// common.js
// index.html / add.html / list.html / detail.html すべてから読み込む共通処理です。
// 保存データの読み書き、日付・期間の判定、地図ピンのアイコン生成、地名検索(Nominatim)などをまとめています。

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

// ---------- 日付 ----------

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

// dateStr (YYYY-MM-DD) に n ヶ月加算した日付文字列を返す
function addMonths(dateStr, n) {
  var parts = dateStr.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  var date = new Date(y, m, d);
  date.setMonth(date.getMonth() + n);
  return formatDate(date);
}

// ---------- 期間の判定 ----------
// 場所は「開始日と終了日の両方」「どちらか一方」「どちらも設定しない（期限なし）」のいずれかで登録できる。

// 期間に関する情報が何かしら設定されているか（両方なしの場合のみ false）
function hasPeriod(place) {
  return !!(place.startDate || place.endDate);
}

// dateStr が place の表示対象期間に含まれるかどうか
function isActiveOn(place, dateStr) {
  var hasStart = !!place.startDate;
  var hasEnd = !!place.endDate;

  if (!hasStart && !hasEnd) return true; // 期限なし → 常に対象
  if (hasStart && hasEnd) return place.startDate <= dateStr && dateStr <= place.endDate;
  if (hasStart) return dateStr >= place.startDate; // 開始日のみ → 開始日以降ずっと対象
  return dateStr <= place.endDate; // 終了日のみ → 終了日以前はずっと対象
}

// 一覧・詳細で使う「期間」の表示用ラベル
function formatPeriodLabel(place) {
  var hasStart = !!place.startDate;
  var hasEnd = !!place.endDate;

  if (!hasStart && !hasEnd) return '期限なし';
  if (hasStart && hasEnd) return formatDateShort(place.startDate) + ' 〜 ' + formatDateShort(place.endDate);
  if (hasStart) return formatDateShort(place.startDate) + ' から';
  return formatDateShort(place.endDate) + ' まで';
}

// チケット風スタブ(右側の日付表示)の中身を組み立てる
function renderPeriodStub(el, place) {
  var hasStart = !!place.startDate;
  var hasEnd = !!place.endDate;

  if (!hasStart && !hasEnd) {
    el.innerHTML = '<div class="no-period">期限<br>なし</div>';
    return;
  }
  if (hasStart && hasEnd) {
    el.innerHTML =
      formatDateShort(place.startDate) +
      '<div class="to">〜</div>' +
      formatDateShort(place.endDate);
    return;
  }
  if (hasStart) {
    el.innerHTML = formatDateShort(place.startDate) + '<div class="to">から</div>';
    return;
  }
  el.innerHTML = formatDateShort(place.endDate) + '<div class="to">まで</div>';
}

// 終了日が referenceDate から1ヶ月先までの間に含まれるかどうか（地図ピンの色分けに使用）
function isEndingSoon(place, referenceDate) {
  if (!place.endDate) return false;
  var rangeEnd = addMonths(referenceDate, 1);
  return place.endDate >= referenceDate && place.endDate <= rangeEnd;
}

// ---------- 地図ピン ----------

// 保存済みの場所用ピン（涙型）。urgent が true なら赤、false なら青。
function createPlaceIcon(urgent) {
  var colorClass = urgent ? 'marker-red' : 'marker-blue';
  return L.divIcon({
    className: 'place-marker',
    html: '<div class="place-marker-inner ' + colorClass + '"></div>',
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
