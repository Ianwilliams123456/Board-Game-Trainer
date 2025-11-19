// games/arknova.json
{
  "key": "arknova",
  "name": "Ark Nova",
  "minPlayers": 1,
  "maxPlayers": 4,
  "phases": ["Take Action", "Check Break", "Break: Income / Reset"],
  "resources": [
    { "key": "breakMeter", "label": "Break Meter", "type": "number", "scope": "global", "min": 0, "max": 16 },
    { "key": "money", "label": "Money", "type": "number", "scope": "perPlayer", "min": 0, "max": 999 },
    { "key": "xTokens", "label": "X Tokens", "type": "number", "scope": "perPlayer", "min": 0, "max": 5 },
    { "key": "appeal", "label": "Appeal", "type": "number", "scope": "perPlayer", "min": 0, "max": 200 },
    { "key": "conservation", "label": "Conservation", "type": "number", "scope": "perPlayer", "min": 0, "max": 30 },
    { "key": "reputation", "label": "Reputation", "type": "number", "scope": "perPlayer", "min": 0, "max": 20 }
  ]
}
