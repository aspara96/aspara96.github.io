// ============================
// 初期設定
// ============================

const map = L.map('map', { zoomControl: false })
  .setView([36.2048, 138.2529], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

let places = JSON.parse(localStorage.getItem("places") || "[]");
let markers = [];

// ============================
// 起動時表示
// ============================

places.forEach(createMarker);

const focus = JSON.parse(localStorage.getItem("focusPlace") || "null");
if (focus) {
    map.setView([focus.lat, focus.lng], 16);
    localStorage.removeItem("focusPlace");
}

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
// 検索UI
// ============================

const searchBtn = document.getElementById("searchBtn");
if (searchBtn) searchBtn.addEventListener("click", searchPlace);

const resultPanel = document.getElementById("resultPanel");
const resultList = document.getElementById("resultList");
const closeResult = document.getElementById("closeResult");

if (closeResult) {
    closeResult.onclick = () => resultPanel.classList.add("hidden");
}

// ============================
// 検索（複数候補表示）
// ============================

async function searchPlace() {
    const box = document.getElementById("searchBox");
    if (!box) return;

    const keyword = box.value.trim();
    if (!keyword) return;

    try {
        const url =
          "https://nominatim.openstreetmap.org/search" +
          "?format=jsonv2&limit=5&countrycodes=jp&accept-language=ja" +
          "&q=" + encodeURIComponent(keyword);

        const res = await fetch(url);
        const data = await res.json();

        if (!data || data.length === 0) {
            alert("見つかりませんでした");
            return;
        }

        showResults(data);

    } catch (e) {
        alert("検索エラー");
        console.error(e);
    }
}

// ============================
// 候補表示
// ============================

function showResults(list) {
    resultList.innerHTML = "";

    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.textContent = item.display_name;

        div.onclick = () => selectPlace(item);

        resultList.appendChild(div);
    });

    resultPanel.classList.remove("hidden");
}

// ============================
// 候補選択 → 地図表示 → 登録確認
// ============================

function selectPlace(item) {
    resultPanel.classList.add("hidden");

    const place = {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name
    };

    map.setView([place.lat, place.lng], 16);

    const previewMarker = L.marker([place.lat, place.lng])
        .addTo(map)
        .bindPopup(`<b>${escapeHtml(place.name)}</b>`)
        .openPopup();

    setTimeout(() => {
        const ok = confirm("この場所を登録しますか？");

        map.removeLayer(previewMarker);

        if (!ok) return;

        places.push(place);
        savePlaces();
        createMarker(place);

    }, 300);
}

// ============================
// 現在地
// ============================

const locBtn = document.getElementById("locBtn");
if (locBtn) {
    locBtn.onclick = () => {
        navigator.geolocation.getCurrentPosition(pos => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 15);
        });
    };
}

// ============================
// 全削除
// ============================

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
    clearBtn.onclick = () => {
        if (!confirm("すべて削除しますか？")) return;

        localStorage.removeItem("places");
        places = [];

        markers.forEach(m => map.removeLayer(m));
        markers = [];
    };
}

// ============================
// 一覧へ
// ============================

const listBtn = document.getElementById("listBtn");
if (listBtn) listBtn.onclick = () => location.href = "list.html";

// ============================
// マーカー生成（長押し削除）
// ============================

function createMarker(data) {
    const marker = L.marker([data.lat, data.lng]).addTo(map);

    marker.bindPopup(`${escapeHtml(data.name)}<br><small>長押しで削除</small>`);

    let timer = null;

    marker.on("mousedown touchstart", () => {
        timer = setTimeout(() => {
            if (!confirm("削除しますか？")) return;

            map.removeLayer(marker);

            places = places.filter(p =>
                !(p.lat === data.lat && p.lng === data.lng && p.name === data.name)
            );

            savePlaces();
        }, 700);
    });

    marker.on("mouseup mouseleave touchend", () => clearTimeout(timer));

    markers.push(marker);
}

// ============================
// 保存
// ============================

function savePlaces() {
    localStorage.setItem("places", JSON.stringify(places));
}

// ============================
// HTMLエスケープ
// ============================

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
    }[m]));
}