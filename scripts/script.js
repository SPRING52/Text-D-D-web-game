// script.js
// Точка входа: связывает Engine и Player в единое состояние игры,
// обрабатывает старт игры и открытие инвентаря.

import { Player } from "./player.js";
import { Engine } from "./engine.js";

const startBtn = document.getElementById("startGame");
const formEl = document.querySelector(".first-form");
const gameFieldEl = document.querySelector(".gameplay-field");
const inventoryEl = document.querySelector(".inventory");
const itemListEl = document.querySelector(".items");
const statsField = document.querySelector(".stats");
const nameInput = document.getElementById("nameInput");

const starGameAudio = new Audio("/sounds/undertale.mp3");

// Один-единственный Engine на всю игру, Player получает ссылку на него.
// Раньше player.js и script.js создавали ДВА разных Engine — из-за этого
// печать описания предмета обновляла состояние, которое никто не видел.
const engine = new Engine();
const player = new Player(engine);

startBtn.addEventListener("click", startGame);

/* Начинает игру: ставит имя игрока, открывает игровой экран, 
ставит скрипты на открытие инвенторя*/

function startGame() {
  const playerNameValue = nameInput.value.trim();
  starGameAudio.play();

  if (!playerNameValue) {
    alert("Введите имя персонажа");
    return;
  }

  player.name = playerNameValue;
  player.inventory = engine.inventory;

  renderStats();

  document.addEventListener("keydown", handleGlobalKeydown);

  formEl.remove();
  gameFieldEl.classList.remove("hide");

  const startInterval = setInterval(() => {
    engine.init(player);

    clearInterval(startInterval);
  }, 1000);
}

function renderStats() {
  statsField.innerHTML = `<p>${player.name}</p>
  <p>${player.gold}</p>`;
}

function toggleInventory() {
  gameFieldEl.classList.toggle("hide");
  inventoryEl.classList.toggle("hide");

  // Перерисовываем список каждый раз, чтобы инвентарь всегда
  // отражал актуальное состояние player.inventory.
  if (!inventoryEl.classList.contains("hide")) {
    renderInventoryItems();
  }
  renderStats();
}

function renderInventoryItems() {
  itemListEl.innerHTML = "";

  player.inventory.forEach((item) => {
    const btn = document.createElement("button");
    // dataset вместо id: числовой/произвольный itemID
    // не всегда является валидным HTML id.
    btn.dataset.itemId = item.itemID;
    btn.textContent = item.itemName;

    btn.addEventListener("click", () => {
      player.useItem(item.itemID);
      toggleInventory();
    });

    itemListEl.append(btn);
  });
}

function handleGlobalKeydown(event) {
  if (event.code === "KeyI" && !engine.isTyping) {
    toggleInventory();
  }
}
