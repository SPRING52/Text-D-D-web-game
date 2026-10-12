// player.js
// Player class. No longer creates its own Engine instance —
// receives it from outside to work with the same game state
// that script.js sees (see documentation, "Main Bug" section).

export class Player {
  constructor(engine) {
    this.engine = engine;
    this.name = null;
    this.gold = 40;
    this.inventory = [];
  }

  /**
   * Use an item from inventory by its itemID.
   * Comparison is converted to strings, since the button id in DOM
   * is always a string, but itemID in data can be a number.
   */
  useItem(itemID) {
    const item = this.inventory.find(
      (i) => String(i.itemID) === String(itemID),
    );

    if (!item) return;

    this.engine.showItemDescription(item.description);
  }
}
