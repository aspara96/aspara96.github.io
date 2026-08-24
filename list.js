// list.js
// 登録した場所の一覧画面（list.html）専用の処理です。地図・期間フィルターに関係なく、
// 保存されている場所を常にすべて表示します。
// common.js の関数（loadPlaces / savePlaces / loadCategories / saveCategories など）に依存しています。
//
// バックアップ（JSON書き出し・読み込み）は「行き先（places）」と「カテゴリー（categories）」を
// まとめて1つのファイルに含める形式に対応しています。詳細は onExport() / importBackup() を参照。

(function () {
  'use strict';

  var places = loadPlaces();
  var categories = loadCategories();

  var els = {
    searchQuery: document.getElementById('placeSearchQuery'),
    searchClearBtn: document.getElementById('placeSearchClearBtn'),
    categoryFilter: document.getElementById('categoryFilter'),
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
    populateCategoryFilterOptions();
    updateSearchClearVisibility();
    renderList();
  }

  // カテゴリー一覧を絞り込み用の選択肢として反映する。
  // インポートで新しいカテゴリーが追加された場合にも呼び直せるよう、
  // 既存の動的オプション（先頭の「すべてのカテゴリー」を除く）を一旦クリアしてから再構築する。
  function populateCategoryFilterOptions() {
    while (els.categoryFilter.options.length > 1) {
      els.categoryFilter.remove(1);
    }
    categories.forEach(function (c) {
      var option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.icon + ' ' + c.name;
      els.categoryFilter.appendChild(option);
    });
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

    els.categoryFilter.addEventListener('change', renderList);

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
  //
  // 書き出すJSONの形式（version 2）:
  // {
  //   "app": "itsumap",
  //   "version": 2,
  //   "exportedAt": "2026-08-24T12:34:56.789Z",
  //   "places": [ Place, ... ],
  //   "categories": [ Category, ... ]
  // }
  //
  // 行き先だけでなく、カテゴリー（アイコン・名前）もまとめて共有・復元できるようにするための形式。
  // 旧バージョン（行き先の配列のみを書き出していた形式）で書き出したファイルも、
  // 読み込み側（importBackup）で引き続き読み込める。

  function onExport() {
    if (places.length === 0 && categories.length === 0) {
      alert('書き出せるデータがありません。');
      return;
    }

    var backup = {
      app: 'itsumap',
      version: 2,
      exportedAt: new Date().toISOString(),
      places: places,
      categories: loadCategories(), // 念のためエクスポート時点の最新の内容を読み直す
    };

    var json = JSON.stringify(backup, null, 2);
    var filename = 'itsumap-backup-' + formatDate(new Date()).replace(/-/g, '') + '.json';

    // iOSなど対応環境では共有シート（AirDrop・メッセージ・メールなど）から直接送れるようにする
    try {
      var file = new File([json], filename, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'いつマップ バックアップ',
          text: '「いつマップ」の行き先・カテゴリーのデータです。',
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
      importBackup(data);
    };
    reader.onerror = function () {
      alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  }

  // data の形式を判定し、行き先・カテゴリーそれぞれの取り込み処理を呼び出す。
  // - 新形式: { places: [...], categories: [...] }（categories は省略されている場合もある）
  // - 旧形式: 行き先の配列そのもの（カテゴリーは含まれない）
  function importBackup(data) {
    var importedPlaces;
    var importedCategories = [];

    if (Array.isArray(data)) {
      importedPlaces = data; // 旧形式（行き先の配列のみ）
    } else if (data && typeof data === 'object' && Array.isArray(data.places)) {
      importedPlaces = data.places; // 新形式
      if (Array.isArray(data.categories)) {
        importedCategories = data.categories;
      }
    } else {
      alert('ファイルを読み込めませんでした。正しいバックアップファイルか確認してください。');
      return;
    }

    // 先にカテゴリーを取り込む。行き先側の categoryId が、取り込んだ／既存のカテゴリーを
    // 指しているかどうかの判定に使うため。
    var categoryResult = importCategories(importedCategories);
    if (categoryResult.added > 0) {
      populateCategoryFilterOptions();
    }

    var placeResult = importPlacesData(importedPlaces, categoryResult.knownIds);

    renderList();

    var message = placeResult.added + '件の行き先を追加しました。';
    if (categoryResult.added > 0) {
      message += '\nカテゴリーを' + categoryResult.added + '件追加しました。';
    }

    var skippedParts = [];
    if (placeResult.skipped > 0) skippedParts.push('行き先' + placeResult.skipped + '件');
    if (categoryResult.skipped > 0) skippedParts.push('カテゴリー' + categoryResult.skipped + '件');
    if (skippedParts.length > 0) {
      message += '\n（' + skippedParts.join('、') + 'は無効なデータ、または登録済みのためスキップしました）';
    }

    alert(message);
  }

  function isValidImportedCategory(c) {
    return !!(c && typeof c === 'object' &&
      typeof c.id === 'string' && c.id &&
      typeof c.icon === 'string' && c.icon.trim() &&
      typeof c.name === 'string' && c.name.trim());
  }

  // 既に同じIDのカテゴリーが登録済みの場合はスキップ（ローカル側の内容を優先）し、
  // それ以外は追加する。戻り値の knownIds には「取り込み後に存在するカテゴリーIDの集合」
  // （= 元々あったもの＋今回追加したもの）を含め、行き先側の categoryId 復元に使う。
  function importCategories(importedCategories) {
    var knownIds = {};
    categories.forEach(function (c) { knownIds[c.id] = true; });

    var added = 0;
    var skipped = 0;

    importedCategories.forEach(function (item) {
      if (!isValidImportedCategory(item)) {
        skipped++;
        return;
      }
      if (knownIds[item.id]) {
        skipped++;
        return;
      }

      categories.push({ id: item.id, icon: item.icon, name: item.name });
      knownIds[item.id] = true;
      added++;
    });

    if (added > 0) {
      saveCategories(categories);
    }

    return { added: added, skipped: skipped, knownIds: knownIds };
  }

  function isValidImportedPlace(p) {
    return !!(p && typeof p === 'object' &&
      typeof p.name === 'string' && p.name.trim() &&
      typeof p.lat === 'number' && typeof p.lng === 'number');
  }

  // 既に同じIDの行き先が登録済みの場合はスキップし、それ以外は追加する
  // （自分のバックアップの再読み込みでは重複せず、他の人からの共有では追加される）。
  // categoryId は、knownCategoryIds（取り込み後に存在するカテゴリーIDの集合）に
  // 含まれている場合のみ引き継ぎ、それ以外（該当カテゴリーが手元にない場合）は未設定にする。
  function importPlacesData(importedPlaces, knownCategoryIds) {
    var existingIds = {};
    places.forEach(function (p) { existingIds[p.id] = true; });

    var added = 0;
    var skipped = 0;

    importedPlaces.forEach(function (item) {
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

      var categoryId = (typeof item.categoryId === 'string' && item.categoryId && knownCategoryIds[item.categoryId])
        ? item.categoryId
        : '';

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
        categoryId: categoryId,
      });
      existingIds[id] = true;
      added++;
    });

    if (added > 0) {
      savePlaces(places);
    }

    return { added: added, skipped: skipped };
  }

  // ---------- 検索・並び替え ----------

  function updateSearchClearVisibility() {
    els.searchClearBtn.hidden = !els.searchQuery.value;
  }

  // 名前・住所・メモを対象に大文字小文字を区別せず部分一致で絞り込む。
  // カテゴリーが選択されている場合は、そのカテゴリーの行き先のみに絞り込む。
  function getFilteredPlaces() {
    var query = els.searchQuery.value.trim().toLowerCase();
    var categoryId = els.categoryFilter.value;

    return places.filter(function (p) {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (!query) return true;
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

      var category = findCategoryById(categories, p.categoryId);
      var iconEl = document.createElement('span');
      iconEl.className = 'place-category-icon';
      if (category) {
        iconEl.textContent = category.icon;
      } else {
        iconEl.setAttribute('aria-hidden', 'true'); // 見た目の位置揃え用の空欄なので読み上げ対象外にする
      }
      li.appendChild(iconEl);

      var infoEl = document.createElement('div');
      infoEl.className = 'place-info';

      var nameEl = document.createElement('span');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      infoEl.appendChild(nameEl);

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
      viewBtn.textContent = '地図';
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
