export const CARD_RELATION_TYPES = ['attachedTo', 'banishedWith', 'combatWith', 'chosenBy', 'chooses', 'damagedBy', 'hasAttached', 'killedBy', 'replacedBy', 'replaces'] as const
export const PREV_MANA_DAMAGE = { stat: 'mana', card: { from: 'previousSelection' } } as const
export const REVEALED_FACEDOWN = 'revealedFacedown' as const
export const CARDS_IN_TRASH = 'cardsInDiscard' as const
export const INFINITY_COST = 'infinityCost' as const
export const POINTS_SELF = 'ownPoints' as const
export const EACH_OPPONENT_LOCATION = 'eachOpponentLocation' as const
export const SOURCE_STRENGTH = { stat: 'strength', card: 'affectingCard' } as const
export const SOURCE_ASSAULT = { stat: 'assault', card: 'affectingCard' } as const
export const HIGHEST_STRENGTH_SELF_UNITS = 'highestFriendlyUnitStrength' as const
export const PREV_STRENGTH_PLUS_ONE = { calculation: { operation: 'add', left: { stat: 'strength', card: { from: 'previousSelection' }, previous: true }, right: 1 } } as const
export const PREV_STRENGTH = { stat: 'strength', card: { from: 'previousSelection' }, previous: true } as const
export const EXCESS_DAMAGE = 'excessDamage' as const
export const TARGET_MANA = { stat: 'mana', card: 'recipient' } as const
export const PREV_MANA = { stat: 'mana', card: { from: 'previousSelection' } } as const
export const PREV_MANA_RECYCLE = { stat: 'manaRecycle', card: { from: 'previousSelection' } } as const
export const TARGET_MARKED_DAMAGE = { stat: 'damage', card: 'recipient' } as const
/** Default Tenjin vocabulary of the optional card/effect document profile. Consumers may extend or replace names. */
export const GAME_STATS = ['roundNumber'] as const
export const PLAYER_STATS = ['points', 'xp'] as const
export const PLAYER_TURN_STATS = ['burned', 'discarded', 'killed', 'spentMana', 'spentManaRecycle', 'drawn', 'played', 'playsInitiated', 'holds', 'conquers', 'excessDamage', 'winCombat', 'xpGained', 'chosenEnemyUnits', 'chosenEnemyUnitsOrGearWithSpellsOrUnitAbilities'] as const
export const CARD_STATS = ['strength', 'attack', 'assault', 'shield', 'deflect', 'mana', 'manaRecycle', 'damage', 'buff', 'enhanced'] as const
export const ACTION_WINDOWS = ['contesting', 'response'] as const
export const CARD_LOCATIONS = ['none', 'mainCards', 'hand', 'chosen', 'manaCards', 'mainDeck', 'manaDeck', 'discard', 'leader', 'chain', 'chainPending', 'banished', 'playRevealed', 'attached', 'site-*'] as const
export const PLAYER_CARD_LOCATIONS = ['mainDeck', 'manaDeck', 'discard', 'hand', 'mainCards', 'manaCards', 'attached'] as const
export const LOCATION_AREAS = ['here', 'base', 'site', 'siteControlled', 'controlled', 'inPlay', 'faceUp', 'inPlayOrChosen', 'chosen', 'hand', 'mainDeck', 'discard', 'banished', 'chain', 'manaCards', 'manaDeck', 'noSiteSite', 'attached'] as const
export const PLAYER_TARGETS = ['self', 'team', 'opponent', 'sourceOpponent', 'all', 'sameController'] as const
export const COST_TYPES = ['buffSelf', 'buffSelect', 'hand', 'killSelect', 'killSelf', 'recycleSelf', 'discardRecycle', 'mana', 'manaRecycle', 'xp', 'tapSelf', 'tapSelect', 'tapLeader', 'returnToHandSelect', 'banishSelf', 'disenhanceSelf', 'banishSelect', 'revealSelect'] as const
export const MODIFIER_TYPES = ['facedownCapacity', 'winningScore', 'strength', 'baseStrength', 'strengthMultiplier', 'attachStrengthMultiplier', 'attack', 'attackMultiplier', 'kill', 'recycle', 'stun', 'cantMove', 'assault', 'ganking', 'ready', 'unready', 'tank', 'untank', 'ignoreTank', 'shield', 'deflect', 'ignoreAbility', 'opponentsCantPlay', 'cantBeCountered', 'negativeStrengthAddition', 'adverseChoiceStrengthReplacement', 'recallOnDeath', 'banishOnDeath', 'buffAddition', 'temporary', 'enhanced', 'noDamageReceived', 'damagePrevention', 'noSpellAbilityDamage', 'damageReceivedMultiplier', 'noDamageDelivered', 'damageKills', 'killOnDamage', 'facedownCost', 'scry', 'equips', 'quick', 'haste', 'type', 'damage', 'mana', 'manaRecycle', 'repeat', 'playPermission', 'spellTargetDiscount', 'channelLimit', 'channelAddition', 'skip', 'trashToBanish', 'actionWindows'] as const
export const CARD_TYPES = ['unit', 'gear', 'equipment', 'spell', 'token', 'champion', 'rune', 'battlefield', 'resource', 'site'] as const
export const TURN_STEPS = ['awaken', 'beginning', 'scoring', 'channel', 'draw', 'main', 'ending', 'expiration'] as const
export const EFFECT_KEYS = ['played', 'onPlayed', 'wouldPlay', 'onHide', 'beginning', 'main', 'ending', 'onDraw', 'onScore', 'onStun', 'stunned', 'reduceCost', 'onCosts', 'facedownCostAlternative', 'noRevealFacedown', 'hold', 'leaveBoard', 'deathKeyword', 'killed', 'onKill', 'wouldDie', 'onRecycle', 'returnedToHand', 'buffed', 'onSpendBuff', 'onInvalidate', 'combat', 'showdownStart', 'combatEnded', 'conquered', 'winCombat', 'onTieRecall', 'moved', 'attached', 'enters', 'canReady', 'onReady', 'discarded', 'onDiscard', 'burned', 'onBurn', 'enhanced', 'onEnhance', 'onBanish', 'damaged', 'healed', 'passiveModifiers', 'canPlayTo', 'canMove', 'moveCost', 'bonusDamage', 'onBeforeReveal', 'onRevealed', 'chooseWith', 'onChoose', 'disableScore', 'triggerRepeat', 'onStrengthReduced', 'onExhaust'] as const
/** Recordable occurrences may exist without a triggered ability key. */
export const HISTORY_EVENTS = [...EFFECT_KEYS, 'activation'] as const
export const EFFECT_RULE_KEYS = ['canMove', 'canPlayTo', 'canReady', 'conquered', 'disableScore', 'hold', 'moveCost', 'noRevealFacedown', 'onTieRecall'] as const
export const SITE_CONDITIONALS = ['own', 'friendlyPresent', 'enemyPresent', 'open', 'opposed', 'conqueredThisTurn', 'attacking', 'defending'] as const
export const CORE_AMOUNTS = [] as const
export const DAMAGE_AMOUNTS = [REVEALED_FACEDOWN, EXCESS_DAMAGE, INFINITY_COST] as const
export const CONDITIONAL_TYPES = ['amount', 'eventCount', 'all', 'any', 'chosen', 'playsFacedown', 'wasFacedown', 'tapped', 'temporary', 'stunned', 'combat', 'attacking', 'defending', 'tank', 'showdown', 'showdownActive', 'uncontrolledConquest', 'conquersThisTurn'] as const
export const EFFECT_INSTRUCTION_KINDS = ['kills', 'heals', 'readies', 'moves', 'damage', 'addBuff', 'modifiers', 'control', 'banishes', 'enhancement'] as const
export const cardEffectVocabulary = { CARD_RELATION_TYPES, GAME_STATS, PLAYER_STATS, PLAYER_TURN_STATS, CARD_STATS, ACTION_WINDOWS, CARD_LOCATIONS, PLAYER_CARD_LOCATIONS, LOCATION_AREAS, PLAYER_TARGETS, COST_TYPES, MODIFIER_TYPES, CARD_TYPES, TURN_STEPS, EFFECT_KEYS, HISTORY_EVENTS, EFFECT_RULE_KEYS, SITE_CONDITIONALS, CORE_AMOUNTS, DAMAGE_AMOUNTS, CONDITIONAL_TYPES, EFFECT_INSTRUCTION_KINDS } as const
export type CardEffectVocabulary = {
	readonly [Key in keyof typeof cardEffectVocabulary]: readonly string[]
}
export type DefaultVocabulary = typeof cardEffectVocabulary
export function effectKeyRequiresAction(key: (typeof EFFECT_KEYS)[number]): key is Exclude<(typeof EFFECT_KEYS)[number], (typeof EFFECT_RULE_KEYS)[number]> {
	return !(EFFECT_RULE_KEYS as readonly string[]).includes(key)
}
