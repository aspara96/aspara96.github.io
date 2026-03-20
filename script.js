const map = L.map('map').setView([36.2048, 138.2529], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
}).addTo(map);

let places = JSON.parse(localStorage.getItem("places") || "[]");
let markers = [];
let tempPlace = null;

// 初期表示
places.forEach(createMarker);

// 地図クリック
map.on('click', function(e) {
    tempPlace = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        name: "新規地点"
    };
    openModal();
});

// 検索
document.getElementById("searchBtn").onclick = async () => {
    const keyword = document.getElementById("searchBox").value;
    if (!keyword) return;

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(keyword)}`;
    const res = await fetch(url);
    const data = await res.json();

    showResults(data);
};

// 結果表示
function showResults(list) {
    const panel = document.getElementById("resultPanel");
    const listEl = document.getElementById("resultList");

    listEl.innerHTML = "";

    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.textContent = item.display_name;

        div.onclick = () => selectPlace(item);

        listEl.appendChild(div);
    });

    panel.classList.remove("hidden");
}

document.getElementById("closeResult").onclick = () => {
    document.getElementById("resultPanel").classList.add("hidden");
};

// 選択
function selectPlace(item) {
    document.getElementById("resultPanel").classList.add("hidden");

    tempPlace = {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name
    };

    map.setView([tempPlace.lat, tempPlace.lng], 16);
    openModal();
}

// モーダル
function openModal() {
    const today = new Date().toISOString().split("T")[0];

    document.getElementById("customName").value = "";
    document.getElementById("startDate").value = today;
    document.getElementById("endDate").value = "";
    document.getElementById("category").value = "食事";
    document.getElementById("memo").value = "";

    document.getElementById("registerModal").classList.remove("hidden");
}

document.getElementById("cancelPlaceBtn").onclick = closeModal;

function closeModal() {
    document.getElementById("registerModal").classList.add("hidden");
    tempPlace = null;
}

// 登録
document.getElementById("savePlaceBtn").onclick = () => {
    if (!tempPlace) return;

    const place = {
        ...tempPlace,
        customName: document.getElementById("customName").value || tempPlace.name,
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        category: document.getElementById("category").value,
        memo: document.getElementById("memo").value
    };

    places.push(place);
    savePlaces();
    createMarker(place);

    closeModal();
};

// マーカー
function createMarker(data) {
    const marker = L.marker([data.lat, data.lng]).addTo(map);

    marker.bindPopup(`
      <b>${data.customName}</b><br>
      ${data.category}<br>
      ${data.startDate} ${data.endDate ? "〜 " + data.endDate : ""}<br>
      <small>${data.memo}</small>
    `);

    markers.push(marker);
}

// 保存
function savePlaces() {
    localStorage.setItem("places", JSON.stringify(places));
}

// その他ボタン
document.getElementById("clearBtn").onclick = () => {
    if (!confirm("全削除しますか？")) return;
    localStorage.removeItem("places");
    location.reload();
};

document.getElementById("listBtn").onclick = () => {
    location.href = "list.html";
};

document.getElementById("locBtn").onclick = () => {
    navigator.geolocation.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    });
};