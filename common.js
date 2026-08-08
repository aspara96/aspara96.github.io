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

// 終了日が referenceDate から1ヶ月先までの間に含まれるかどうか（地図ピンの色分けに使用）
function isEndingSoon(place, referenceDate) {
  if (!place.endDate) return false;
  var rangeEnd = addMonths(referenceDate, 1);
  return place.endDate >= referenceDate && place.endDate <= rangeEnd;
}

// 終了日が「今日」より前かどうか（表示基準日ではなく、実際の今日の日付で判定する）
function isPastDeadline(place) {
  if (!place.endDate) return false;
  return place.endDate < formatDate(new Date());
}

// 地図ピンの色分けクラスを決定する（優先順位: 終了日超過(黒) > 終了日が近い(赤) > それ以外(青)）
function getPinColorClass(place, referenceDate) {
  if (isPastDeadline(place)) return 'marker-black';
  if (isEndingSoon(place, referenceDate)) return 'marker-red';
  return 'marker-blue';
}

// ---------- 地図ピン ----------

// 保存済みの場所用ピン（涙型）。colorClass には getPinColorClass() の戻り値を渡す。
function createPlaceIcon(colorClass) {
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

// 住所文字列から座標を検索する。日本の住所（丁目・番地など）は Nominatim だけでは
// 見つからないことが多いため、まず国土地理院の住所検索APIを試し、
// 結果が得られない場合のみ Nominatim にフォールバックする。
// どちらの結果も { display_name, lat, lon } の形式に揃えて返す。
function addressSearch(query) {
  var gsiUrl = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=' + encodeURIComponent(query);

  return fetch(gsiUrl)
    .then(function (res) {
      if (!res.ok) throw new Error('gsi request failed');
      return res.json();
    })
    .then(function (data) {
      if (Array.isArray(data) && data.length > 0) {
        return data.map(function (item) {
          return {
            display_name: (item.properties && item.properties.title) ? item.properties.title : query,
            lat: item.geometry.coordinates[1],
            lon: item.geometry.coordinates[0],
          };
        });
      }
      return geocodeSearch(query); // 国土地理院で見つからない場合のフォールバック
    })
    .catch(function () {
      return geocodeSearch(query); // 国土地理院API自体が失敗した場合のフォールバック
    });
}

// 緯度経度から住所を取得する（地図タップ時の住所自動入力に使用）
function reverseGeocode(lat, lng) {
  var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=ja&zoom=18';
  return fetch(url).then(function (res) {
    if (!res.ok) throw new Error('reverse geocode request failed');
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
