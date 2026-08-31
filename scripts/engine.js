// engine.js
// Pelimoottori: skenaarion lataaminen, tekstin tulostaminen, valintojen näyttäminen, esineiden käsittely.
const TYPING_SPEED_MS = 40;
const textTypeAudio = new Audio("/sounds/text.mp3");

const language = document.documentElement.lang;
console.log(language);

/**
 * Lataa JSON-tiedoston, joka sisältää skriptin.
 * Siirretty erilliseen funktioon, jossa käsitellään verkkovirheitä,
 * jotta fetch-kutsun epäonnistuminen ei kaataisi koko moduulia ilman selitystä.
 */
async function loadStoryRU(path = "../scenarioRU.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Skriptiä (${path}) ei voitu ladata: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

async function loadStoryFI(path = "../scenarioFI.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Skriptiä (${path}) ei voitu ladata: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// Skriptitiedosto ladataan kerran, kun moduuli tuodaan ensimmäisen kerran.
// Top-level await -ominaisuuden ansiosta kaikki, jotka tuovat Engine-moduulin, saavat
// valmiit tiedot — uusia pyyntöjä ei tehdä, koska ES-moduulit
// suoritetaan kerran ja ne tallennetaan välimuistiin ajon aikana.
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

    // Pelaaja, johon tämä moottori on liitetty (tarvitaan valintaehtojen tarkistamista varten).
    // Määritetään init(player)-funktiolla, ei ulkopuolisen globaalin objektin kautta.
    this.player = null;

    this.gameplayFieldEl = document.querySelector(".gameplay-field");
    this.textField = document.getElementById("text");
    this.choiceEl = document.getElementById("choices");

    // Liitämme tapahtumankäsittelijän kerran, jotta sitä voidaan turvallisesti
    // poistaa tai lisätä removeEventListener-funktiolla.
    this._onFieldClick = this.handleTextBoxClick.bind(this);

    // Tällä hetkellä tulostettava teksti (tarvitaan skipToEnd-funktiota varten).
    this._currentFullText = "";

    // Toimintojen käsittelijöiden rekisteri. Avain on JSON-tiedoston action.type,
    // arvo on funktio (action, engine) => void | string (seuraavan kohtauksen tunnus)
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
   * Pelin alustaminen: määrittää pelaajan, asettaa klikkauskäsittelijän
   * pelikentälle ja käynnistää ensimmäisen kohtauksen.
   */
  init(player) {
    this.player = player;
    console.log(this.story);
    // removeEventListener ennen add — suojaa toistuvilta init()-kutsuilta,
    // jotta käsittelijää ei luoda kahdesti.
    this.gameplayFieldEl.removeEventListener("click", this._onFieldClick);
    this.gameplayFieldEl.addEventListener("click", this._onFieldClick);

    this.startScene(this.currentIndex);
  }

  /** Käynnistää kohtauksen seuraavan tekstin tulostuksen. */
  startScene(index, { fromLastText = false } = {}) {
    this.textMode = "scene";
    this.currentIndex = index;
    this.isComplete = false;

    const texts = this.story[this.currentIndex].texts;
    this.textIndex = fromLastText ? texts.length - 1 : 0;

    this._type(texts[this.textIndex]);
  }

  /** Näyttää esineen kuvauksen (käytetään Player.useItem-funktiota). */
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
   * Yhtenäinen funktio tekstin merkki kerrallaan tulostamiseen.
   * Korvaa aiemmat päällekkäiset typeCharacter()/typeItemDescription()-funktiot —
   * nyt sama koodi käsittelee sekä kohtauksia että esineitä,
   * eikä merkkijonoa koota uudelleen split()-funktiolla jokaisella iteraatiolla.
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

  /** Tekstin tulostuksen päättymisen käsittely. */
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

  /** Klikkaus pelikenttään: joko selaa tekstiä eteenpäin tai siirry seuraavaan kohtaan. */
  handleTextBoxClick() {
    if (this.isTyping) {
      this.skipToEnd();
      return;
    }

    // Jos esineen kuvaus on auki, palataan nykyiseen kohtaukseen.
    if (this.textMode === "item") {
      this.startScene(this.currentIndex);
      return;
    }

    const currentTexts = this.story[this.currentIndex].texts;

    if (this.textIndex < currentTexts.length - 1) {
      this.textIndex++;
      console.log(this.textIndex);
      this._type(this.story[this.currentIndex].texts[this.textIndex]);
    } else if (!this.choiceIsShown) {
      this.showChoices(this.story[this.currentIndex].choices);
    }
  }

  /** Tulostaa nykyisen tekstin kokonaisuudessaan välittömästi. */
  skipToEnd() {
    clearTimeout(this.timeoutId);

    this.textField.textContent = this._currentFullText;
    this.charIndex = this._currentFullText.length;

    this._finishTyping();
  }

  /** Piirtää nykyisessä kohtauksessa käytettävissä olevat valintapainikkeet. */
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

        console.log(`Следующая сцена: ${targetScene}`);

        this.startScene(targetScene, { fromLastText });
      });

      this.choiceEl.appendChild(btn);
    });

    // Jos kaikki vaihtoehdot on suodatettu ehtojen perusteella, piilotamme valintalohkon.
    if (!hasVisibleChoice) {
      this.choiceEl.classList.add("hide");
      this.choiceIsShown = false;
    }
  }

  /** Tarkistaa valinnan avaamisen ehdon (esimerkiksi kohteen olemassaolon). */
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
   * Suorittaa valintatoimintojen luettelon yksi kerrallaan.
   * Jos jokin käsittelijä palautti kohtauksen tunnuksen (esimerkiksi nopan
   * heiton jälkeen), sitä käytetään tavallisen choice.next-komennon sijaan.
   */
  runActions(actions = []) {
    const result = { overrideNext: null, fromLastText: false };

    for (const action of actions ?? []) {
      const handler = this.actionHandlers[action.type];
      if (!handler) {
        console.warn(`Неизвестный тип действия: "${action.type}"`);
        continue;
      }
      console.log(action);
      const output = handler(action);

      // Обработчик может вернуть строку (id сцены, как раньше у rollDice)
      // или объект с доп. настройками (как у toChoices)
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

    console.log(
      `🎲 Бросок d${die}: выпало ${roll} (порог ${threshold}) — ${
        success ? "УСПЕХ" : "ПРОВАЛ"
      }`,
    );

    if (success) return onSuccess;
    return onFail; // undefined, если onFail не задан -> сработает choice.next
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
