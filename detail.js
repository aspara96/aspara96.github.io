// detail.js
// 場所の詳細画面（detail.html）専用の処理です。
// common.js の関数（loadPlaces / savePlaces / formatPeriodLabel / hasPeriod）に依存しています。
// URL の ?id=... で対象の場所を特定します。

(function () {
  'use strict';

  var els = {
    backBtn: document.getElementById('backBtn'),
    body: document.getElementById('detailBody'),
  };

  init();

  function init() {
    bindEvents();
    render();
  }

  function bindEvents() {
    // 直前の画面（一覧や地図）に戻れる場合はブラウザ履歴で戻る。
    // 直接このページを開いた場合などは href の index.html にフォールバックする。
    els.backBtn.addEventListener('click', function (e) {
      if (window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    });
  }

  function getRequestedId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function render() {
    var id = getRequestedId();
    var places = loadPlaces();
    var place = places.find(function (p) { return p.id === id; });

    els.body.innerHTML = '';

    if (!place) {
      els.body.appendChild(buildMissingView());
      return;
    }

    els.body.appendChild(buildDetailCard(place, places));
  }

  function buildMissingView() {
    var wrap = document.createElement('div');
    wrap.className = 'detail-missing';

    var msg = document.createElement('p');
    msg.textContent = 'この場所は見つかりませんでした。削除された可能性があります。';
    wrap.appendChild(msg);

    var link = document.createElement('a');
    link.href = 'list.html';
    link.className = 'focus-btn';
    link.textContent = '一覧に戻る';
    wrap.appendChild(link);

    return wrap;
  }

  function buildDetailCard(place, allPlaces) {
    var card = document.createElement('div');
    card.className = 'detail-card';

    var nameEl = document.createElement('div');
    nameEl.className = 'detail-name';
    nameEl.textContent = place.name;
    card.appendChild(nameEl);

    var periodEl = document.createElement('div');
    periodEl.className = 'detail-period' + (hasPeriod(place) ? '' : ' no-period-badge');
    periodEl.textContent = hasPeriod(place) ? formatPeriodLabel(place) : '期限なし（いつでも表示）';
    card.appendChild(periodEl);

    if (place.address) {
      card.appendChild(buildTextRow('住所', place.address));
    }

    if (place.memo) {
      card.appendChild(buildTextRow('メモ', place.memo));
    }

    if (place.url) {
      card.appendChild(buildLinkRow('参考URL', place.url));
    }

    var actions = document.createElement('div');
    actions.className = 'detail-actions';

    var mapLink = document.createElement('a');
    mapLink.className = 'focus-btn';
    mapLink.href = 'index.html?focus=' + encodeURIComponent(place.id);
    mapLink.textContent = '地図で見る';
    actions.appendChild(mapLink);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'delete-btn';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', function () {
      if (confirm('「' + place.name + '」を削除しますか？')) {
        var updated = allPlaces.filter(function (p) { return p.id !== place.id; });
        savePlaces(updated);
        window.location.href = 'index.html';
      }
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
  }

  function buildTextRow(label, value) {
    var row = document.createElement('div');
    row.className = 'detail-row';

    var labelEl = document.createElement('div');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    var valueEl = document.createElement('div');
    valueEl.className = 'detail-value';
    valueEl.textContent = value;
    row.appendChild(valueEl);

    return row;
  }

  function buildLinkRow(label, url) {
    var row = document.createElement('div');
    row.className = 'detail-row';

    var labelEl = document.createElement('div');
    labelEl.className = 'detail-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    var valueEl = document.createElement('div');
    valueEl.className = 'detail-value';

    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = url;
    valueEl.appendChild(a);

    row.appendChild(valueEl);
    return row;
  }
})();
