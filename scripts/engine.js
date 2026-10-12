// engine.js
// Game engine: loading scenario, printing text, showing choices, handling items.
const TYPING_SPEED_MS = 40;
const textTypeAudio = new Audio("/sounds/text.mp3");

const language = document.documentElement.lang;

/**
 * Loads a JSON file containing the script.
 * Moved to a separate function that handles network errors,
 * so that a failed fetch call doesn't crash the entire module without explanation.
 */
async function loadStoryRU(path = "../scenarioRU.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Script (${path}) could not be loaded: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

async function loadStoryFI(path = "../scenarioFI.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Script (${path}) could not be loaded: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// Script file is loaded once when the module is imported for the first time.
// Thanks to the top-level await feature, everyone who imports the Engine module gets
// ready data — no new requests are made, because ES modules
// are executed once and cached during runtime.
let storyData = null;
if (language === "ru") {
  storyData = await loadStoryRU();
} else {
  storyData = await loadStoryFI();
}

let player = null;

export class Engine {
  constructor(data = storyData) {
    this.story = data.scenes;

    this.currentIndex = data.meta.startScene;
    this.inventory = data.items;

    this.charIndex = 0;
    this.textIndex = 0;

    this.isTyping = false;
    this.isComplete = false;

    this.timeoutId = null;
    this.textMode = "scene";

    // Player to which this engine is attached (needed for checking choice conditions).
    // Set by the init(player) function, not through an external global object.
    this.player = null;

    this.gameplayFieldEl = document.querySelector(".gameplay-field");
    this.textField = document.getElementById("text");
    this.choiceEl = document.getElementById("choices");

    // Attach event handler once so it can be safely
    // removed or added with removeEventListener.
    this._onFieldClick = this.handleTextBoxClick.bind(this);

    // Currently printing text (needed for the skipToEnd function).
    this._currentFullText = "";

    // Action handlers registry. Key is action.type from JSON file,
    // value is a function (action, engine) => void | string (next scene id)
    this.actionHandlers = {
      addItem: (action) => this._addItem(action.item),
      toChoices: (action) => ({
        fromLastText: true,
        overrideNext: action.next,
      }),
      rollDice: (action) => this._rollDice(action),
      spendGold: (action) => this._spendGold(action.value),
      addGold: (action) => this._addGold(action.value),
    };
  }

  /**
   * Initialize the game: set player, attach click handler
   * to the game field and start the first scene.
   */
  init(player) {
    this.player = player;
    // removeEventListener before add — protects from repeated init() calls,
    // so the handler is not created twice.
    this.gameplayFieldEl.removeEventListener("click", this._onFieldClick);
    this.gameplayFieldEl.addEventListener("click", this._onFieldClick);

    this.startScene(this.currentIndex);
  }

  /** Starts the scene's next text printing. */
  startScene(index, { fromLastText = false } = {}) {
    this.textMode = "scene";
    this.currentIndex = index;
    this.isComplete = false;

    const texts = this.story[this.currentIndex].texts;
    this.textIndex = fromLastText ? texts.length - 1 : 0;

    this._type(texts[this.textIndex]);
  }

  /** Shows item description (used by Player.useItem). */
  showItemDescription(description) {
    this.textMode = "item";
    this.isComplete = false;
    if (this.choiceIsShown) {
      this.choiceEl.innerHTML = "";
      this.choiceEl.classList.toggle("hide");
    }
    this._type(description);
  }

  /**
   * Unified function for printing text character by character.
   * Replaces previous overlapping typeCharacter()/typeItemDescription() functions —
   * now the same code handles both scenes and items,
   * and the string is not rebuilt with split() on each iteration.
   */
  _type(fullText) {
    clearTimeout(this.timeoutId);

    this.textField.textContent = "";
    this.charIndex = 0;
    this._currentFullText = this.parseVariables(fullText);
    this.isTyping = true;

    const step = () => {
      textTypeAudio.currentTime = 0;
      textTypeAudio.play();
      if (this.charIndex < this._currentFullText.length) {
        this.textField.textContent +=
          this.parseVariables(fullText)[this.charIndex];
        this.charIndex++;
        this.timeoutId = setTimeout(step, TYPING_SPEED_MS);
      } else {
        this._finishTyping();
      }
    };

    step();
  }

  /** Handling text printing completion. */
  _finishTyping() {
    this.isTyping = false;
    this.isComplete = true;

    const isLastTextInScene =
      this.textMode === "scene" &&
      this.textIndex === this.story[this.currentIndex].texts.length - 1;

    if (isLastTextInScene) {
      this.showChoices(this.story[this.currentIndex].choices);
    }
  }

  /** Click on game field: either scroll text forward or move to next point. */
  handleTextBoxClick() {
    if (this.isTyping) {
      this.skipToEnd();
      return;
    }

    // If item description is open, return to current scene.
    if (this.textMode === "item") {
      this.startScene(this.currentIndex);
      return;
    }

    const currentTexts = this.story[this.currentIndex].texts;

    if (this.textIndex < currentTexts.length - 1) {
      this.textIndex++;
      this._type(this.story[this.currentIndex].texts[this.textIndex]);
    } else if (!this.choiceIsShown) {
      this.showChoices(this.story[this.currentIndex].choices);
    }
  }

  /** Prints the current text in full immediately. */
  skipToEnd() {
    clearTimeout(this.timeoutId);

    this.textField.textContent = this._currentFullText;
    this.charIndex = this._currentFullText.length;

    this._finishTyping();
  }

  /** Draws the available choice buttons in the current scene. */
  showChoices(choices) {
    this.choiceEl.innerHTML = "";
    this.choiceIsShown = true;
    this.choiceEl.classList.remove("hide");

    let hasVisibleChoice = false;

    choices.forEach((choice) => {
      if (!this.checkCondition(choice.condition)) return;

      hasVisibleChoice = true;

      const btn = document.createElement("button");
      btn.classList.add("choice-btn");
      btn.textContent = choice.label;

      btn.addEventListener("click", (event) => {
        event.stopPropagation();

        this.choiceIsShown = false;
        this.choiceEl.classList.add("hide");
        this.choiceEl.innerHTML = "";

        const { overrideNext, fromLastText } = this.runActions(choice.actions);
        const targetScene = overrideNext ?? choice.next;

        this.startScene(targetScene, { fromLastText });
      });

      this.choiceEl.appendChild(btn);
    });

    // If all choices were filtered out by conditions, we hide the choice block.
    if (!hasVisibleChoice) {
      this.choiceEl.classList.add("hide");
      this.choiceIsShown = false;
    }
  }

  /** Checks the condition for opening a choice (for example, item existence). */
  checkCondition(condition) {
    if (!condition) return true;

    if (condition.hasItem && this.player) {
      return this.player.inventory.some(
        (item) => String(item.itemID) === String(condition.hasItem),
      );
    }

    if (condition.hasGold) {
      return this.player.gold >= condition.hasGold;
    }

    return false;
  }

  /**
   * Executes the list of choice actions one at a time.
   * If any handler returned a scene identifier (for example, after a dice
   * roll), it is used instead of the regular choice.next command.
   */
  runActions(actions = []) {
    const result = { overrideNext: null, fromLastText: false };

    for (const action of actions ?? []) {
      const handler = this.actionHandlers[action.type];
      if (!handler) {
        console.warn(`Unknown action type: "${action.type}"`);
        continue;
      }
      const output = handler(action);

      // Handler can return a string (scene id, as before with rollDice)
      // or an object with additional settings (as with toChoices)
      if (typeof output === "string") {
        result.overrideNext = output;
      } else if (output && typeof output === "object") {
        if (output.overrideNext) result.overrideNext = output.overrideNext;
        if (output.fromLastText) result.fromLastText = true;
      }
    }

    return result;
  }

  _addItem(item) {
    const alreadyHas = this.player.inventory.some(
      (i) => String(i.itemID) === String(item.itemID),
    );
    if (alreadyHas) return;

    this.player.inventory.push(item);
  }

  _rollDice({ die = 20, threshold = 10, onSuccess, onFail } = {}) {
    const roll = this._diceAnim(die, threshold);
    const success = roll >= threshold;

    this.lastRoll = roll;

    if (success) return onSuccess;
    return onFail; // undefined if onFail is not set -> choice.next will trigger
  }

  _spendGold(gold) {
    this.player.gold -= gold;
  }

  _addGold(gold) {
    this.player.gold += gold;
  }

  parseVariables(text) {
    const variables = { name: this.player.name, gold: this.player.gold };
    return text.replace(/\{(\w+)\}/g, (match, variable) => {
      return variables[variable] ?? match;
    });
  }

  _diceAnim(diceSize, threshold) {
    const container = document.getElementById("diceContainer");
    const requirement = document.getElementById("dice-requirement");
    const resultElement = document.getElementById("dice-result");
    const status = document.getElementById("dice-status");

    container.classList.remove("hide");
    document.querySelector(".gameplay-field").classList.add("hide");

    if (language === "ru")
      requirement.textContent = `Нужно выбросить: ${threshold} или выше`;
    else if (language === "fi")
      requirement.textContent = `Arvon on oltava vähintään: ${threshold}`;

    let result = Math.floor(Math.random() * diceSize) + 1;

    const animation = setInterval(() => {
      let fakeResult = Math.floor(Math.random() * diceSize) + 1;

      resultElement.textContent = fakeResult;
    }, 100);

    const clear = setTimeout(() => {
      clearInterval(animation);

      resultElement.textContent = result;

      if (language === "ru") {
        if (result >= threshold) {
          status.textContent = "Успех!";
        } else {
          status.textContent = "Провал...";
        }
      } else if (language === "fi") {
        if (result >= threshold) {
          status.textContent = "Onnistui!";
        } else {
          status.textContent = "Epäonnistui...";
        }
      }

      const hide = setInterval(() => {
        container.classList.add("hide");
        document.querySelector(".gameplay-field").classList.remove("hide");

        clearInterval(hide);
      }, 3000);

      clearInterval(clear);
    }, 1000);

    return result;
  }
}
