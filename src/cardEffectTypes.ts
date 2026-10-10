import type { CardEffectVocabulary, DefaultVocabulary, INFINITY_COST, EACH_OPPONENT_LOCATION } from './cardEffectVocabulary.ts'
// Serialized card/effect output contract. No game engine or application dependencies.
export type TurnStepState<V extends CardEffectVocabulary = DefaultVocabulary> = V['TURN_STEPS'][number]
export type CostSourceType = 'cardPlay' | 'activatedAbility' | 'effect'
export type SiteLocation = `site-${number}`
export type InPlayLocation = 'mainCards' | SiteLocation
export type PlayableLocation = 'hand' | 'chosen'
export type PlayLocation = InPlayLocation | PlayableLocation | 'manaCards'
export type CardLocation<V extends CardEffectVocabulary = DefaultVocabulary> = Exclude<V['CARD_LOCATIONS'][number], 'site-*'> | ('site-*' extends V['CARD_LOCATIONS'][number] ? SiteLocation : never)
export type PlayerCardsLocation<V extends CardEffectVocabulary = DefaultVocabulary> = V['PLAYER_CARD_LOCATIONS'][number]
export type EffectsKey<V extends CardEffectVocabulary = DefaultVocabulary> = V['EFFECT_KEYS'][number]
export type EffectRuleKey<V extends CardEffectVocabulary = DefaultVocabulary> = V['EFFECT_RULE_KEYS'][number]
export type EffectActionKey<V extends CardEffectVocabulary = DefaultVocabulary> = Exclude<EffectsKey<V>, EffectRuleKey<V>>
export type SiteConditional<V extends CardEffectVocabulary = DefaultVocabulary> = V['SITE_CONDITIONALS'][number]
export type PlayToConditional<V extends CardEffectVocabulary = DefaultVocabulary> = SiteConditional<V> | CardConditional<V>
export interface PlayToRule<V extends CardEffectVocabulary = DefaultVocabulary> {
	action: 'allow' | 'disable'
	scope: 'base' | 'sites' | 'here'
	conditionals?: PlayToConditional<V>[]
	exclusive?: boolean
}
export interface MoveToRule<V extends CardEffectVocabulary = DefaultVocabulary> extends PlayToRule<V> {
	from?: 'anywhere'
	costs?: EffectCostContainer<V>
}
export type EffectUsage = 'oncePerTurn'
export type CombatRole = 'attacking' | 'defending'
export interface EffectConditions<V extends CardEffectVocabulary = DefaultVocabulary> {
	/** Current turn phase, independent of the checked card's last event phase. */
	phase?: TurnStepState<V>
	initiatingPlayer?: EffectPlayerReference<V>
	turnPlayer?: PlayerTarget<V>
	sourceArea?: LocationArea<V>
	targetQuery?: CardSetQuery<V>
	targetFromArea?: LocationArea<V>
	targetNotFromArea?: LocationArea<V>
	costSource?: CostSourceType
	combatRole?: CombatRole
	eventSourceQuery?: CardSetQuery<V>
	costsThreshold?: EffectCostContainer<V>
	conditionalsSource?: CardConditional<V>[]
	conditionalsTarget?: CardConditional<V>[]
}
export interface EffectPolicy<V extends CardEffectVocabulary = DefaultVocabulary> {
	activationScope?: 'sameLocation'
	/** Who may activate this ability; defaults to its controller. */
	activationPlayers?: 'controller' | 'turnPlayer' | 'all'
	taps?: boolean
	actionWindows?: ActionWindow<V>[]
	costs?: EffectCostContainer<V>[]
	repeatCosts?: EffectCostContainer<V>[]
	playTo?: PlayToRule<V>[]
	moveTo?: MoveToRule<V>[]
	timing?: 'playFinalization'
	usage?: EffectUsage
	usageGroup?: string
	duplicates?: EffectsKey<V>
	eventMultiplicity?: 'perObject' | 'perBatch'
	attachedThisTurn?: boolean
	consumes?: boolean
	/** Temporary registered trigger lifetime and bounded uses. */
	duration?: EffectDuration
	remainingUses?: number
	usagePerPlayer?: true
	minimumEventAmount?: number
}
export interface EffectDefinition<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> extends EffectConditions<V>, EffectPolicy<V> {
	captureTargets?: true
	effect?: Effect
}
export interface EffectActionDefinition<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> extends EffectDefinition<V, Effect> {
	effect: Effect
}
export type EffectDefinitionsByKey<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> = {
	[Key in EffectsKey<V>]?: (Key extends EffectActionKey<V> ? EffectActionDefinition<V, Effect> : EffectDefinition<V, Effect>)[]
}
export interface CardData<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> {
	id: string
	name: string
	types: string[]
	upgrade?: string
	restrictToLeader?: string
	description?: string
	manaTap?: number
	strength?: number
	attack?: number
	manaRecycle?: number
	colors?: string[]
	image: string
	ability?: CardEffectData<V, Effect>
	attachDescription?: string
	strengthBonus?: number
	attackBonus?: number
	attach?: CardEffectData<V, Effect>
	variants?: Record<string, string>
	copyLimit?: number | null
	playLimit?: {
		cardType: string
		perTurn: number
	}
}
/** Complete serialized card definition; runtime placeholders may use CardData. */
export interface ExportedCardData<V extends CardEffectVocabulary = DefaultVocabulary> extends CardData<V> {
	description: string
	strength: number
	manaTap: number
	manaRecycle: number
	colors: string[]
}
/** Reusable behavior carried by a card or granted to another card. */
export interface AbilitySet<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> {
	effects?: EffectDefinitionsByKey<V, Effect>
	playModifiers?: CardModifier<V>[]
	repeatCosts?: EffectCostContainer<V>[]
	actionWindows?: ActionWindow<V>[]
	buffLimit?: number | null
	enhancementLimit?: number
	canFacedown?: boolean
	activatableEffects?: EffectActionDefinition<V, Effect>[]
	additionalCosts?: EffectCostContainer<V>[]
	costEffect?: Effect
}
export interface CardEffectData<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> extends AbilitySet<V, Effect> {
	/** Named pools chosen from card definitions before play, owned by the declaring player. */
	/** `count` is the most definitions the player may choose; they may choose fewer. */
	setupChoices?: Record<string, { query: CardSetQuery<V>; count: number; distinctNames?: true; excludeStarting?: true; ifInDeck?: CardSetQuery<V> }>
}
export type EffectPlayerReference<V extends CardEffectVocabulary = DefaultVocabulary> = PlayerTarget<V> | { ownerOf: EffectSingleCardReference<V> } | { controllerOf: EffectSingleCardReference<V> }
/** Inline behavior or a live view of queried cards' behavior; filtering never checks activation availability. */
export type AbilityGrant<V extends CardEffectVocabulary = DefaultVocabulary> = ((AbilitySet<V> & { copyFrom?: never; fields?: never; filter?: never }) | ({
	copyFrom: CardSetQuery<V>
	fields?: (keyof AbilitySet<V>)[]
	filter?: { taps?: boolean }
} & Partial<Record<keyof AbilitySet<V>, never>>)) & { duration?: EffectDuration }
export type ActionWindow<V extends CardEffectVocabulary = DefaultVocabulary> = V['ACTION_WINDOWS'][number]
/** Opaque permission tag interpreted by the consuming engine. */
export type PlayPermissionCharacteristic = string
export interface PlayPermission<V extends CardEffectVocabulary = DefaultVocabulary> {
	from: CardLocation<V>
	cost: 'normal' | EffectCost<V>[]
	exit: 'normal' | 'banished'
	characteristic?: PlayPermissionCharacteristic
}
export type CardModifierType<V extends CardEffectVocabulary = DefaultVocabulary> = V['MODIFIER_TYPES'][number]
export type AbilityProcedure = 'costPayment' | 'combatDamageAssignment'
export type CompareOperator = '<' | '<=' | '=' | '!=' | '>=' | '>'
export interface CardConditionalCompare<V extends CardEffectVocabulary = DefaultVocabulary> {
	operator?: CompareOperator
	value: AmountExpression<V>
}
export type CardConditionalType<V extends CardEffectVocabulary = DefaultVocabulary> = V['CONDITIONAL_TYPES'][number]
interface CardConditionalFields<V extends CardEffectVocabulary = DefaultVocabulary> {
	min?: AmountExpression<V>
	max?: AmountExpression<V>
	compare?: CardConditionalCompare<V> | CardConditionalCompare<V>[]
	unlessPaidAdditionalCost?: boolean
	not?: boolean
	eventPhase?: TurnStepState<V>
}
/** Event counts expose occurrence filters directly; numeric amounts remain available for composition. */
export type EventCountConditionFields<V extends CardEffectVocabulary = DefaultVocabulary> = Omit<EventQuery<V>, 'subject'> & EventSubjectFilter<V> & {
	event: V['HISTORY_EVENTS'][number]
	/** Current turn by default. */
	window?: 'turn'
}
/** Numeric and event conditions share bounds, inversion and payment bypass. */
export type CardConditional<V extends CardEffectVocabulary = DefaultVocabulary> = CardConditionalFields<V> & (
	{ type: Exclude<CardConditionalType<V>, 'amount' | 'eventCount' | 'all' | 'any'>; amount?: never }
	| { type: Extract<CardConditionalType<V>, 'amount'>; amount: AmountExpression<V> }
	| ({ type: Extract<CardConditionalType<V>, 'eventCount'>; amount?: never } & EventCountConditionFields<V>)
	| { type: Extract<CardConditionalType<V>, 'all' | 'any'>; conditional: CardConditional<V>[]; amount?: never; min?: never; max?: never; compare?: never }
)
export interface CardModifier<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: CardModifierType<V>
	/** Runtime ordering metadata; generated card definitions leave this unset. */
	timestamp?: number
	amount?: AmountExpression<V>
	duration?: EffectDuration
	cardType?: CardType<V>
	consumes?: boolean
	didConsume?: boolean
	costs?: EffectCostContainer<V>
	conditional?: CardConditional<V>[]
	requiresCards?: CardSetRequirement<V> | CardSetRequirement<V>[]
	/** Floor on the resulting numeric stat, distinct from a calculation's amount clamp. */
	minimum?: number
	ifNotAlready?: boolean
	reducesCombatAssignment?: boolean
	replacementEffects?: ('stun' | 'negativeStrength' | 'returnToHand')[]
	ignoredAbility?: CardModifierType<V>
	ignoredProcedure?: AbilityProcedure
	targetPlayers?: PlayerTarget<V>
	oncePerSource?: boolean
	replaceID?: string
	sourceCardID?: string
	playPermission?: PlayPermission<V>
	/** String payload interpreted by the modifier kind; adds one type or action window. */
	value?: string
}
export type PlayerTarget<V extends CardEffectVocabulary = DefaultVocabulary> = V['PLAYER_TARGETS'][number]
export type CostType<V extends CardEffectVocabulary = DefaultVocabulary> = V['COST_TYPES'][number]
export type CostOptionality = 'optional' | 'replaces'
export type LocationArea<V extends CardEffectVocabulary = DefaultVocabulary> = V['LOCATION_AREAS'][number]
export type CardType<V extends CardEffectVocabulary = DefaultVocabulary> = V['CARD_TYPES'][number]
/** Outer alternatives are OR; each nested list requires all of its types (AND). */
export type CardTypeFilter<V extends CardEffectVocabulary = DefaultVocabulary> = Array<CardType<V> | string | Array<CardType<V> | string>>
export type EffectDuration = 'combat' | 'turn' | 'source' | 'nextEnding' | undefined
export type NamingType = 'cardName' | 'type' | 'tag'
export interface Naming<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: NamingType
	cardTypes?: (CardType<V> | string)[]
}
export type CardRelationType<V extends CardEffectVocabulary = DefaultVocabulary> = V['CARD_RELATION_TYPES'][number]
export type CardRelations<V extends CardEffectVocabulary = DefaultVocabulary> = Partial<Record<CardRelationType<V>, CardSetRequirement<V> | CardSetRequirement<V>[]>>
export interface CardStatAmount<V extends CardEffectVocabulary = DefaultVocabulary> {
	stat: V['CARD_STATS'][number]
	card: EffectSingleCardReference<V>
	previous?: true
}
/** Match recorded subject metadata; only type filtering may explicitly read the current card. */
export interface EventSubjectFilter<V extends CardEffectVocabulary = DefaultVocabulary> {
	cardTypes?: CardTypeFilter<V>
	excludeCardTypes?: (CardType<V> | string)[]
	exclude?: EffectCardReference<V>
	typesFrom?: 'current'
	isAtSite?: boolean
}
/** Select recorded occurrences independently of today's card zones and controllers. */
export interface EventQuery<V extends CardEffectVocabulary = DefaultVocabulary> {
	/** Defaults to the checked card's controller ({ controllerOf: 'recipient' }). */
	player?: EffectPlayerReference<V>
	/** Relationship to the referenced player, defaulting to self. */
	relation?: PlayerTarget<V>
	/** Match the event's actor by default; deaths may explicitly match subjectController. */
	role?: 'actor' | 'subjectController'
	subject?: EventSubjectFilter<V>
	phase?: TurnStepState<V>
	/** Completed occurrences by default; initiated includes pending and completed attempts once each. */
	stage?: 'initiated'
	paidCosts?: EffectCostContainer<V>
}
export interface CardEventCount<V extends CardEffectVocabulary = DefaultVocabulary> {
	event: V['HISTORY_EVENTS'][number]
	card: EffectSingleCardReference<V>
	role: 'source' | 'subject'
	window: 'turn'
	/** Restrict history to the referenced card's current game object, after its latest identity reset. */
	currentObject?: true
	query?: never
}
export interface QueryEventCount<V extends CardEffectVocabulary = DefaultVocabulary> {
	event: V['HISTORY_EVENTS'][number]
	query: EventQuery<V>
	window: 'turn'
	card?: never
	role?: never
	currentObject?: never
}
/** Count either occurrences involving a physical card or occurrences matching recorded metadata. */
export type EventCount<V extends CardEffectVocabulary = DefaultVocabulary> = CardEventCount<V> | QueryEventCount<V>
/** Current player state or a numeric total in the current turn, including another player's turn. */
export type PlayerStatAmount<V extends CardEffectVocabulary = DefaultVocabulary> = {
	player: EffectPlayerReference<V>
} & (
	{ stat: V['PLAYER_STATS'][number]; window?: never }
	| { stat: V['PLAYER_TURN_STATS'][number]; window: 'turn' }
)
export type DynamicAmount<V extends CardEffectVocabulary = DefaultVocabulary> =
	| CardStatAmount<V>
	| { payment: { cost: CostType<V>; group?: string } }
	| { count: EffectCardReference<V> | { query: CardSetQuery<V>; distinctTypes?: (CardType<V> | string)[]; card?: EffectSingleCardReference<V> } | EventCount<V> }
	| { aggregate: { operation: 'min' | 'max' | 'sum'; stat: V['CARD_STATS'][number]; query: CardSetQuery<V> } }
	| { playerStat: PlayerStatAmount<V> }
	| { gameStat: { stat: V['GAME_STATS'][number] } }
	| { calculation: AmountCalculation<V> }
