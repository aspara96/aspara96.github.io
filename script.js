// ============================
// 初期設定
// ============================

// 日本中心
const map = L.map('map', {
    zoomControl: false
}).setView([36.2048, 138.2529], 5);

// 地図レイヤー
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

// 保存データ
let places = JSON.parse(localStorage.getItem("places") || "[]");

// マーカー管理配列
let markers = [];

// ============================
// 起動時表示
// ============================

places.forEach(createMarker);

// ============================
// 地図タップ登録
// ============================

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

// ============================
// 検索機能（GitHub公開対応）
// ============================

document.getElementById("searchBtn").addEventListener("click", searchPlace);

async function searchPlace() {
    const keyword = document.getElementById("searchBox").value.trim();
    if (!keyword) return;

    try {
        const url =
          "https://nominatim.openstreetmap.org/search" +
          "?format=jsonv2&limit=1&countrycodes=jp&accept-language=ja" +
          "&q=" + encodeURIComponent(keyword);

        const res = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" }
        });

        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
            alert("見つかりませんでした");
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

    } catch (e) {
        alert("検索エラー。時間をおいて再試行してください。");
        console.error(e);
    }
}

// ============================
// 現在地表示
// ============================

document.getElementById("locBtn").addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("位置情報が使えません");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 15);
        },
        () => {
            alert("位置情報を取得できませんでした");
        }
    );
});

// ============================
// 全削除
// ============================

document.getElementById("clearBtn").addEventListener("click", () => {
    if (!confirm("すべて削除しますか？")) return;

    localStorage.removeItem("places");
    places = [];

    markers.forEach(m => map.removeLayer(m));
    markers = [];
});

// ============================
// マーカー作成
// ============================

function createMarker(data) {
    const marker = L.marker([data.lat, data.lng])
        .addTo(map)
        .bindPopup(data.name);

    markers.push(marker);
}

// ============================
// 保存処理
// ============================

function savePlaces() {
    localStorage.setItem("places", JSON.stringify(places));
}