# Text-Based RPG Engine

A D&D-inspired text-based role-playing game built with vanilla JavaScript. This project demonstrates a modular, event-driven architecture for creating interactive narrative experiences in the browser.

## Features

- **Multilingual Support**: Full Russian and Finnish localization
- **Dynamic Text Engine**: Character-by-character text typing with customizable speed
- **Interactive Choices**: Conditional choice system based on inventory and resources
- **Dice Rolling System**: Visual dice roll animations with success/failure mechanics
- **Inventory Management**: Item collection and usage system
- **Save State**: Persistent game state throughout the session
- **Responsive Design**: Optimized for both desktop and mobile devices

## Project Architecture

### Core Modules

The project follows a modular architecture with clear separation of concerns:

```
Seikkailupeli/
├── scripts/
│   ├── engine.js      # Game engine core
│   ├── player.js      # Player state management
│   └── script.js      # Main entry point & UI handling
├── styles/
│   ├── style.css      # Main styles
│   └── dice.css       # Dice roll animation styles
├── indexRU.html       # Russian version
├── indexFI.html       # Finnish version
└── scenarioRU/FI.json # Game scenario data
```

## Technical Documentation

### 1. Engine Module (`engine.js`)

The engine is the heart of the game, handling all core game logic.

#### Key Components:

**Loading System**

```javascript
async function loadStoryRU(path = "../scenarioRU.json")
async function loadStoryFI(path = "../scenarioFI.json")
```

- Asynchronously loads game scenarios from JSON files
- Implements error handling for network failures
- Uses top-level await for module initialization

**Engine Class**

**Constructor:**

```javascript
constructor((data = storyData));
```

Initializes:

- Scene data from JSON
- Starting scene index
- Text animation state
- DOM element references
- Action handlers registry

**Core Methods:**

| Method                       | Purpose                               | Parameters                                  |
| ---------------------------- | ------------------------------------- | ------------------------------------------- |
| `init(player)`               | Initialize game with player instance  | `player`: Player object                     |
| `startScene(index, options)` | Begin a new scene                     | `index`: scene ID, `options`: configuration |
| `_type(fullText)`            | Character-by-character text animation | `fullText`: text to display                 |
| `showChoices(choices)`       | Render available player choices       | `choices`: array of choice objects          |
| `checkCondition(condition)`  | Evaluate choice availability          | `condition`: condition object               |
| `runActions(actions)`        | Execute choice actions                | `actions`: array of action objects          |

**Action Handlers System:**

The engine uses a registry pattern for extensible action handling:

```javascript
this.actionHandlers = {
  addItem: (action) => this._addItem(action.item),
  toChoices: (action) => ({ fromLastText: true, overrideNext: action.next }),
  rollDice: (action) => this._rollDice(action),
  spendGold: (action) => this._spendGold(action.value),
  addGold: (action) => this._addGold(action.value),
};
```

**How to add a new action:**

1. Define the action handler function
2. Add it to the `actionHandlers` object
3. Use it in your JSON scenario with `{ "type": "yourActionName" }`

**Dice Roll System:**

```javascript
_rollDice(({ die = 20, threshold = 10, onSuccess, onFail } = {}));
```

Features:

- Visual animation with random number cycling
- Configurable dice size (d6, d20, etc.)
- Success/failure threshold checking
- Conditional scene branching based on results

**Variable Parsing:**

```javascript
parseVariables(text);
```

Replaces placeholders in text with player data:

- `{name}` → Player name
- `{gold}` → Current gold amount

Example: `"Hello, {name}! You have {gold} gold."` → `"Hello, Spring! You have 40 gold."`

### 2. Player Module (`player.js`)

Manages player state and inventory interactions.

```javascript
export class Player {
  constructor(engine) {
    this.engine = engine;
    this.name = null;
    this.gold = 40;
    this.inventory = [];
  }

  useItem(itemID) {
    // Find and display item description
  }
}
```

**Key Design Decision:**
The Player receives the Engine instance as a dependency, ensuring both modules work with the same game state. This prevents the synchronization issues that occur when each module creates its own Engine instance.

### 3. Main Script (`script.js`)

Entry point that connects all modules and handles UI interactions.

**Game Initialization:**

```javascript
const engine = new Engine();
const player = new Player(engine);

function startGame() {
  player.name = nameInput.value.trim();
  player.inventory = engine.inventory;
  engine.init(player);
}
```

**Inventory System:**

```javascript
function toggleInventory() {
  gameFieldEl.classList.toggle("hide");
  inventoryEl.classList.toggle("hide");
  if (!inventoryEl.classList.contains("hide")) {
    renderInventoryItems();
  }
}
```

Keyboard shortcut: Press `i` to open/close inventory (when text is not typing)

**Global Event Handling:**

```javascript
function handleGlobalKeydown(event) {
  if (event.code === "KeyI" && !engine.isTyping) {
    toggleInventory();
  }
}
```

## Styling System

### Main Styles (`style.css`)

**CSS Custom Properties:**

```css
:root {
  --main-bg-past: /* Gradient for fantasy theme */
    --main-bg-future: /* Alternative theme */
      --main-past-font-family: "Playpen Sans",
    cursive;
  --main-font-color: rgb(240, 240, 240);
}
```

**Layout Structure:**

- Flexbox and Grid layouts for responsive design
- Container-based centering pattern
- Utility classes (`.flex`, `.grid`, `.hide`)

### Dice Animation (`dice.css`)

**Visual Design Principles:**

- Dark fantasy theme with gold accents
- Subtle gradients and shadows for depth
- Smooth transitions and animations

**Key Animations:**

