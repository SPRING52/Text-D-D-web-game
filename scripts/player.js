// player.js
// Класс игрока. Больше НЕ создаёт собственный экземпляр Engine —
// получает его извне, чтобы работать с тем же состоянием игры,
// которое видит script.js (см. документацию, раздел "Главный баг").

export class Player {
  constructor(engine) {
    this.engine = engine;
    this.name = null;
    this.gold = 40;
    this.inventory = [];
  }

  /**
   * Использовать предмет из инвентаря по его itemID.
   * Сравнение приведено к строкам, так как id кнопки в DOM
   * всегда строка, а itemID в данных может быть числом.
   */
  useItem(itemID) {
    const item = this.inventory.find(
      (i) => String(i.itemID) === String(itemID),
    );

    if (!item) return;

    this.engine.showItemDescription(item.description);
  }
}
