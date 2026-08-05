// common.js
// 一覧画面(index.html)と追加画面(add.html)の両方から読み込む共通処理です。
// 保存データの読み書きや日付処理、地図ピンのアイコン生成などをまとめています。

var STORAGE_KEY = 'ikitai_places_v1';

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

function isActiveOn(place, dateStr) {
  return place.startDate <= dateStr && dateStr <= place.endDate;
}

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