```css
@keyframes diceWindowAppear {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

**Responsive Breakpoints:**

- Mobile optimization at `max-width: 600px`
- Scaled font sizes and container dimensions

## JSON Scenario Format

The game scenarios are defined in JSON files with the following structure:

```json
{
  "meta": {
    "startScene": "scene1"
  },
  "items": [
    {
      "itemID": 1,
      "itemName": "Torch",
      "description": "A wooden torch that lights your way."
    }
  ],
  "scenes": {
    "scene1": {
      "texts": ["You wake up in a dark dungeon.", "The air is cold and damp."],
      "choices": [
        {
          "label": "Look around",
          "next": "scene2",
          "condition": null,
          "actions": []
        },
        {
          "label": "Use torch",
          "next": "scene3",
          "condition": { "hasItem": 1 },
          "actions": [
            { "type": "addItem", "item": { "itemID": 2, "itemName": "Key" } }
          ]
        }
      ]
    }
  }
}
```

### Scene Properties:

| Property  | Type  | Description                          |
| --------- | ----- | ------------------------------------ |
| `texts`   | Array | Sequential text blocks for the scene |
| `choices` | Array | Available player choices             |

### Choice Properties:

| Property    | Type        | Description                      |
| ----------- | ----------- | -------------------------------- |
| `label`     | String      | Button text shown to player      |
| `next`      | String      | ID of the next scene             |
| `condition` | Object/null | Requirements to show this choice |
| `actions`   | Array       | Actions executed when chosen     |

### Condition Types:

```json
{ "hasItem": 1 }        // Player must have item with ID 1
{ "hasGold": 50 }       // Player must have at least 50 gold
```

### Action Types:

| Type        | Parameters                                | Effect                                   |
| ----------- | ----------------------------------------- | ---------------------------------------- |
| `addItem`   | `item` object                             | Adds item to inventory                   |
| `spendGold` | `value` number                            | Removes gold from player                 |
| `addGold`   | `value` number                            | Adds gold to player                      |
| `rollDice`  | `die`, `threshold`, `onSuccess`, `onFail` | Dice roll with branching                 |
| `toChoices` | `next` scene ID                           | Override next scene, return to last text |

### Dice Roll Action Example:

```json
{
  "type": "rollDice",
  "die": 20,
  "threshold": 15,
  "onSuccess": "scene_success",
  "onFail": "scene_failure"
}
```

## How to Customize

### Adding a New Action Type

1. **Define the handler in `engine.js`:**

```javascript
this.actionHandlers = {
  // ... existing handlers
  heal: (action) => {
    this.player.health += action.amount;
    console.log(`Healed ${action.amount} HP`);
  },
};
```

2. **Use in your JSON scenario:**

```json
{
  "type": "heal",
  "amount": 20
}
```

### Creating a New Language Version

1. **Create HTML file** (e.g., `indexEN.html`):

```html
<html lang="en">
  <!-- Copy structure from indexRU.html -->
  <!-- Translate UI text -->
</html>
```

2. **Create scenario file** (e.g., `scenarioEN.json`)

3. **Update `engine.js` loader:**

```javascript
async function loadStoryEN(path = "../scenarioEN.json") {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(
      `Script (${path}) could not be loaded: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

// Update language detection
let storyData = null;
if (language === "ru") {
  storyData = await loadStoryRU();
} else if (language === "en") {
  storyData = await loadStoryEN();
} else {
  storyData = await loadStoryFI();
}
```

4. **Add language-specific text in `_diceAnim` method:**

```javascript
if (language === "ru") {
  requirement.textContent = `Нужно выбросить: ${threshold} или выше`;
} else if (language === "en") {
  requirement.textContent = `Must roll: ${threshold} or higher`;
} else if (language === "fi") {
  requirement.textContent = `Arvon on oltava vähintään: ${threshold}`;
}
```

### Modifying Text Animation Speed

Change the constant at the top of `engine.js`:

```javascript
const TYPING_SPEED_MS = 40; // Lower = faster, Higher = slower
```

### Customizing Visual Theme

Edit CSS custom properties in `style.css`:

```css
:root {
  --main-bg-past: /* Your gradient here */;
  --main-past-font-family: "Your Font", serif;
  --main-font-color: rgb(your, colors, here);
}
```

## Running the Project

1. **Clone the repository**

```bash
git clone <repository-url>
cd Seikkailupeli
```

2. **Run with a local server** (required for ES6 modules):

**Option 1: Python**

```bash
python -m http.server 8000
```

**Option 2: Node.js (http-server)**

```bash
npx http-server -p 8000
```

**Option 3: VS Code Live Server**

- Install Live Server extension
- Right-click on HTML file → "Open with Live Server"

3. **Open in browser:**

```
http://localhost:8000/indexRU.html
```

or

```
http://localhost:8000/indexFI.html
```

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 15+)
- **Opera**: Full support

**Required Features:**

- ES6 Modules
- Async/await
- CSS Grid/Flexbox
- Top-level await

## Code Quality Features

- **Clean Code**: Descriptive variable and function names
- **Comments**: Comprehensive inline documentation
- **Error Handling**: Graceful failure with user feedback
- **Validation**: Input validation (player name required)
- **DRY Principle**: Unified `_type()` method replaces duplicate code
- **Single Responsibility**: Each module has a clear purpose
- **Type Safety**: String comparison for itemID (handles mixed types)

## Future Enhancement Ideas

- [ ] Save/load game progress to localStorage
- [ ] Character stats system (health, mana, strength)
- [ ] Combat mechanics
- [ ] Achievement system
- [ ] Sound effects and background music
- [ ] Multiple save slots
- [ ] Branching storylines with replay value
- [ ] Character portraits and artwork
- [ ] Accessibility improvements (screen reader support)
- [ ] Unit tests for game logic

## License

This project is open source and available for educational purposes.

---

_Built with vanilla JavaScript, CSS, and HTML. No frameworks, just pure code._