export type CoreAmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = V['CORE_AMOUNTS'][number] | DynamicAmount<V>
export type DamageAmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = V['DAMAGE_AMOUNTS'][number] | DynamicAmount<V>
export type AmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = CoreAmountReference<V> | DamageAmountReference<V> | typeof EACH_OPPONENT_LOCATION
export type AmountExpression<V extends CardEffectVocabulary = DefaultVocabulary, Reference extends AmountReference<V> = CoreAmountReference<V>> = number | Reference
export type CountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V>
export type CostAmountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V> | typeof INFINITY_COST
export type CostMultiplier<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V>
export type DamageAmountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V, DamageAmountReference<V>>
export type SpawnCountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = CountExpression<V> | typeof EACH_OPPONENT_LOCATION
export interface EffectCostDefinition<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: CostType<V>
	minimumCost?: number
	matching?: string[]
	conditional?: CardConditional<V>[]
	query?: CardSetQuery<V>
}
export interface EffectCost<V extends CardEffectVocabulary = DefaultVocabulary> extends EffectCostDefinition<V> {
	amount?: CostAmountExpression<V>
	multiplier?: CostMultiplier<V>
}
export interface EffectCostContainer<V extends CardEffectVocabulary = DefaultVocabulary, Cost extends EffectCostDefinition<V> = EffectCost<V>> {
	costs: Cost[]
	timing?: 'resolution'
	kind?: 'payment'
	cardTypes?: (CardType<V> | string)[]
	conditionals?: CardConditional<V>[]
	/** Restrict payment to a configured current turn phase. */
	phase?: TurnStepState<V>
	groupNames?: string[]
	playPermissionCharacteristics?: PlayPermissionCharacteristic[]
	chooseOne?: true
	optionality?: CostOptionality
	facedown?: true
	selectArea?: LocationArea<V>
	costReduction?: Cost[]
}
export interface EffectLocationReference<V extends CardEffectVocabulary = DefaultVocabulary> {
	card: EffectSingleCardReference<V>
	previous?: true
	selectionPlayer?: 'source'
}
export type CardSetSource<V extends CardEffectVocabulary = DefaultVocabulary> = {
	area: LocationArea<V>
	cards?: undefined
	location?: undefined
} | {
	cards: EffectCardReference<V>
	area?: LocationArea<V>
	location?: undefined
} | {
	location: EffectLocationReference<V>
	area?: LocationArea<V>
	cards?: undefined
}
export interface CardSetQuery<V extends CardEffectVocabulary = DefaultVocabulary> {
	exclude?: EffectCardReference<V>
	excludeLocation?: LocationArea<V> | EffectLocationReference<V>
	source?: CardSetSource<V>
	cardTypes?: CardTypeFilter<V>
	names?: string[]
	named?: NamingType
	colors?: string[]
	excludeCardTypes?: (CardType<V> | string)[]
	/** Filters candidate controllers independently of where candidates come from. */
	players?: PlayerTarget<V>
	conditional?: CardConditional<V>[]
	isAtSite?: true
	includeSites?: true
	chosen?: true
	siteControl?: true
	includeSource?: true
	hasModifier?: CardModifierType<V>
	requiredActionWindow?: ActionWindow<V>
	relations?: CardRelations<V>
	isFacedown?: true
	siteController?: 'selected' | 'open' | 'opponent' | 'self'
}
export type EffectSelectionTiming = 'target' | 'privateChoice' | 'resolutionChoice' | 'programmatic'
/** Bounds on matching instances, or an explicitly computed count. */
export type CardSetRequirement<V extends CardEffectVocabulary = DefaultVocabulary> = {
	min?: number
	max?: number
} & ({ query: CardSetQuery<V>; count?: never } | { count: CountExpression<V>; query?: never })
export type RepeatPlayerRef = 'startFromMe' | 'startFromNext' | 'opponents' | 'others'
/** A scalar input: named card or selected entry; cost/setup selections require an index to distinguish a card from the whole set. */
export type EffectSingleCardReference<V extends CardEffectVocabulary = DefaultVocabulary> = 'effectSource' | 'affectingCard' | 'eventSubject' | 'effectTarget' | 'recipient' | {
	from: 'setupChoice'
	key: string
	index: number
} | {
	from: 'selection' | 'previousSelection'
	/** Array.at index: negative indexes count backward from the end. */
	index?: number
	cardType?: CardType<V>
} | {
	from: 'costSelection'
	cost: CostType<V>
	index: number
	cardType?: CardType<V>
}
export type EffectCardSetReference<V extends CardEffectVocabulary = DefaultVocabulary> = EffectSingleCardReference<V> | 'affected' | 'selection' | 'previousSelection' | {
	from: 'setupChoice'
	key: string
	index?: undefined
} | {
	from: 'costSelection'
	cost: CostType<V>
	index?: undefined
	cardType?: CardType<V>
}
/** Instruction recipients may be one set or the deduplicated union of several sets. */
export type EffectCardReference<V extends CardEffectVocabulary = DefaultVocabulary> = EffectCardSetReference<V> | EffectCardSetReference<V>[]
export type EffectInstructionKind<V extends CardEffectVocabulary = DefaultVocabulary> = V['EFFECT_INSTRUCTION_KINDS'][number]
export interface EffectRouting<V extends CardEffectVocabulary = DefaultVocabulary> {
	/** Override instruction recipients. Non-swap moves with a selection default to that selection; other instructions default to affected cards. */
	instructions?: Partial<Record<EffectInstructionKind<V>, EffectCardReference<V>>>
	affectingCard?: 'eventSubject'
	subject?: EffectCardReference<V>
	/** `eventPlayer` is the player the triggering event is about: its performer, or the turn player for phase events. */
	resolvingPlayer?: 'eventController' | 'eventPlayer' | 'selectedOwner' | 'self' | 'opponent'
	repeatFor?: RepeatPlayerRef
}
export interface EffectSequence<V extends CardEffectVocabulary = DefaultVocabulary> {
	timing?: 'sameResolution' | 'nextResolution' | 'newChain'
	effect: EffectInstance<V>
}
export interface EffectFlow<V extends CardEffectVocabulary = DefaultVocabulary> {
	sequence?: EffectSequence<V>
	branch?: {
		success?: EffectInstance<V>
		failure?: EffectInstance<V>
	}
	unless?: EffectInstance<V>
	repeat?: CountExpression<V>
	forEach?: { cards: EffectCardReference<V>; order: 'chosen'; effect: EffectInstance<V> }
}
export type EffectChoice<V extends CardEffectVocabulary = DefaultVocabulary> = {
	timing?: 'target' | 'resolutionChoice'
	mode: 'effect'
	options: EffectInstance<V>[]
	/** Maximum number of choices; omitted count defaults to one. */
	count?: number
	/** Minimum number of choices; omitted minimum requires the full count. */
	min?: number
	distinct?: true
	/** Each option has its own usage history within this choice. */
	usage?: EffectUsage
} | {
	mode: 'revealed'
	options: {
		match: string
		effect: EffectInstance<V>
	}[]
}
/** Policy for normal card-play costs; additional costs retain their ordinary rules. */
export type EffectPlayPayment<V extends CardEffectVocabulary = DefaultVocabulary> = boolean | {
	waive?: CostType<V>[]
	costReduction?: EffectCost<V>[]
}
export type EffectPlay<V extends CardEffectVocabulary = DefaultVocabulary> = {
	subject: EffectCardReference<V>
	mode?: undefined
	/** Omitted or false waives normal costs; true pays them. */
	payment?: EffectPlayPayment<V>
	controller?: 'owner'
	destinations?: (LocationArea<V> | 'lastLocation')[]
	destination?: LocationArea<V> | 'lastLocation' | {
		area: LocationArea<V>
		cardTypes?: CardTypeFilter<V>
	}
} | {
	subject: EffectSingleCardReference<V>
	mode: 'replay'
	costs?: EffectCostContainer<V>
	sourceArea?: LocationArea<V>
	/** Where the replayed card goes when it would leave the chain or board; omitted is normal. */
	exit?: 'banished'
} | {
	subject: EffectSingleCardReference<V>
	mode: 'copy'
	copies: CountExpression<V>
}
export interface EffectZoneChangeSource<V extends CardEffectVocabulary = DefaultVocabulary> {
	query: CardSetQuery<V>
	count?: CountExpression<V>
}
/** Each effect has at most one unsourced move and one unsourced discard; use flow.sequence for successive operations. */
export type EffectZoneChange<V extends CardEffectVocabulary = DefaultVocabulary> = {
	to: 'mainDeck'
	placement?: 'top' | 'bottom'
	event?: never
	timing?: never
	source?: EffectZoneChangeSource<V>
} | {
	to: 'hand' | 'manaDeck' | 'discard' | 'banished' | 'chosen' | 'base' | 'manaCards'
	placement?: never
	event?: never
	timing?: never
	source?: EffectZoneChangeSource<V>
} | {
	to: 'hand'
	/** Drawing a specified inspected card retains draw events. */
	event: 'draw'
	placement?: never
	timing?: never
	source?: EffectZoneChangeSource<V>
} | {
	to: 'discard'
	event: 'discard'
	placement?: never
	timing?: 'before' | 'after'
	source?: never
} | {
	to: 'discard'
	event: 'discard'
	placement?: never
	timing?: 'before'
	source: EffectZoneChangeSource<V>
}
/** Arithmetic shared by all amount consumers; minimum clamps the result. */
export interface AmountCalculation<V extends CardEffectVocabulary = DefaultVocabulary> {
	operation: 'add' | 'subtract' | 'multiply'
	left: AmountExpression<V, CoreAmountReference<V> | DamageAmountReference<V>>
	right: AmountExpression<V, CoreAmountReference<V> | DamageAmountReference<V>>
	minimum?: number
}
interface EffectModifierBase<V extends CardEffectVocabulary = DefaultVocabulary> extends Omit<CardModifier<V>, 'amount'> {
	/** Player rules apply to later arrivals too; omitted scope modifies only the resolved cards. */
	scope?: 'players'
	subject?: EffectCardReference<V>
}
/** A literal/default value or amount expression, or a copied modifier value. */
export type EffectModifier<V extends CardEffectVocabulary = DefaultVocabulary> = EffectModifierBase<V> & ({
	amount?: AmountExpression<V>
	copyFrom?: never
} | {
	copyFrom: EffectSingleCardReference<V>
	amount?: never
})
export interface EffectKillOptions {
	canSave?: false
	reason?: string
}
export interface EffectAttachment<V extends CardEffectVocabulary = DefaultVocabulary> {
	action?: 'attach' | 'detach' | 'toggle'
	equipment?: EffectSingleCardReference<V>
	holder?: EffectSingleCardReference<V>
}
export interface EffectMoves<V extends CardEffectVocabulary = DefaultVocabulary> {
	type?: 'recall' | 'swap'
	/** Ordinary move destination; recall always uses the card's current player's base. */
	to?: LocationArea<V> | EffectLocationReference<V>
	payCosts?: true
	onFailure?: 'killTarget'
}
export interface EffectReadies<V extends CardEffectVocabulary = DefaultVocabulary> {
	action: 'ready' | 'exhaust' | 'toggle'
	amount?: CountExpression<V>
}
export type LocationRelation = 'same' | 'different'
export interface EffectSelection<V extends CardEffectVocabulary = DefaultVocabulary> {
	timing?: EffectSelectionTiming
	paths?: EffectInstance<V>[]
	remainder?: true
	query: CardSetQuery<V>
	constraints?: {
		locationRelation?: LocationRelation
		maxPerLocation?: number
		playersByIndex?: PlayerTarget<V>[]
	}
	locationSource?: 'event'
	min?: number
	count?: CountExpression<V>
	cardTypeAreas?: Record<string, LocationArea<V>>
	costsThreshold?: EffectCostContainer<V>
	allowsFacedown?: true
}
export interface EffectInstance<V extends CardEffectVocabulary = DefaultVocabulary> {
	/** Keep this effect's modifier bundle on one recipient per source instance and effect identity. A new recipient replaces the previous bundle. */
	singleRecipient?: true
	endTurn?: true
	/** Replace the pending token play rather than add an extra token. */
	replacePlay?: true
	/** Create distinct card instances from selected definitions without moving those definitions. */
	createCards?: { from: EffectCardReference<V>; to: CardLocation<V>; duration?: 'source' }
	/** Add inline or copied behavior evaluated from each receiving card, with provider provenance and an independent lifetime. */
	grantAbilities?: AbilityGrant<V>
	requirements?: {
		additionalCostPaid?: true
		phase?: TurnStepState<V>
		turnPlayer?: PlayerTarget<V>
		victoryScore?: {
			amount: number
			target?: PlayerTarget<V>
			not?: true
		}
		sourceArea?: {
			area: LocationArea<V>
			not?: true
		}
		cards?: CardSetRequirement<V> | CardSetRequirement<V>[]
	}
	flow?: EffectFlow<V>
	choice?: EffectChoice<V>
	routing?: EffectRouting<V>
	naming?: Naming<V>
	cantBeChosen?: CardSetQuery<V>
	register?: Partial<Record<EffectsKey<V>, EffectActionDefinition<V>[]>>
	/** Grant modifiers before payment; spend one use when a matching play finalizes. */
	modifierGrant?: { query: CardSetQuery<V>; modifiers: CardModifier<V>[]; playTo?: PlayToRule<V>[]; onPlayed?: EffectInstance<V>; uses: number; consumeOn: 'finalized'; duration: 'turn' }
	play?: EffectPlay<V>
	siteToken?: {
		name: string
		enter?: true
	} | {
		restore: true
	}
	costs?: EffectCostContainer<V>
	addResource?: EffectCostContainer<V>
	addBuff?: AmountExpression<V>
	drawMana?: {
		amount: CountExpression<V>
		isReady?: true
	}
	gainXP?: CountExpression<V>
	enhancement?: 'apply' | 'remove'
	damage?: {
		amount: DamageAmountExpression<V>
		/** Allocate this total among selected recipients, applying the allocations simultaneously. */
		distribution?: 'split'
		reciprocal?: true
	}
	draw?: CountExpression<V>
	lookAtFacedown?: PlayerTarget<V>
	kills?: true | EffectKillOptions
	attaches?: true | EffectAttachment<V>
	triggerRepeat?: {
		key: EffectsKey<V>
		amount: CountExpression<V>
	}
	changeEffect?: {
		type: 'redirect' | 'disable'
		destination?: 'hand' | 'discard'
	}
	disablesEffect?: CardModifierType<V>
	modifiers?: EffectModifier<V>[]
	passiveModifiers?: CardModifier<V>[]
	readies?: EffectReadies<V>
	preScry?: CountExpression<V>
	reveal?: {
		target?: PlayerTarget<V>
		deck: PlayerCardsLocation<V>
		amount?: CountExpression<V>
		visibility?: 'private' | 'public' | 'selected'
		until?: CardType<V>
	}
	extraTurn?: true
	banishes?: true
	wins?: true
	select?: EffectSelection<V>
	zoneChanges?: EffectZoneChange<V>[]
	selectLocation?: {
		area: LocationArea<V>
		query?: CardSetQuery<V>
		constraints?: {
			locationRelation?: LocationRelation
		}
	}
	targetQuery?: CardSetQuery<V>
	control?: true | {
		duration?: 'turn' | 'source'
		returns?: true
		/** Recall to the card's current player's base after control and any exhaust instruction. */
		recalls?: true
	}
	activateEffect?: EffectsKey<V>
	moves?: true | EffectMoves<V>
	heals?: boolean
	addPoints?: AmountExpression<V>
	spawn?: {
		name: string
		to?: LocationArea<V> | 'lastLocation'
		baseStrength?: number
		count?: SpawnCountExpression<V>
		statuses?: ('ready' | 'temporary')[]
	}
	copySelection?: {
		source: EffectSingleCardReference<V>
		targets: EffectCardReference<V>
		duration?: 'attached'
	}
	optional?: true
}
export interface CardRoles {
	resource?: string
	leader?: string
	site?: string
	/** Cards with this type are played only to sites by default. Not a deck role. */
	siteOnly?: string
}
export type CardRole = keyof CardRoles
export interface ConfigGameCards<V extends CardEffectVocabulary = DefaultVocabulary> {
	sourceUrl?: string
	hash?: string | undefined
	name: string
	version: string
	sets: Record<string, string>
	banned?: Record<string, string> | undefined
	colors: {
		[name: string]: string
		mainDeck: string
		manaDeck: string
	}
	terminology: Record<string, string>
	cardRoles?: CardRoles
	rules?: ConfigGameRules
	layout?: {
		compactCardHeight?: string | undefined
	} | undefined
	defaultMode?: ConfigGameMode | undefined
	defaultDecks?: ConfigGameDeck[] | undefined
	cards: CardData<V>[]
}
export interface ExportedGameCards<V extends CardEffectVocabulary = DefaultVocabulary> extends ConfigGameCards<V> {
	cards: ExportedCardData<V>[]
}
export interface ConfigGameDeck {
	sourceUrl?: string
	hash?: string | undefined
	name: string
	gameName: string
	cards: string
	sideboard?: string | undefined
}
export interface ConfigGameMode {
	sourceUrl?: string
	sets?: Record<string, string> | undefined
	hash?: string | undefined
	gameName: string
	name: string
	version: string
	players: number
	games?: number | undefined
	teamSize?: number | undefined
	points: number
	leaders?: 0 | 1 | undefined
	chosens?: number | undefined
	colorLimit?: number
	sites?: ConfigGameSite | undefined
	sideboard?: ConfigGameSideboard | undefined
	banned?: Record<string, string> | undefined
	mainDeck: ConfigGameMainDeck
	manaDeck?: ConfigGameResourceDeck | undefined
}
export interface ConfigGameRules {
	leaderColorIdentity?: boolean
	openingCardTypes?: string[]
	upgradeDelayTurns?: number
	mainUnitLimit?: number
	siteUnitLimit?: number
	disableEndTurn?: boolean
	emptyDeckDraw?: 'ignore'
	defeatedUnitPoints?: number
	requiredInPlay?: string[]
}
export interface ConfigGameSite {
	minimumSize: number
	maximumSize?: number | undefined
	choose?: 'random' | 'unique' | undefined
}
export interface ConfigGameSideboard {
	minimumSize: number
	maximumSize?: number | undefined
}
export interface ConfigGameModeDeck {
	setupDraw?: number[]
	firstTurnDraw?: number[]
	turnDraw?: number
	minimumSize: number
	maximumSize?: number
}
export interface ConfigGameMainDeck extends ConfigGameModeDeck {
	handLimit?: number
	setupMulligan?: number
	copyLimit?: number
}
export interface ConfigGameResourceDeck extends ConfigGameModeDeck {}
