// categories.js
// カテゴリー設定画面（categories.html）専用の処理です。
// common.js の関数（loadCategories / saveCategories / loadPlaces / savePlaces）に依存しています。
//
// カテゴリーの並び順は、この画面の「▲▼」ボタンで並べ替えた配列の順序（= localStorageに
// 保存される配列の順序）がそのまま正となる。専用の「order」フィールドは持たせず、
// 配列内の並び自体を順序として扱う。add.html のカテゴリー選択欄、index.html / list.html の
// カテゴリー絞り込み欄は、いずれも loadCategories() の結果をそのままの順で選択肢に反映して
// いるため、ここで並べ替えて保存すれば、それらの画面を開き直すだけで自動的に反映される
// （それらの画面側の変更は不要）。

(function () {
  'use strict';

  var categories = loadCategories();
  var editingId = null; // 編集中のカテゴリーID（null なら新規追加モード）

  var els = {
    form: document.getElementById('categoryForm'),
    icon: document.getElementById('categoryIcon'),
    name: document.getElementById('categoryName'),
    saveBtn: document.getElementById('categorySaveBtn'),
    cancelBtn: document.getElementById('categoryCancelBtn'),
    list: document.getElementById('categoryList'),
    count: document.getElementById('categoryCount'),
  };

  init();

  function init() {
    bindEvents();
    renderList();
  }

  function bindEvents() {
    els.form.addEventListener('submit', onSave);
    els.cancelBtn.addEventListener('click', exitEditMode);
  }

  // ---------- 追加・編集 ----------

  function onSave(e) {
    e.preventDefault();

    var icon = els.icon.value.trim();
    var name = els.name.value.trim();
    if (!icon || !name) return;

    if (editingId) {
      var idx = categories.findIndex(function (c) { return c.id === editingId; });
      if (idx !== -1) {
        // 既存の並び位置は変えず、内容のみ更新する
        categories[idx] = { id: editingId, icon: icon, name: name };
      }
    } else {
      // 新規追加時は末尾に追加する（＝並び順の最後になる）
      categories.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        icon: icon,
        name: name,
      });
    }

    saveCategories(categories);
    exitEditMode();
    renderList();
  }

  function enterEditMode(category) {
    editingId = category.id;
    els.icon.value = category.icon;
    els.name.value = category.name;
    els.saveBtn.textContent = '更新';
    els.cancelBtn.hidden = false;
    els.icon.focus();
  }

  function exitEditMode() {
    editingId = null;
    els.form.reset();
    els.saveBtn.textContent = '追加';
    els.cancelBtn.hidden = true;
  }

  // ---------- 並び替え ----------

  // direction: -1で1つ上へ、+1で1つ下へ。隣接する要素と配列内の位置を入れ替えるだけの
  // シンプルな実装（先頭/末尾では何もしない）。
  function moveCategory(id, direction) {
    var idx = categories.findIndex(function (c) { return c.id === id; });
    if (idx === -1) return;

    var targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    var tmp = categories[idx];
    categories[idx] = categories[targetIdx];
    categories[targetIdx] = tmp;

    saveCategories(categories);
    renderList();
  }

  // ---------- 削除 ----------

  function deleteCategory(id) {
    var category = categories.filter(function (c) { return c.id === id; })[0];
    if (!category) return;

    var ok = confirm(
      '「' + category.icon + ' ' + category.name + '」を削除しますか？\n' +
      'このカテゴリーを設定している行き先からも、設定が外れます。'
    );
    if (!ok) return;

    categories = categories.filter(function (c) { return c.id !== id; });
    saveCategories(categories);

    // このカテゴリーを使っている行き先からも参照を外す
    var places = loadPlaces();
    var changed = false;
    places.forEach(function (p) {
      if (p.categoryId === id) {
        p.categoryId = '';
        changed = true;
      }
    });
    if (changed) savePlaces(places);

    if (editingId === id) exitEditMode();
    renderList();
  }

  // ---------- 一覧描画 ----------

  function renderList() {
    els.count.textContent = '(' + categories.length + ')';
    els.list.innerHTML = '';

    if (categories.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'まだカテゴリーが登録されていません。';
      els.list.appendChild(emptyLi);
      return;
    }

    categories.forEach(function (c, i) {
      var li = document.createElement('li');
      li.className = 'category-item';

      // 並び替え用の ▲▼ ボタン（先頭は▲を、末尾は▼を無効化する）
      var reorderWrap = document.createElement('div');
      reorderWrap.className = 'category-reorder';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'category-reorder-btn';
      upBtn.textContent = '▲';
      upBtn.setAttribute('aria-label', c.name + 'を上へ移動');
      upBtn.disabled = (i === 0);
      upBtn.addEventListener('click', function () { moveCategory(c.id, -1); });
      reorderWrap.appendChild(upBtn);

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'category-reorder-btn';
      downBtn.textContent = '▼';
      downBtn.setAttribute('aria-label', c.name + 'を下へ移動');
      downBtn.disabled = (i === categories.length - 1);
      downBtn.addEventListener('click', function () { moveCategory(c.id, 1); });
      reorderWrap.appendChild(downBtn);

      li.appendChild(reorderWrap);

      var iconEl = document.createElement('span');
      iconEl.className = 'category-icon';
      iconEl.textContent = c.icon;
      li.appendChild(iconEl);

      var nameEl = document.createElement('span');
      nameEl.className = 'category-name';
      nameEl.textContent = c.name;
      li.appendChild(nameEl);

      var actions = document.createElement('div');
      actions.className = 'place-actions';

      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'focus-btn';
      editBtn.textContent = '編集';
      editBtn.addEventListener('click', function () { enterEditMode(c); });
      actions.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.addEventListener('click', function () { deleteCategory(c.id); });
      actions.appendChild(delBtn);

      li.appendChild(actions);
      els.list.appendChild(li);
    });
  }
})();
