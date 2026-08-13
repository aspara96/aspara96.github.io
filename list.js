// list.js
// 登録した場所の一覧画面（list.html）専用の処理です。地図・期間フィルターに関係なく、
// 保存されている場所を常にすべて表示します。
// common.js の関数（loadPlaces / savePlaces など）に依存しています。

(function () {
  'use strict';

  var places = loadPlaces();

  var els = {
    searchQuery: document.getElementById('placeSearchQuery'),
    searchClearBtn: document.getElementById('placeSearchClearBtn'),
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    clearAllBtn: document.getElementById('clearAllBtn'),
  };

  init();

  function init() {
    bindEvents();
    updateSearchClearVisibility();
    renderList();
  }

  function bindEvents() {
    els.searchQuery.addEventListener('input', function () {
      updateSearchClearVisibility();
      renderList();
    });

    els.searchClearBtn.addEventListener('click', function () {
      els.searchQuery.value = '';
      updateSearchClearVisibility();
      renderList();
      els.searchQuery.focus();
    });

    els.exportBtn.addEventListener('click', onExport);
    els.importBtn.addEventListener('click', function () {
      els.importFileInput.click();
    });
    els.importFileInput.addEventListener('change', onImportFileSelected);

    els.clearAllBtn.addEventListener('click', function () {
      if (places.length === 0) return;
      if (confirm('保存されている場所を全て削除します。よろしいですか？')) {
        places = [];
        savePlaces(places);
        renderList();
      }
    });
  }

  // ---------- バックアップの書き出し・共有 ----------

  function onExport() {
    if (places.length === 0) {
      alert('書き出せる行き先がありません。');
      return;
    }

    var json = JSON.stringify(places, null, 2);
    var filename = 'itsumap-backup-' + formatDate(new Date()).replace(/-/g, '') + '.json';

    // iOSなど対応環境では共有シート（AirDrop・メッセージ・メールなど）から直接送れるようにする
    try {
      var file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'いつマップ バックアップ',
          text: '「いつマップ」の行き先データです。',
        }).catch(function () {
          // 共有をキャンセルした場合などは何もしない
        });
        return;
      }
    } catch (e) {
      // File共有に対応していない環境ではダウンロードにフォールバックする
    }

    var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- バックアップの読み込み ----------

  function onImportFileSelected(e) {
    var file = e.target.files && e.target.files[0];
    els.importFileInput.value = ''; // 同じファイルを続けて選び直せるようにする
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        alert('ファイルを読み込めませんでした。正しいバックアップファイルか確認してください。');
        return;
      }
      importPlaces(data);
    };
    reader.onerror = function () {
      alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  }

  function isValidImportedPlace(p) {
    return !!(p && typeof p === 'object' &&
      typeof p.name === 'string' && p.name.trim() &&
      typeof p.lat === 'number' && typeof p.lng === 'number');
  }

  // 既に同じIDの行き先が登録済みの場合はスキップし、それ以外は追加する
  // （自分のバックアップの再読み込みでは重複せず、他の人からの共有では追加される）
  function importPlaces(data) {
    if (!Array.isArray(data)) {
      alert('ファイルを読み込めませんでした。正しいバックアップファイルか確認してください。');
      return;
    }

    var existingIds = {};
    places.forEach(function (p) { existingIds[p.id] = true; });

    var added = 0;
    var skipped = 0;

    data.forEach(function (item) {
      if (!isValidImportedPlace(item)) {
        skipped++;
        return;
      }
      if (item.id && existingIds[item.id]) {
        skipped++;
        return;
      }

      var id = (typeof item.id === 'string' && item.id)
        ? item.id
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

      places.push({
        id: id,
        name: item.name,
        address: typeof item.address === 'string' ? item.address : '',
        lat: item.lat,
        lng: item.lng,
        startDate: typeof item.startDate === 'string' ? item.startDate : '',
        endDate: typeof item.endDate === 'string' ? item.endDate : '',
        memo: typeof item.memo === 'string' ? item.memo : '',
        url: typeof item.url === 'string' ? item.url : '',
      });
      existingIds[id] = true;
      added++;
    });

    if (added > 0) {
      savePlaces(places);
    }
    renderList();

    var message = added + '件を追加しました。';
    if (skipped > 0) {
      message += '（' + skipped + '件は無効なデータ、または登録済みのためスキップしました）';
    }
    alert(message);
  }

  // ---------- 検索・並び替え ----------

  function updateSearchClearVisibility() {
    els.searchClearBtn.hidden = !els.searchQuery.value;
  }

  // 名前・住所・メモを対象に大文字小文字を区別せず部分一致で絞り込む
  function getFilteredPlaces() {
    var query = els.searchQuery.value.trim().toLowerCase();
    if (!query) return places.slice();

    return places.filter(function (p) {
      var haystack = [p.name, p.address, p.memo].filter(Boolean).join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  function deletePlace(id) {
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces(places);
    renderList();
  }

  function renderList() {
    var filtered = getFilteredPlaces();
    var sorted = filtered.slice().sort(comparePlaces);

    els.placeCount.textContent = '(' + sorted.length + ')';
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'まだ場所が保存されていません。右下の + から追加できます';
      els.placeList.appendChild(emptyLi);
      return;
    }

    if (sorted.length === 0) {
      var noMatchLi = document.createElement('li');
      noMatchLi.className = 'empty-state';
      noMatchLi.textContent = '検索条件に一致する場所がありません';
      els.placeList.appendChild(noMatchLi);
      return;
    }

    sorted.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'place-item';
      li.tabIndex = 0;

      // アイテム（行）自体をタップ/Enterで詳細画面へ
      var goToDetail = function () {
        window.location.href = 'detail.html?id=' + encodeURIComponent(p.id);
      };
      li.addEventListener('click', goToDetail);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDetail();
        }
      });

      var infoEl = document.createElement('div');
      infoEl.className = 'place-info';

      var nameEl = document.createElement('span');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      infoEl.appendChild(nameEl);

      // 開始日・終了日（期限なしの場合も formatPeriodLabel で表記を統一）
      var periodEl = document.createElement('span');
      periodEl.className = 'place-period';
      periodEl.textContent = formatPeriodLabel(p);
      infoEl.appendChild(periodEl);

      li.appendChild(infoEl);

      var actions = document.createElement('div');
      actions.className = 'place-actions';

      // 地図画面に遷移し、この場所にフォーカスする
      var viewBtn = document.createElement('a');
      viewBtn.className = 'focus-btn';
      viewBtn.href = 'index.html?focus=' + encodeURIComponent(p.id);
      viewBtn.textContent = '地図で見る';
      viewBtn.addEventListener('click', function (e) { e.stopPropagation(); });
      actions.appendChild(viewBtn);

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('「' + p.name + '」を削除しますか？')) {
          deletePlace(p.id);
        }
      });
      actions.appendChild(delBtn);

      li.appendChild(actions);
      els.placeList.appendChild(li);
    });
  }
})();
