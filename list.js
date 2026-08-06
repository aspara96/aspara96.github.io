// list.js
// 登録した場所の一覧画面（list.html）専用の処理です。地図・期間フィルターに関係なく、
// 保存されている場所を常にすべて表示します。
// common.js の関数（loadPlaces / savePlaces / renderPeriodStub など）に依存しています。

(function () {
  'use strict';

  var places = loadPlaces();

  var els = {
    placeList: document.getElementById('placeList'),
    placeCount: document.getElementById('placeCount'),
    clearAllBtn: document.getElementById('clearAllBtn'),
  };

  init();

  function init() {
    bindEvents();
    renderList();
  }

  function bindEvents() {
    els.clearAllBtn.addEventListener('click', function () {
      if (places.length === 0) return;
      if (confirm('保存されている場所を全て削除します。よろしいですか？')) {
        places = [];
        savePlaces(places);
        renderList();
      }
    });
  }

  function deletePlace(id) {
    places = places.filter(function (p) { return p.id !== id; });
    savePlaces(places);
    renderList();
  }

  function renderList() {
    els.placeCount.textContent = '(' + places.length + ')';
    els.placeList.innerHTML = '';

    if (places.length === 0) {
      var emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'まだ場所が保存されていません。右下の + から追加できます';
      els.placeList.appendChild(emptyLi);
      return;
    }

    var sorted = places.slice().sort(function (a, b) {
      return a.startDate.localeCompare(b.startDate);
    });

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

      // 左側: 場所の情報
      var stubMain = document.createElement('div');
      stubMain.className = 'stub-main';

      var nameEl = document.createElement('div');
      nameEl.className = 'place-name';
      nameEl.textContent = p.name;
      stubMain.appendChild(nameEl);

      if (p.memo) {
        var memoEl = document.createElement('div');
        memoEl.className = 'place-memo';
        memoEl.textContent = p.memo;
        stubMain.appendChild(memoEl);
      }

      if (p.url) {
        var linkEl = document.createElement('a');
        linkEl.className = 'place-link';
        linkEl.href = p.url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.textContent = '🔗 参考リンク';
        linkEl.addEventListener('click', function (e) { e.stopPropagation(); });
        stubMain.appendChild(linkEl);
      }

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

      stubMain.appendChild(actions);

      // 右側: チケット風の期間スタブ
      var stubSide = document.createElement('div');
      stubSide.className = 'stub-side';

      var dateEl = document.createElement('div');
      dateEl.className = 'stub-date';
      renderPeriodStub(dateEl, p);
      stubSide.appendChild(dateEl);

      li.appendChild(stubMain);
      li.appendChild(stubSide);
      els.placeList.appendChild(li);
    });
  }
})();
