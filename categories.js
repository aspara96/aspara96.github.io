// categories.js
// カテゴリー設定画面（categories.html）専用の処理です。
// common.js の関数（loadCategories / saveCategories / loadPlaces / savePlaces）に依存しています。

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
        categories[idx] = { id: editingId, icon: icon, name: name };
      }
    } else {
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

    categories.forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'category-item';

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
