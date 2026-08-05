/**
 * js/storage.js
 * LocalStorage を使ったスポットデータの永続化モジュール。
 * map.js / list.js 両方から利用する。
 */

const SpotStorage = (() => {
  const STORAGE_KEY = 'wantToGoSpots';

  /** 全スポットを取得する */
  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  /** スポットを1件追加する
   * @param {{ id: string, name: string, category: string, memo: string, lat: number, lng: number }} spot
   */
  function add(spot) {
    const spots = getAll();
    spots.push(spot);
    _save(spots);
  }

  /** ID でスポットを1件削除する
   * @param {string} id
   */
  function remove(id) {
    const spots = getAll().filter(s => s.id !== id);
    _save(spots);
  }

  /** 全スポットを削除する */
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** 内部保存処理 */
  function _save(spots) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
  }

  return { getAll, add, remove, clear };
})();
