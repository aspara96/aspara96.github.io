// ============================
// 初期設定
// ============================

// 地図初期化（日本中心）
const map = L.map('map', {
    zoomControl: false
}).setView([36.2048, 138.2529], 5);

// 地図レイヤー
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

// 保存データ
let places = JSON.parse(localStorage.getItem("places") || "[]");

// マーカー管理
let markers = [];

// ============================
// 起動時表示
// ============================

// 保存済みマーカー表示
places.forEach(createMarker);

// 一覧ページから戻ってきたときのフォーカス表示
const focus = JSON.parse(localStorage.getItem("focusPlace") || "null");
if (focus) {
    map.setView([focus.lat, focus.lng], 16);
    localStorage.removeItem("focusPlace");
}

// ============================
// 地図タップで登録
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

const searchBtn = document.getElementById("searchBtn");
if (searchBtn) {
    searchBtn.addEventListener("click", searchPlace);
}

async function searchPlace() {
    const box = document.getElementById("searchBox");
    if (!box) return;

    const keyword = box.value.trim();
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
            alert("見つかりませんでした（表記を変えて再検索してみてください）");
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
        alert("検索でエラーが発生しました。時間をおいて再試行してください。");
        console.error(e);
    }
}

// ============================
// 現在地表示
// ============================

const locBtn = document.getElementById("locBtn");
if (locBtn) {
    locBtn.addEventListener("click", () => {
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
}

// ============================
// 全削除
// ============================

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (!confirm("すべて削除しますか？")) return;

        localStorage.removeItem("places");
        places = [];

        markers.forEach(m => map.removeLayer(m));
        markers = [];
    });
}

// ============================
// 一覧ページへ移動（ボタンがある場合）
// ============================

const listBtn = document.getElementById("listBtn");
if (listBtn) {
    listBtn.addEventListener("click", () => {
        location.href = "list.html";
    });
}

// ============================
// マーカー生成
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