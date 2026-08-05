/**

- js/map.js
- 地図表示・検索・スポット登録の制御。
- 依存: Leaflet, js/storage.js
  */

/* ===========================
定数・状態
=========================== */
const NOMINATIM_URL = ‘https://nominatim.openstreetmap.org/search’;
const DEFAULT_CENTER = [35.6812, 139.7671]; // 東京
const DEFAULT_ZOOM = 13;

let map;
let pendingLatLng = null; // 登録待ちの座標
const markerMap = {};    // { spotId: L.Marker }

/* ===========================
初期化
=========================== */
document.addEventListener(‘DOMContentLoaded’, () => {
initMap();
renderSavedMarkers();
bindEvents();
});

/** Leaflet 地図を初期化する */
function initMap() {
map = L.map(‘map’).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.tileLayer(‘https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png’, {
attribution: ‘© OpenStreetMap contributors’
}).addTo(map);

// 地図クリック → 登録モーダルを開く
map.on(‘click’, (e) => {
openRegisterModal(e.latlng);
});
}

/** 保存済みスポットのマーカーをすべて地図に描画する */
function renderSavedMarkers() {
SpotStorage.getAll().forEach(addMarkerForSpot);
}

/* ===========================
イベントバインド
=========================== */
function bindEvents() {
// 検索
document.getElementById(‘search-btn’).addEventListener(‘click’, handleSearch);
document.getElementById(‘search-input’).addEventListener(‘keydown’, (e) => {
if (e.key === ‘Enter’) handleSearch();
});

// 検索結果を閉じる
document.getElementById(‘close-results-btn’).addEventListener(‘click’, () => {
hideElement(‘search-results’);
});

// 一覧ページへ
document.getElementById(‘list-btn’).addEventListener(‘click’, () => {
location.href = ‘list.html’;
});

// 現在地
document.getElementById(‘locate-btn’).addEventListener(‘click’, handleLocate);

// 全削除
document.getElementById(‘clear-btn’).addEventListener(‘click’, handleClearAll);

// モーダル：キャンセル
document.getElementById(‘register-cancel-btn’).addEventListener(‘click’, closeRegisterModal);

// モーダル：登録
document.getElementById(‘register-save-btn’).addEventListener(‘click’, handleSaveSpot);
}

/* ===========================
検索
=========================== */
async function handleSearch() {
const query = document.getElementById(‘search-input’).value.trim();
if (!query) return;

try {
const res = await fetch(
`${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=10&accept-language=ja`
);
const results = await res.json();
renderSearchResults(results);
} catch {
alert(‘検索に失敗しました。’);
}
}

/** 検索結果をパネルに描画する */
function renderSearchResults(results) {
const listEl = document.getElementById(‘results-list’);
listEl.innerHTML = ‘’;

if (results.length === 0) {
listEl.innerHTML = ‘<p style="padding:12px;color:#888;">結果が見つかりませんでした</p>’;
} else {
results.forEach(item => {
const el = document.createElement(‘div’);
el.className = ‘result-item’;
el.textContent = item.display_name;
el.addEventListener(‘click’, () => {
const latlng = L.latLng(parseFloat(item.lat), parseFloat(item.lon));
map.setView(latlng, 15);
hideElement(‘search-results’);
openRegisterModal(latlng);
});
listEl.appendChild(el);
});
}

showElement(‘search-results’);
}

/* ===========================
現在地
=========================== */
function handleLocate() {
if (!navigator.geolocation) {
alert(‘このブラウザは位置情報に対応していません。’);
return;
}
navigator.geolocation.getCurrentPosition(
(pos) => {
const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
map.setView(latlng, 15);
},
() => alert(‘位置情報の取得に失敗しました。’)
);
}

/* ===========================
全削除
=========================== */
function handleClearAll() {
if (!confirm(‘登録済みのスポットをすべて削除しますか？’)) return;
SpotStorage.clear();
Object.values(markerMap).forEach(marker => marker.remove());
Object.keys(markerMap).forEach(key => delete markerMap[key]);
}

/* ===========================
スポット登録モーダル
=========================== */

/** モーダルを開く（座標を記憶しておく） */
function openRegisterModal(latlng) {
pendingLatLng = latlng;
document.getElementById(‘spot-name’).value = ‘’;
document.getElementById(‘spot-category’).value = ‘’;
document.getElementById(‘spot-memo’).value = ‘’;
showElement(‘register-modal’);
}

/** モーダルを閉じる */
function closeRegisterModal() {
pendingLatLng = null;
hideElement(‘register-modal’);
}

/** スポットを保存してマーカーを追加する */
function handleSaveSpot() {
const name = document.getElementById(‘spot-name’).value.trim();
if (!name) {
alert(‘スポット名を入力してください。’);
return;
}

const spot = {
id: Date.now().toString(),
name,
category: document.getElementById(‘spot-category’).value,
memo: document.getElementById(‘spot-memo’).value.trim(),
lat: pendingLatLng.lat,
lng: pendingLatLng.lng,
};

SpotStorage.add(spot);
addMarkerForSpot(spot);
closeRegisterModal();
}

/* ===========================
マーカー
=========================== */

/** スポットオブジェクトに基づいてマーカーを地図に追加する */
function addMarkerForSpot(spot) {
const marker = L.marker([spot.lat, spot.lng])
.addTo(map)
.bindPopup(buildPopupContent(spot));

markerMap[spot.id] = marker;
}

/** ポップアップの HTML を生成する */
function buildPopupContent(spot) {
const categoryBadge = spot.category
? `<span style="font-size:12px;color:#888;">${spot.category}</span><br>`
: ‘’;
const memo = spot.memo
? `<p style="margin:4px 0 0;font-size:13px;">${spot.memo}</p>`
: ‘’;
return `<div style="min-width:140px"> <strong>${spot.name}</strong><br> ${categoryBadge} ${memo} </div>`;
}

/* ===========================
ユーティリティ
=========================== */
function showElement(id) {
document.getElementById(id).classList.remove(‘hidden’);
}

function hideElement(id) {
document.getElementById(id).classList.add(‘hidden’);
}
