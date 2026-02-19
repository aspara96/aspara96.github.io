const listEl = document.getElementById("list");

let places = JSON.parse(localStorage.getItem("places") || "[]");

render();

function render() {
    listEl.innerHTML = "";

    if (places.length === 0) {
        listEl.innerHTML = "<p>登録はまだありません</p>";
        return;
    }

    places.forEach((p, index) => {
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="buttons">
                <button class="view" onclick="viewOnMap(${p.lat}, ${p.lng})">地図で見る</button>
                <button class="delete" onclick="removePlace(${index})">削除</button>
            </div>
        `;

        listEl.appendChild(card);
    });
}

function removePlace(index) {
    if (!confirm("削除しますか？")) return;

    places.splice(index, 1);
    localStorage.setItem("places", JSON.stringify(places));
    render();
}

function viewOnMap(lat, lng) {
    localStorage.setItem("focusPlace", JSON.stringify({lat, lng}));
    location.href = "index.html";
}

function goMap() {
    location.href = "index.html";
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#039;"
    }[m]));
}