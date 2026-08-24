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
//
// アイコン入力欄（#categoryIcon）は以下の3点を満たすよう独自に制御している。
// 1. 未入力のまま送信したときの標準エラーメッセージを「アイコンを入力してください」にする
// 2. 入力を1文字（絵文字などの合成文字も含めて「見た目の1文字＝書記素クラスタ」単位）に制限する
// 3. 半角の数字・アルファベット・カタカナを全角に自動変換する（濁点・半濁点の合成も行う）

(function () {
  'use strict';

  var categories = loadCategories();
  var editingId = null; // 編集中のカテゴリーID（null なら新規追加モード）
  var isComposingIcon = false; // IME変換中は値の書き換えを行わないためのフラグ

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

    // IME（日本語入力）での変換中に値を書き換えると変換が壊れてしまうため、
    // 変換確定後（compositionend）にのみ正規化・文字数制限をかける。
    // 変換を伴わない通常の入力・貼り付けは input イベントでその都度処理する。
    els.icon.addEventListener('compositionstart', function () {
      isComposingIcon = true;
    });
    els.icon.addEventListener('compositionend', function () {
      isComposingIcon = false;
      applyIconInputRules();
    });
    els.icon.addEventListener('input', function () {
      if (isComposingIcon) return;
      applyIconInputRules();
    });

    // 未入力のまま送信したときの標準メッセージを差し替える
    els.icon.addEventListener('invalid', function () {
      if (els.icon.validity.valueMissing) {
        els.icon.setCustomValidity('アイコンを入力してください');
      } else {
        els.icon.setCustomValidity('');
      }
    });
  }

  // ---------- アイコン入力欄の正規化（全角変換・1文字制限） ----------

  // 半角カタカナ（記号類含む） → 全角カタカナ・記号 の対応表
  var HALF_TO_FULL_KANA = {
    '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
    'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ﾝ': 'ン',
    'ﾞ': '゛', 'ﾟ': '゜',
  };

  // 濁点（ﾞ）が続いた場合に1文字へ合成する（例: "ｶ"+"ﾞ" → "ガ"）
  var DAKUTEN_MAP = {
    'ｶ': 'ガ', 'ｷ': 'ギ', 'ｸ': 'グ', 'ｹ': 'ゲ', 'ｺ': 'ゴ',
    'ｻ': 'ザ', 'ｼ': 'ジ', 'ｽ': 'ズ', 'ｾ': 'ゼ', 'ｿ': 'ゾ',
    'ﾀ': 'ダ', 'ﾁ': 'ヂ', 'ﾂ': 'ヅ', 'ﾃ': 'デ', 'ﾄ': 'ド',
    'ﾊ': 'バ', 'ﾋ': 'ビ', 'ﾌ': 'ブ', 'ﾍ': 'ベ', 'ﾎ': 'ボ',
    'ｳ': 'ヴ',
  };

  // 半濁点（ﾟ）が続いた場合に1文字へ合成する（例: "ﾊ"+"ﾟ" → "パ"）
  var HANDAKUTEN_MAP = {
    'ﾊ': 'パ', 'ﾋ': 'ピ', 'ﾌ': 'プ', 'ﾍ': 'ペ', 'ﾎ': 'ポ',
  };

  // 半角の数字・英字・カタカナ（濁点・半濁点の合成含む）を全角に変換する
  function toFullWidth(value) {
    var chars = Array.from(value); // コードポイント単位で分解（サロゲートペアも1要素として扱う）
    var result = [];

    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var next = chars[i + 1];

      if (next === 'ﾞ' && DAKUTEN_MAP[ch]) {
        result.push(DAKUTEN_MAP[ch]);
        i++; // 濁点の分を読み飛ばす
        continue;
      }
      if (next === 'ﾟ' && HANDAKUTEN_MAP[ch]) {
        result.push(HANDAKUTEN_MAP[ch]);
        i++; // 半濁点の分を読み飛ばす
        continue;
      }
      if (HALF_TO_FULL_KANA[ch]) {
        result.push(HALF_TO_FULL_KANA[ch]);
        continue;
      }

      var code = ch.length === 1 ? ch.charCodeAt(0) : 0;
      // 半角数字(0-9)・半角英字(A-Z, a-z) はUnicode上での対応する全角形へ一律オフセットで変換できる
      if ((code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
        result.push(String.fromCharCode(code + 0xFEE0));
      } else {
        result.push(ch);
      }
    }

    return result.join('');
  }

  // 見た目の1文字（書記素クラスタ）単位に分割する。絵文字の肌色修飾や国旗などの
  // 合成絵文字も可能な限り正しく1文字として扱うため、対応環境では Intl.Segmenter を使う。
  // 非対応環境ではコードポイント単位（Array.from）にフォールバックする。
  function splitIntoGraphemes(value) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      var segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(segmenter.segment(value), function (s) { return s.segment; });
    }
    return Array.from(value);
  }

  // 全角変換 → 1文字への切り詰め、の順で適用する（先に全角変換しないと、
  // "ｶ"+"ﾞ" のような2文字構成の半角カタカナが濁点を失ったまま切り詰められてしまうため）
  function applyIconInputRules() {
    var converted = toFullWidth(els.icon.value);
    var graphemes = splitIntoGraphemes(converted);
    var limited = graphemes.length > 1 ? graphemes[0] : converted;

    if (limited !== els.icon.value) {
      els.icon.value = limited;
    }
    els.icon.setCustomValidity('');
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
    applyIconInputRules(); // 過去に登録された（現行ルールより長い）アイコンも表示上正規化しておく
    els.name.value = category.name;
    els.saveBtn.textContent = '更新';
    els.cancelBtn.hidden = false;
    els.icon.focus();
  }

  function exitEditMode() {
    editingId = null;
    els.form.reset();
    els.icon.setCustomValidity('');
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
