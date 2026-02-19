// 日本中心
const map = L.map('map').setView([36.2048, 138.2529], 5);

// 地図レイヤー
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

// 保存データ
let places = JSON.parse(localStorage.getItem("places") || "[]");

// 既存マーカー表示
places.forEach(createMarker);

// タップ登録
map.on('click', function(e) {
    const name = prompt("場所名を入力");
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

// 検索
document.getElementById("searchBtn").onclick = searchPlace;

async function searchPlace() {
    const keyword = document.getElementById("searchBox").value;
    if (!keyword) return;

    const url =
      "https://nominatim.openstreetmap.org/search?format=json&q=" +
      encodeURIComponent(keyword);

    const res = await fetch(url);
    const data = await res.json();

    if (data.length === 0) {
        alert("見つかりません");
        return;
    }

    const p = data[0];
    const place = {
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lon),
        name: p.display_name
    };

    map.setView([place.lat, place.lng], 16);

    places.push(place);
    savePlaces();
    createMarker(place);
}

// 現在地
document.getElementById("locBtn").onclick = () => {
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 15);
    });
};

// 全削除
document.getElementById("clearBtn").onclick = () => {
    if (!confirm("すべて削除しますか？")) return;
    localStorage.removeItem("places");
    location.reload();
};

// マーカー作成
function createMarker(data) {
    L.marker([data.lat, data.lng])
        .addTo(map)
        .bindPopup(data.name);
}

// 保存
function savePlaces() {
    localStorage.setItem("places", JSON.stringify(places));
}