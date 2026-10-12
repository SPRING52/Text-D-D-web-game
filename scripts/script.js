// script.js
// Entry point: connects Engine and Player into a single game state,
// handles game start and inventory opening.

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

// Single Engine for the entire game, Player receives a reference to it.
// Previously player.js and script.js created TWO different Engines — because of this
// printing item description updated state that nobody could see.
const engine = new Engine();
const player = new Player(engine);

startBtn.addEventListener("click", startGame);

/* Starts the game: sets player name, opens game screen,
sets scripts for opening inventory */

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

  // Redraw the list each time so the inventory always
  // reflects the current state of player.inventory.
  if (!inventoryEl.classList.contains("hide")) {
    renderInventoryItems();
  }
  renderStats();
}

function renderInventoryItems() {
  itemListEl.innerHTML = "";

  player.inventory.forEach((item) => {
    const btn = document.createElement("button");
    // dataset instead of id: numeric/arbitrary itemID
    // is not always a valid HTML id.
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
