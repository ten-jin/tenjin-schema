import type { CardEffectVocabulary } from './cardEffectVocabulary.ts'
import { isSiteLocation } from './cardLocations.ts'
import type { AbilitySet, CardLocation, CardData, CardEffectData, CardConditional, EffectCostDefinition, EffectCostContainer, EffectDefinition, EffectInstance, EffectSelection, ExportedCardData, CardModifier, CardSetQuery, CardSetRequirement } from './cardEffectTypes.ts'
import { type RecordValue, type Validator, type Check, type FieldValidators, record, number, count, string, boolean, trueValue, object, invalid, required, validate, strings, oneOf, only, values, pathSegments, array, literal, stringRecord } from './primitives.ts'
const typeFilter = array(value => Array.isArray(value) ? strings(value) && (value.length > 0 || invalid('non-empty type intersection')) : string(value))
const positiveCount = (value: unknown) => count(value) && (value > 0 || invalid('positive safe integer'))
const selectionIndex = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) || invalid('safe integer selection index')
export function createCardEffectValidators<const V extends CardEffectVocabulary>(vocabulary: V) {
	const GAME_STATS = new Set(vocabulary.GAME_STATS)
	const PLAYER_STATS = new Set(vocabulary.PLAYER_STATS)
	const PLAYER_TURN_STATS = new Set(vocabulary.PLAYER_TURN_STATS)
	const CARD_STATS = new Set(vocabulary.CARD_STATS)
	const ACTION_WINDOWS = new Set(vocabulary.ACTION_WINDOWS)
	const actionWindow = (value: unknown) => oneOf(value, ACTION_WINDOWS)
	const CARD_LOCATIONS = new Set(vocabulary.CARD_LOCATIONS)
	const PLAYER_CARD_LOCATIONS = new Set(vocabulary.PLAYER_CARD_LOCATIONS)
	const LOCATION_AREAS = new Set(vocabulary.LOCATION_AREAS)
	const PLAYER_TARGETS = new Set(vocabulary.PLAYER_TARGETS)
	const COST_TYPES = new Set(vocabulary.COST_TYPES)
	const MODIFIER_TYPES = new Set(vocabulary.MODIFIER_TYPES)
	const CARD_TYPES = new Set(vocabulary.CARD_TYPES)
	const TURN_STEPS = new Set(vocabulary.TURN_STEPS)
	const EFFECT_KEYS = new Set(vocabulary.EFFECT_KEYS)
	const HISTORY_EVENTS = new Set(vocabulary.HISTORY_EVENTS)
	const EFFECT_RULE_KEYS = new Set(vocabulary.EFFECT_RULE_KEYS)
	const SITE_CONDITIONALS = new Set(vocabulary.SITE_CONDITIONALS)
	const CORE_AMOUNTS = new Set(vocabulary.CORE_AMOUNTS)
	const DAMAGE_AMOUNTS = new Set(vocabulary.DAMAGE_AMOUNTS)
	const CONDITIONAL_TYPES = new Set(vocabulary.CONDITIONAL_TYPES)
	const EFFECT_INSTRUCTION_KINDS = Array.from(vocabulary.EFFECT_INSTRUCTION_KINDS)
	const cardLocation = (value: unknown): value is CardLocation<V> => CARD_LOCATIONS.has('site-*') && isSiteLocation(value) || value !== 'site-*' && oneOf(value, CARD_LOCATIONS)
	const cardLocations = (value: unknown): value is CardLocation<V>[] => array(cardLocation)(value)
	const locationArea = (value: unknown) => oneOf(value, LOCATION_AREAS)
	const playerTarget = (value: unknown) => oneOf(value, PLAYER_TARGETS)
	const costType = (value: unknown) => oneOf(value, COST_TYPES)
	const modifierType = (value: unknown) => oneOf(value, MODIFIER_TYPES)
	const cardStatAmount = (value: unknown) => record(value) && validateStatAmount(value)
	const dynamicAmount = (value: unknown) => record(value) && (value.payment !== undefined ? validatePaymentAmount(value) : value.count !== undefined ? validateCountAmount(value) : value.aggregate !== undefined ? validateAggregateAmount(value) : value.playerStat !== undefined ? validatePlayerStatAmount(value) : value.gameStat !== undefined ? validateGameStatAmount(value) : value.calculation !== undefined ? validateCalculationAmount(value) : validateStatAmount(value))
	const amount = (value: unknown) => number(value) || oneOf(value, CORE_AMOUNTS) || dynamicAmount(value)
	const countAmount = (value: unknown) => count(value) || oneOf(value, CORE_AMOUNTS) || dynamicAmount(value)
	const costAmount = (value: unknown) => amount(value) || value === 'infinityCost'
	const damageAmount = (value: unknown) => number(value) || oneOf(value, DAMAGE_AMOUNTS) || dynamicAmount(value)
	const effectPath = pathSegments
	let queryValidators: Validator | undefined
	let conditionalValidators: Validator | undefined
	let costContainerValidators: Validator | undefined
	let resolvedCostContainerValidators: Validator | undefined
	let validateModifierFields: Validator | undefined
	let validateEffectModifierFields: Validator | undefined
	let validateDefinitionFields: Validator | undefined
	let validateActionDefinitionFields: Validator | undefined
	let modifierValidators: Record<string, Check> | undefined
	let definitionValidators: Record<string, Check> | undefined
	let cardEffectValidators: Validator | undefined
	let cardDataValidators: Validator | undefined
	let effectSelectionValidators: Validator | undefined
	let effectValidators: Validator | undefined
	function isLocationReference(value: unknown): boolean {
		return record(value) && validateLocationReference(value)
	}
	function isSource(value: unknown): boolean {
		if (!record(value))
			return false
		if (value.cards !== undefined)
			return validateCardSource(value)
		if (value.location !== undefined)
			return validateLocationSource(value)
		return validateAreaSource(value)
	}
	function isRequirement(value: unknown): value is CardSetRequirement<V> {
		return record(value) && validateRequirement(value) && (value.min === undefined || value.max === undefined || (value.min as number) <= (value.max as number) || invalid('min <= max'))
	}
	function isRequirements(value: unknown): boolean { return Array.isArray(value) ? array(isRequirement)(value) : isRequirement(value) }
	function isRelations(value: unknown): boolean {
		return record(value) && only(value, vocabulary.CARD_RELATION_TYPES) && values(value, isRequirements)
	}
	function isQuery(value: unknown): value is CardSetQuery<V> {
		if (!record(value))
			return false
		queryValidators ??= object<CardSetQuery<V>>({
			source: isSource, exclude: isCardReference,
			cardTypes: typeFilter,
			names: strings,
			named: literal('cardName', 'type', 'tag'),
			colors: strings,
			excludeCardTypes: strings,
			players: playerTarget,
			conditional: array(isConditional),
			isAtSite: trueValue,
			includeSites: trueValue,
			chosen: trueValue,
			siteControl: trueValue,
			includeSource: trueValue,
			hasModifier: modifierType,
			requiredActionWindow: actionWindow,
			relations: isRelations,
			isFacedown: trueValue,
			siteController: literal('selected', 'open', 'opponent', 'self'),
			excludeLocation: (value: unknown): boolean => locationArea(value) || isLocationReference(value),
		}, [])
		return queryValidators(value)
	}
	function isCompare(value: unknown): boolean {
		return record(value) && validateCompare(value)
	}
	function isConditional(value: unknown): value is CardConditional<V> {
		if (!record(value))
			return false
		if (value.type === 'all' || value.type === 'any') return validateConditionGroup(value)
		if (value.type === 'eventCount') return validateEventCountCondition(value)
		conditionalValidators ??= object({ ...conditionalFields, amount }, ['type'])
		return conditionalValidators(value) && (value.type === 'amount' ? required(value, ['amount']) : value.amount === undefined || invalid('amount only for amount conditions'))
	}
	function isCost(value: unknown, resolved = false): boolean {
		return (resolved ? validateResolvedCost : validateCost)(value)
	}
	function isCostContainer(value: unknown, resolved: true): value is EffectCostContainer<V, EffectCostDefinition<V> & { amount: number }>
	function isCostContainer(value: unknown, resolved?: boolean): value is EffectCostContainer<V>
	function isCostContainer(value: unknown, resolved = false): value is EffectCostContainer<V> {
		if (!record(value))
			return false
		const target = resolved ? (resolvedCostContainerValidators ??= object(costContainerFields(true), ['costs'])) : (costContainerValidators ??= object(costContainerFields(false), ['costs']))
		return target(value)
	}
	function costContainerFields(resolved: boolean): FieldValidators<EffectCostContainer<V>> {
		return {
			costs: array(value => isCost(value, resolved)), timing: literal('resolution'), kind: literal('payment'), cardTypes: strings,
			conditionals: array(isConditional), phase: value => oneOf(value, TURN_STEPS), groupNames: strings,
			playPermissionCharacteristics: strings, chooseOne: trueValue, optionality: literal('optional', 'replaces'),
			facedown: trueValue, selectArea: locationArea, costReduction: array(value => isCost(value, resolved)),
		}
	}
	function isPlayPermission(value: unknown): boolean {
		return record(value) && validatePlayPermission(value)
	}
	function isSingleCardReference(value: unknown): boolean {
		if (record(value) && value.from === 'setupChoice') return validateSetupChoiceReference(value)
		if (record(value) && value.from === 'costSelection')
			return validateCostCardReference(value)
		return literal('effectSource', 'affectingCard', 'eventSubject', 'effectTarget', 'recipient')(value) || record(value) && validateSelectionCardReference(value)
	}
	function isCardReference(value: unknown): boolean {
		return Array.isArray(value) && array(item => !Array.isArray(item) && isCardReference(item))(value)
			|| oneOf(value, ['effectSource', 'affectingCard', 'eventSubject', 'effectTarget', 'recipient', 'affected', 'selection', 'previousSelection'])
			|| isSingleCardReference(value)
			|| record(value) && validateCostCardSetReference(value)
			|| record(value) && validateSetupChoiceSetReference(value)
	}
	function isAmountCalculation(value: unknown): boolean {
		return record(value) && validateAmountCalculation(value)
	}
	function isModifier(value: unknown, effect = false): value is CardModifier<V> {
		if (!record(value))
			return false
		modifierValidators ??= {
			type: modifierType, timestamp: number, amount, duration: literal('combat', 'turn', 'source', 'nextEnding'),
			cardType: value => oneOf(value, CARD_TYPES), consumes: boolean, didConsume: boolean, costs: isCostContainer,
			conditional: array(isConditional), requiresCards: isRequirements, minimum: number,
			ifNotAlready: boolean, reducesCombatAssignment: boolean, replacementEffects: array(literal('stun', 'negativeStrength', 'returnToHand')),
			ignoredAbility: modifierType, ignoredProcedure: literal('costPayment', 'combatDamageAssignment'), targetPlayers: playerTarget,
			oncePerSource: boolean, replaceID: string, sourceCardID: string, playPermission: isPlayPermission, value: string,
		}
		const validateModifier = effect ? (validateEffectModifierFields ??= object<RecordValue>({ ...modifierValidators, scope: literal('players'), copyFrom: isSingleCardReference, subject: isCardReference }, ['type'])) : (validateModifierFields ??= object(modifierValidators, ['type']))
		if (!validateModifier(value))
			return false
		if (value.value !== undefined && value.type === 'actionWindows' && !actionWindow(value.value)) return false
		if (value.value !== undefined && value.amount !== undefined) return invalid('one modifier payload: value or amount')
		if (effect && [value.amount, value.value, value.copyFrom].filter(item => item !== undefined).length > 1)
			return false
		return true
	}
	function isPlayTo(value: unknown, move = false): boolean {
		if (!record(value) || !validatePlayTo(value))
			return false
		return move || only(value, ['action', 'scope', 'conditionals', 'exclusive'])
	}
	function isDefinition(value: unknown, requireEffect = false): value is EffectDefinition<V> {
		if (!record(value))
			return false
		definitionValidators ??= {
			initiatingPlayer: isPlayerReference, turnPlayer: playerTarget, sourceArea: locationArea,
			targetQuery: isQuery, targetFromArea: locationArea, targetNotFromArea: locationArea,
			costSource: literal('cardPlay', 'activatedAbility', 'effect'), combatRole: literal('attacking', 'defending'),
			phase: value => oneOf(value, TURN_STEPS), eventSourceQuery: isQuery, costsThreshold: isCostContainer, conditionalsSource: array(isConditional), conditionalsTarget: array(isConditional),
			activationScope: literal('sameLocation'), activationPlayers: literal('controller', 'turnPlayer', 'all'), taps: boolean, actionWindows: array(actionWindow), usageGroup: string,
			costs: array(isCostContainer), repeatCosts: array(isCostContainer), playTo: array(value => isPlayTo(value)), moveTo: array(value => isPlayTo(value, true)),
			timing: literal('playFinalization'), usage: literal('oncePerTurn'), duplicates: value => oneOf(value, EFFECT_KEYS),
			eventMultiplicity: literal('perObject', 'perBatch'), attachedThisTurn: boolean, consumes: boolean, duration: literal('combat', 'turn', 'source', 'nextEnding'), remainingUses: count, usagePerPlayer: trueValue, minimumEventAmount: count,
			captureTargets: trueValue, effect: isEffect,
		}
		const validateDefinition = requireEffect ? (validateActionDefinitionFields ??= object(definitionValidators, ['effect'])) : (validateDefinitionFields ??= object(definitionValidators))
		return validateDefinition(value)
	}
	function isDefinitions(value: unknown, requireAllEffects = false): boolean {
		if (!record(value) || !only(value, [...EFFECT_KEYS]))
			return false
		return values(value, (definitions, key) => array(definition => isDefinition(definition, requireAllEffects || !EFFECT_RULE_KEYS.has(key)))(definitions))
	}
	function isCardEffect(value: unknown): value is CardEffectData<V> {
		if (!record(value))
			return false
		cardEffectValidators ??= object<CardEffectData<V>>({
			...abilityFields(), setupChoices: stringRecord(object({ query: isQuery, count: positiveCount, distinctNames: trueValue, excludeStarting: trueValue, ifInDeck: isQuery }, ['query', 'count'])),
		}, [])
		return cardEffectValidators(value)
	}
	function abilityFields(): FieldValidators<AbilitySet<V>> {
		return {
			effects: isDefinitions, playModifiers: array(isModifier), repeatCosts: array(isCostContainer), actionWindows: array(actionWindow),
			buffLimit: value => value === null || count(value), enhancementLimit: count, canFacedown: boolean,
			activatableEffects: value => array(item => isDefinition(item, true))(value), additionalCosts: array(isCostContainer), costEffect: isEffect,
		}
	}
	function isPlayerReference(value: unknown): boolean { return playerTarget(value) || record(value) && (value.ownerOf !== undefined ? object({ ownerOf: isSingleCardReference }, ['ownerOf'])(value) : object({ controllerOf: isSingleCardReference }, ['controllerOf'])(value)) }
	function isAbilityGrant(value: unknown): boolean {
		if (!record(value)) return false
		const fields = abilityFields()
		const duration = literal('combat', 'turn', 'source', 'nextEnding')
		if (value.copyFrom !== undefined) return object({ copyFrom: isQuery, fields: array(item => oneOf(item, new Set(Object.keys(fields)))), filter: object({ taps: boolean }), duration }, ['copyFrom'])(value)
		return object({ ...fields, duration })(value) && (Object.keys(fields).some(key => value[key] !== undefined) || invalid('granted abilities'))
	}
	function isCardData(value: unknown): value is CardData<V> {
		if (!record(value))
			return false
		cardDataValidators ??= object<CardData<V>>({
			id: string, name: string, types: strings, upgrade: string, restrictToLeader: string,
			description: string, manaTap: number, strength: number, attack: number, manaRecycle: number, colors: strings, image: string,
			ability: isCardEffect, attachDescription: string, strengthBonus: number, attackBonus: number, attach: isCardEffect,
			variants: stringRecord(string),
			copyLimit: value => value === null || count(value), playLimit: value => record(value) && validatePlayLimit(value),
		}, ['id', 'name', 'types', 'image'])
		return cardDataValidators(value)
	}
	function isExportedCardData(value: unknown): value is ExportedCardData<V> {
		return record(value) && isCardData(value) && required(value, ['description', 'strength', 'manaTap', 'manaRecycle', 'colors'])
	}
	const selectionFields = {
		timing: literal('target', 'privateChoice', 'resolutionChoice', 'programmatic'),
		constraints: (value: unknown) => record(value) && validateSelectionConstraints(value),
		locationSource: literal('event'), min: count, count: countAmount, cardTypeAreas: stringRecord(locationArea), costsThreshold: isCostContainer,
		allowsFacedown: trueValue,
	}
	function isEffectSelection(value: unknown): value is EffectSelection<V> {
		if (!record(value))
			return false
		effectSelectionValidators ??= object<EffectSelection<V>>({ ...selectionFields, paths: array(isEffect), remainder: trueValue, query: isQuery }, ['query'])
		return effectSelectionValidators(value) && (value.min === undefined || typeof value.count !== 'number' || (value.min as number) <= value.count || invalid('min <= count'))
	}
	function isZoneChanges(value: unknown): boolean {
		let moves = 0
		let discards = 0
		return array(change => {
			if (!record(change) || !validateZoneChange(change))
				return false
			if (change.placement !== undefined && change.to !== 'mainDeck')
				return invalid('placement only for mainDeck')
			if (change.event !== undefined && !(change.event === 'discard' && change.to === 'discard' || change.event === 'draw' && change.to === 'hand'))
				return invalid('event must match its draw or discard destination')
			if (change.timing !== undefined && (change.event !== 'discard' || change.source !== undefined && change.timing !== 'before'))
				return invalid('timing on discard events; sourced discards run before')
			if (change.source === undefined && (change.event === 'discard' ? ++discards : ++moves) > 1)
				return invalid('at most one unsourced move and one unsourced discard')
			return true
		})(value)
	}
	function isNaming(value: unknown): boolean { return record(value) && validateNaming(value) }
	const instructionValidators = Object.fromEntries(EFFECT_INSTRUCTION_KINDS.map(kind => [kind, isCardReference]))
	function isRouting(value: unknown): boolean { return record(value) && validateRouting(value) }
	function isEffect(value: unknown): value is EffectInstance<V> {
		if (!record(value))
			return false
		effectValidators ??= object(effectFields(), [])
		return effectValidators(value)
	}
	function effectFields(): FieldValidators<EffectInstance<V>> {
		return {
			endTurn: trueValue, replacePlay: trueValue,
			createCards: object({ from: isCardReference, to: cardLocation, duration: literal('source') }, ['from', 'to']),
			grantAbilities: isAbilityGrant,
			requirements: value => record(value) && validateEffectRequirements(value),
			flow: value => record(value) && validateFlow(value),
			choice: value => record(value) && (value.mode === 'effect' ? validateEffectChoice(value) : validateRevealedChoice(value)),
			routing: isRouting, naming: isNaming, cantBeChosen: isQuery,
			register: value => isDefinitions(value, true),
			modifierGrant: object({ query: isQuery, modifiers: array(isModifier), playTo: array(validatePlayTo), onPlayed: isEffect, uses: positiveCount, consumeOn: literal('finalized'), duration: literal('turn') }, ['query', 'modifiers', 'uses', 'consumeOn', 'duration']),
			singleRecipient: trueValue,
			play: value => record(value) && isPlay(value),
			siteToken: value => record(value) && (validateSiteToken(value) || validateRestoreSite(value)),
			costs: isCostContainer, addResource: isCostContainer, addBuff: amount,
			drawMana: value => record(value) && validateDrawMana(value),
			gainXP: countAmount, enhancement: literal('apply', 'remove'),
			damage: value => record(value) && validateDamage(value),
			draw: countAmount, lookAtFacedown: playerTarget,
			kills: value => value === true || record(value) && validateKillOptions(value),
			attaches: value => value === true || record(value) && validateAttachment(value),
			triggerRepeat: value => record(value) && validateTriggerRepeat(value),
			changeEffect: value => record(value) && validateChangeEffect(value),
			disablesEffect: modifierType, modifiers: array(value => isModifier(value, true)), passiveModifiers: array(isModifier),
			readies: value => record(value) && validateReadies(value),
			preScry: countAmount,
			reveal: value => record(value) && validateReveal(value),
			extraTurn: trueValue, banishes: trueValue, wins: trueValue,
			select: isEffectSelection,
			zoneChanges: isZoneChanges,
			selectLocation: value => record(value) && validateSelectLocation(value),
			targetQuery: isQuery,
			control: value => value === true || record(value) && validateControl(value),
			activateEffect: value => oneOf(value, EFFECT_KEYS),
			moves: value => value === true || record(value) && isMoves(value), heals: boolean, addPoints: amount,
			spawn: value => record(value) && validateSpawn(value),
			copySelection: value => record(value) && validateCopySelection(value),
			optional: trueValue,
		}
	}
	function isPlay(value: RecordValue): boolean {
		if (value.mode === 'copy')
			return validateCopyPlay(value)
		if (value.mode === 'replay')
			return validateReplay(value)
		return value.mode === undefined && validatePlay(value)
	}
	function isMoves(value: RecordValue): boolean { return validateMoves(value) }

	const validateStatAmount = object({ stat: value => oneOf(value, CARD_STATS), card: isSingleCardReference, previous: literal(true) }, ['stat', 'card'])
	const validatePaymentAmount = object({ payment: object({ cost: costType, group: string }, ['cost']) }, ['payment'])
	const conditionalGuards = { type: (value: unknown) => oneOf(value, CONDITIONAL_TYPES), unlessPaidAdditionalCost: boolean, not: boolean, eventPhase: (value: unknown) => oneOf(value, TURN_STEPS) }
	const conditionalFields = { ...conditionalGuards, min: amount, max: amount, compare: (value: unknown) => Array.isArray(value) ? array(isCompare)(value) : isCompare(value) }
	const validateConditionGroup = object({ ...conditionalGuards, conditional: array(isConditional) }, ['type', 'conditional'])
	const eventSubjectFields = { cardTypes: typeFilter, excludeCardTypes: strings, exclude: isCardReference, typesFrom: literal('current'), isAtSite: boolean }
	const eventQueryFields = { player: isPlayerReference, relation: playerTarget, role: literal('actor', 'subjectController'), phase: (value: unknown) => oneOf(value, TURN_STEPS), stage: literal('initiated'), paidCosts: isCostContainer }
	const validateEventSubject = object(eventSubjectFields)
	const validateEventQuery = object({ ...eventQueryFields, subject: validateEventSubject })
	const validateEventCountCondition = object({ ...conditionalFields, ...eventQueryFields, ...eventSubjectFields, event: (value: unknown) => oneOf(value, HISTORY_EVENTS), window: literal('turn') }, ['type', 'event'])
	const validateCardEventCount = object({ event: value => oneOf(value, HISTORY_EVENTS), card: isSingleCardReference, role: literal('source', 'subject'), window: literal('turn'), currentObject: trueValue }, ['event', 'card', 'role', 'window'])
	const validateQueryEventCount = object({ event: value => oneOf(value, HISTORY_EVENTS), query: validateEventQuery, window: literal('turn') }, ['event', 'query', 'window'])
	const validateEventCount = (value: RecordValue) => value.query !== undefined ? validateQueryEventCount(value) : validateCardEventCount(value)
	const validateCountAmount = object({ count: value => record(value) && value.event !== undefined ? validateEventCount(value) : record(value) && value.query !== undefined ? object({ query: isQuery, distinctTypes: strings, card: isSingleCardReference }, ['query'])(value) : isCardReference(value) }, ['count'])
	const validateAggregateAmount = object({ aggregate: object({ operation: literal('min', 'max', 'sum'), stat: value => oneOf(value, CARD_STATS), query: isQuery }, ['operation', 'stat', 'query']) }, ['aggregate'])
	const validateCurrentPlayerStat = object({ stat: value => oneOf(value, PLAYER_STATS), player: isPlayerReference }, ['stat', 'player'])
	const validateTurnPlayerStat = object({ stat: value => oneOf(value, PLAYER_TURN_STATS), player: isPlayerReference, window: literal('turn') }, ['stat', 'player', 'window'])
	const validatePlayerStatAmount = object({ playerStat: value => record(value) && (value.window === undefined ? validateCurrentPlayerStat(value) : validateTurnPlayerStat(value)) }, ['playerStat'])
	const validateGameStatAmount = object({ gameStat: object({ stat: value => oneOf(value, GAME_STATS) }, ['stat']) }, ['gameStat'])
	const validateSetupChoiceReference = object({ from: literal('setupChoice'), key: string, index: count }, ['from', 'key', 'index'])
	const validateSetupChoiceSetReference = object({ from: literal('setupChoice'), key: string }, ['from', 'key'])
	const validateLocationReference = object({ card: isSingleCardReference, previous: literal(true), selectionPlayer: literal('source') }, ['card'])
	const validateCardSource = object({ cards: isCardReference, area: locationArea }, ['cards'])
	const validateLocationSource = object({ location: isLocationReference, area: locationArea }, ['location'])
	const validateAreaSource = object({ area: locationArea }, ['area'])
	const validateQueryRequirement = object({ min: count, max: count, query: isQuery }, ['query'])
	const validateCountRequirement = object({ min: count, max: count, count: countAmount }, ['count'])
	const validateRequirement = (value: RecordValue) => value.count !== undefined ? validateCountRequirement(value) : validateQueryRequirement(value)
	const validateCompare = object({ operator: literal('<', '<=', '=', '!=', '>=', '>'), value: amount }, ['value'])
	const validatePlayPermission = object({
		from: cardLocation,
		cost: item => item === 'normal' || array(isCost)(item),
		exit: literal('normal', 'banished'), characteristic: string,
	}, ['from', 'cost', 'exit'])
	const validateCostCardReference = object({ from: literal('costSelection'), cost: costType, index: count, cardType: value => oneOf(value, CARD_TYPES) }, ['from', 'cost', 'index'])
	const validateSelectionCardReference = object({ from: literal('selection', 'previousSelection'), index: selectionIndex, cardType: value => oneOf(value, CARD_TYPES) }, ['from'])
	const validateCostCardSetReference = object({ from: literal('costSelection'), cost: costType, cardType: item => oneOf(item, CARD_TYPES) }, ['from', 'cost'])
	const validatePlayTo = object({
		action: literal('allow', 'disable'), scope: literal('base', 'sites', 'here'),
		conditionals: array(item => oneOf(item, SITE_CONDITIONALS) || isConditional(item)), exclusive: boolean,
		from: literal('anywhere'), costs: isCostContainer,
	}, ['action', 'scope'])
	const validatePlayLimit = object({ cardType: string, perTurn: count }, ['cardType', 'perTurn'])
	const validateSelectionConstraints = object({ locationRelation: literal('same', 'different'), maxPerLocation: count, playersByIndex: array(playerTarget) })
	const validateZoneChangeSource = object({ query: isQuery, count: countAmount }, ['query'])
	const validateZoneChange = object({
		to: literal('mainDeck', 'hand', 'manaDeck', 'discard', 'banished', 'chosen', 'base', 'manaCards'), placement: literal('top', 'bottom'), event: literal('discard', 'draw'), timing: literal('before', 'after'),
		source: item => record(item) && validateZoneChangeSource(item),
	}, ['to'])
	const validateNaming = object({ type: literal('cardName', 'type', 'tag'), cardTypes: strings }, ['type'])
	const validateRouting = object({ instructions: value => validateInstructions(value), affectingCard: literal('eventSubject'), subject: isCardReference, resolvingPlayer: literal('eventController', 'eventPlayer', 'selectedOwner', 'self', 'opponent'), repeatFor: literal('startFromMe', 'startFromNext', 'opponents', 'others') })
	const validateVictoryScoreRequirement = object({ amount: number, target: playerTarget, not: trueValue }, ['amount'])
	const validateSourceAreaRequirement = object({ area: locationArea, not: trueValue }, ['area'])
	const validateEffectRequirements = object({
		additionalCostPaid: trueValue, phase: value => oneOf(value, TURN_STEPS), turnPlayer: playerTarget,
		victoryScore: item => record(item) && validateVictoryScoreRequirement(item),
		sourceArea: item => record(item) && validateSourceAreaRequirement(item), cards: isRequirements,
	})
	const validateSequence = object({ timing: literal('sameResolution', 'nextResolution', 'newChain'), effect: isEffect }, ['effect'])
	const validateBranch = object({ success: isEffect, failure: isEffect })
	const validateFlow = object({
		sequence: item => record(item) && validateSequence(item),
		branch: item => record(item) && validateBranch(item), unless: isEffect,
		repeat: countAmount, forEach: object({ cards: isCardReference, order: literal('chosen'), effect: isEffect }, ['cards', 'order', 'effect']),
	})
	const validateRevealedOption = object({ match: string, effect: isEffect }, ['match', 'effect'])
	const validateSiteToken = object({ name: string, enter: trueValue }, ['name'])
	const validateRestoreSite = object({ restore: trueValue }, ['restore'])
	const validateDrawMana = object({ amount: countAmount, isReady: trueValue }, ['amount'])
	const validateDamage = object({ amount: damageAmount, distribution: literal('split'), reciprocal: trueValue }, ['amount'])
	const validateKillOptions = object({ canSave: literal(false), reason: string })
	const validateAttachment = object({ action: literal('attach', 'detach', 'toggle'), equipment: isSingleCardReference, holder: isSingleCardReference })
	const validateTriggerRepeat = object({ key: item => oneOf(item, EFFECT_KEYS), amount: countAmount }, ['key', 'amount'])
	const validateChangeEffect = object({ type: literal('redirect', 'disable'), destination: literal('hand', 'discard') }, ['type'])
	const validateReadies = object({ action: literal('ready', 'exhaust', 'toggle'), amount: countAmount }, ['action'])
	const validateReveal = object({ target: playerTarget, deck: value => oneOf(value, PLAYER_CARD_LOCATIONS), amount: countAmount, visibility: literal('private', 'public', 'selected'), until: value => oneOf(value, CARD_TYPES) }, ['deck'])
	const validateLocationConstraints = object({ locationRelation: literal('same', 'different') })
	const validateSelectLocation = object({ area: locationArea, query: isQuery, constraints: item => record(item) && validateLocationConstraints(item) }, ['area'])
	const validateControl = object({ duration: literal('turn', 'source'), returns: trueValue, recalls: trueValue })
	const validateSpawn = object({ name: string, baseStrength: count, to: item => locationArea(item) || item === 'lastLocation', count: item => countAmount(item) || item === 'eachOpponentLocation', statuses: array(literal('ready', 'temporary')) }, ['name'])
	const validateCopySelection = object({ source: isSingleCardReference, targets: isCardReference, duration: literal('attached') }, ['source', 'targets'])
	const validateCopyPlay = object({ mode: literal('copy'), subject: isSingleCardReference, copies: countAmount }, ['mode', 'subject', 'copies'])
	const validateReplay = object({ mode: literal('replay'), subject: isSingleCardReference, costs: isCostContainer, sourceArea: locationArea, exit: literal('banished') }, ['mode', 'subject'])
	const validatePlayDestination = object({ area: locationArea, cardTypes: typeFilter }, ['area'])
	const validatePlayPaymentOptions = object({ waive: array(costType), costReduction: array(item => isCost(item)) })
	const validatePlayPayment = (value: unknown) => boolean(value) || record(value) && validatePlayPaymentOptions(value) && (value.waive !== undefined || value.costReduction !== undefined || invalid('waive or costReduction'))
	const validatePlay = object({ subject: isCardReference, payment: validatePlayPayment, controller: literal('owner'), destinations: array(item => locationArea(item) || item === 'lastLocation'), destination: item => locationArea(item) || item === 'lastLocation' || record(item) && validatePlayDestination(item) }, ['subject'])
	const costFields = { type: costType, minimumCost: number, matching: strings, conditional: array(isConditional), query: isQuery, multiplier: amount }
	const validateCost = object({ ...costFields, amount: costAmount }, ['type'])
	const validateResolvedCost = object({ ...costFields, amount: number }, ['type', 'amount'])
	const arithmeticOperand = (value: unknown) => amount(value) || oneOf(value, DAMAGE_AMOUNTS)
	const validateAmountCalculation = object({ operation: literal('add', 'subtract', 'multiply'), left: arithmeticOperand, right: arithmeticOperand, minimum: number }, ['operation', 'left', 'right'])
	const validateCalculationAmount = object({ calculation: isAmountCalculation }, ['calculation'])
	const validateInstructions = object(instructionValidators)
	const validateEffectChoice = object({ mode: literal('effect'), timing: literal('target', 'resolutionChoice'), options: array(isEffect), count, min: count, distinct: trueValue, usage: literal('oncePerTurn') }, ['mode', 'options'])
	const validateRevealedChoice = object({ mode: literal('revealed'), options: array(validateRevealedOption) }, ['mode', 'options'])
	const validateMoves = object({ type: literal('recall', 'swap'), to: (value: unknown) => locationArea(value) || isLocationReference(value), payCosts: trueValue, onFailure: literal('killTarget') })
	return {
		validateCard: (value: unknown, root?: string) => validate(value, isExportedCardData, root),
		validateEffect: (value: unknown, root?: string) => validate(value, isEffect, root),
		actionWindow,
		selectionFields: Object.freeze(selectionFields),
		amount,
		cardLocation,
		cardLocations,
		cardStatAmount,
		costAmount,
		costType,
		countAmount,
		damageAmount,
		effectPath,
		isCardData,
		isCardEffect,
		isCardReference,
		isCompare,
		isCompareValue: amount,
		isConditional,
		isCost,
		isCostContainer,
		isDefinition,
		isDefinitions,
		isEffect,
		isEffectSelection,
		isExportedCardData,
		isLocationReference,
		isModifier,
		isAmountCalculation,
		isMoves,
		isNaming,
		isPlay,
		isPlayPermission,
		isPlayTo,
		isQuery,
		isRelations,
		isRequirement,
		isRequirements,
		isRouting,
		isSingleCardReference,
		isSource,
		isZoneChanges,
		locationArea,
		modifierType,
		playerTarget,
	}
}
