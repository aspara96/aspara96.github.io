/**
 * js/list.js
 * 登録済みスポット一覧の表示・削除・地図ジャンプ制御。
 * 依存: js/storage.js
 */

document.addEventListener('DOMContentLoaded', renderSpotList);

/** スポット一覧を描画する */
function renderSpotList() {
  const container = document.getElementById('spot-list');
  const spots = SpotStorage.getAll();

  if (spots.length === 0) {
    container.innerHTML = '<div class="empty-state">登録済みのスポットはありません</div>';
    return;
  }

  container.innerHTML = '';
  spots.forEach(spot => {
    container.appendChild(buildSpotCard(spot));
  });
}

/** スポットカード要素を生成する */
function buildSpotCard(spot) {
  const card = document.createElement('div');
  card.className = 'spot-card';

  const meta = [spot.category].filter(Boolean).join(' · ');

  card.innerHTML = `
    <div class="spot-card__name">${spot.name}</div>
    ${meta ? `<div class="spot-card__meta">${meta}</div>` : ''}
    ${spot.memo ? `<div class="spot-card__memo">${spot.memo}</div>` : ''}
    <div class="spot-card__actions">
      <button class="btn-view">地図で見る</button>
      <button class="btn-delete">削除</button>
    </div>
  `;

  // 地図で見るボタン
  card.querySelector('.btn-view').addEventListener('click', () => {
    location.href = `index.html#${spot.lat},${spot.lng},15`;
  });

  // 削除ボタン
  card.querySelector('.btn-delete').addEventListener('click', () => {
    if (!confirm(`「${spot.name}」を削除しますか？`)) return;
    SpotStorage.remove(spot.id);
    card.remove();

    // 削除後に空になった場合は空状態を表示
    if (SpotStorage.getAll().length === 0) {
      document.getElementById('spot-list').innerHTML =
        '<div class="empty-state">登録済みのスポットはありません</div>';
    }
  });

  return card;
}
