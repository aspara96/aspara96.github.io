// 日本中心
const map = L.map('map').setView([36.2048, 138.2529], 5);

// 地図表示
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

// 保存データ取得
let places = JSON.parse(localStorage.getItem("places") || "[]");

// 既存マーカー表示
places.forEach(p => {
    createMarker(p);
});

// クリックで登録
map.on('click', function(e) {
    const name = prompt("場所の名前を入力");
    if (!name) return;

    const data = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        name: name
    };

    places.push(data);
    savePlaces();
    createMarker(data);
});

// マーカー生成関数
function createMarker(data) {
    L.marker([data.lat, data.lng])
        .addTo(map)
        .bindPopup(data.name);
}

// 保存関数
function savePlaces() {
    localStorage.setItem("places", JSON.stringify(places));
}
