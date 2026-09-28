# tenjin-schema

The declarative data formats used with the [Tenjin game engine](https://tenjin.cards). This documents how to create JSON files for cards, modes, and decks. Drop your files into Tenjin's config selectors to validate.

## Games

```json
{
  "name": "Example Game",
  "version": "1.0",
  "sets": { "DEMO": "2026-09-27" },
  "banned": { "Overpower": "2026-09-27" },
  "colors": { "mainDeck": "#000000", "manaDeck": "#ffffff" },
  "terminology": {},
  "cardRoles": { "leader": "commander", "site": "arena", "resource": "energy" },
  "rules": {
    "leaderColorIdentity": true,
    "openingCardTypes": ["unit"],
    "upgradeDelayTurns": 1,
    "mainUnitLimit": 5,
    "siteUnitLimit": 1,
    "disableEndTurn": true,
    "emptyDeckDraw": "ignore",
    "defeatedUnitPoints": 1,
    "requiredInPlay": ["unit"]
  },
  "layout": { "compactCardHeight": "200px" },
  "defaultMode": { ... },
  "defaultDecks": [ ... ],
  "cards": [ ... ]
}
```

### Cards

```json
{
  "id": "DEMO-001",
  "name": "Scout",
  "types": ["unit"],
  "upgrade": "DEMO-002",
  "restrictToLeader": "scout",
  "description": "",
  "strength": 2,
  "attack": 1,
  "manaTap": 1,
  "manaRecycle": 0,
  "colors": [],
  "image": "cards/DEMO-001.webp",
  "attachDescription": "",
  "strengthBonus": 1,
  "attackBonus": 1,
  "attach": { ... },
  "variants": { "DEMO-001a": "cards/DEMO-001a.webp" },
  "copyLimit": 3,
  "playLimit": { "cardType": "unit", "perTurn": 1 },
  "ability": {
    "effects": {
      "played": [{ "effect": { "draw": 1 } }]
    }
  }
}
```

Effects can describe costs, selections, conditions, and instructions. Use the field definitions in [cardEffectTypes.ts](src/cardEffectTypes.ts) and the supported values in [cardEffectVocabulary.ts](src/cardEffectVocabulary.ts) when authoring more complex abilities.

## Modes

```json
{
  "sets": { "DEMO": "2026-09-27" },
  "hash": "example-standard-v1",
  "gameName": "Example Game",
  "name": "Standard",
  "version": "1.0",
  "players": 2,
  "games": 1,
  "teamSize": 1,
  "points": 3,
  "leaders": 1,
  "chosens": 1,
  "colorLimit": 3,
  "sites": { "minimumSize": 3, "maximumSize": 3, "choose": "unique" },
  "sideboard": { "minimumSize": 0, "maximumSize": 5 },
  "banned": {},
  "mainDeck": { "minimumSize": 50, "maximumSize": 50, "copyLimit": 4 },
  "manaDeck": { "minimumSize": 10, "maximumSize": 10 }
}
```

## Decks

> Note that custom deck files are not required as Tenjin also supports copy/pasting common card list formats.

```json
{
  "name": "Scout Deck",
  "gameName": "Example Game",
  "cards": "DEMO-001-4 DEMO-002-1"
}
```

## Updating

Games/modes/decks may include an optional `sourceUrl`: an absolute URL so users can obtain an updated definition.
