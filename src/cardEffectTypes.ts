import type { CardEffectVocabulary, DefaultVocabulary, CARD_RELATION_TYPES, CARDS_IN_TRASH, INFINITY_COST, EACH_OPPONENT_LOCATION } from './cardEffectVocabulary.ts'
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
	costMultiplier?: 'perUnitBeyondFirst'
}
export type EffectUsage = 'oncePerTurn'
export type CombatRole = 'attacking' | 'defending'
export interface EffectConditions<V extends CardEffectVocabulary = DefaultVocabulary> {
	initiatingPlayer?: PlayerTarget<V>
	turnPlayer?: PlayerTarget<V>
	sourceArea?: LocationArea<V>
	targetQuery?: CardSetQuery<V>
	targetFromArea?: LocationArea<V>
	targetNotFromArea?: LocationArea<V>
	conqueredUncontrolled?: boolean
	costSource?: CostSourceType
	combatRole?: CombatRole
	eventSourceQuery?: CardSetQuery<V>
	costsThreshold?: EffectCostContainer<V>
	conditionalsSource?: CardConditional<V>[]
	conditionalsTarget?: CardConditional<V>[]
}
export interface EffectPolicy<V extends CardEffectVocabulary = DefaultVocabulary> {
	activationScope?: 'sameLocation'
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
export interface CardEffectData<V extends CardEffectVocabulary = DefaultVocabulary, Effect = EffectInstance<V>> {
	effects?: EffectDefinitionsByKey<V, Effect>
	playModifiers?: CardModifier<V>[]
	repeatCosts?: EffectCostContainer<V>[]
	actionWindows?: ActionWindow<V>[]
	buffLimit?: number | null
	enhancementLimit?: number
	canFacedown?: boolean
	copyTextToAttached?: boolean
	activatableEffects?: 'allFriendly' | EffectActionDefinition<V, Effect>[]
	additionalCosts?: EffectCostContainer<V>[]
	costEffect?: Effect
}
export type ActionWindow<V extends CardEffectVocabulary = DefaultVocabulary> = V['ACTION_WINDOWS'][number]
export type PlayPermissionCharacteristic = 'flashback'
export interface PlayPermission<V extends CardEffectVocabulary = DefaultVocabulary> {
	from: CardLocation<V>
	cost: 'normal' | EffectCost<V>[]
	exit: 'normal' | 'banished'
	characteristic?: PlayPermissionCharacteristic
}
export type CardModifierType<V extends CardEffectVocabulary = DefaultVocabulary> = V['MODIFIER_TYPES'][number]
export type AbilityProcedure = 'costPayment' | 'combatDamageAssignment'
export type CompareOperator = '<' | '<=' | '=' | '!=' | '>=' | '>'
export type CardConditionalCompareValue<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V> | {
	type: 'cardCount'
	query: CardSetQuery<V>
}
export interface CardConditionalCompare<V extends CardEffectVocabulary = DefaultVocabulary> {
	operator?: CompareOperator
	value: CardConditionalCompareValue<V>
}
type NumericPlayerTurnConditionalType = 'burned' | 'discarded' | 'killed' | 'spentMana' | 'spentManaRecycle' | 'drawn' | 'holds' | 'conquers' | 'excessDamage' | 'winCombat' | 'xpGained' | 'chosenEnemyUnits' | 'chosenEnemyUnitsOrGearWithSpellsOrUnitAbilities'
export type CardConditionalType<V extends CardEffectVocabulary = DefaultVocabulary> = V['CONDITIONAL_TYPES'][number]
export interface CardConditional<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: CardConditionalType<V>
	min?: AmountExpression<V>
	max?: AmountExpression<V>
	compare?: CardConditionalCompare<V> | CardConditionalCompare<V>[]
	unlessPaidAdditionalCost?: boolean
	not?: boolean
	cardType?: CardType<V> | string
	eventPhase?: TurnStepState<V>
	costs?: EffectCostContainer<V>
	query?: CardSetQuery<V>
}
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
	amountMultiplier?: CardSetQuery<V>
	conditional?: CardConditional<V>[]
	requiresCards?: CardSetRequirement<V> | CardSetRequirement<V>[]
	minimum1?: boolean
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
}
export type PlayerTarget<V extends CardEffectVocabulary = DefaultVocabulary> = V['PLAYER_TARGETS'][number]
export type CostType<V extends CardEffectVocabulary = DefaultVocabulary> = V['COST_TYPES'][number]
export type CostOptionality = 'optional' | 'replaces'
export type LocationArea<V extends CardEffectVocabulary = DefaultVocabulary> = V['LOCATION_AREAS'][number]
export type CardType<V extends CardEffectVocabulary = DefaultVocabulary> = V['CARD_TYPES'][number]
export type EffectDuration = 'combat' | 'turn' | undefined
export type NamingType = 'cardName' | 'type' | 'tag'
export interface Naming<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: NamingType
	cardTypes?: (CardType<V> | string)[]
}
export type CardRelationType = (typeof CARD_RELATION_TYPES)[number]
export type CardRelations<V extends CardEffectVocabulary = DefaultVocabulary> = Partial<Record<CardRelationType, CardSetRequirement<V> | CardSetRequirement<V>[]>>
export interface CardStatAmount<V extends CardEffectVocabulary = DefaultVocabulary> {
	stat: V['CARD_STATS'][number]
	card: EffectSingleCardReference<V>
	previous?: true
	offset?: number
}
export type CoreAmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = V['CORE_AMOUNTS'][number] | CardStatAmount<V>
export type DamageAmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = V['DAMAGE_AMOUNTS'][number] | CardStatAmount<V>
export type AmountReference<V extends CardEffectVocabulary = DefaultVocabulary> = CoreAmountReference<V> | DamageAmountReference<V> | typeof EACH_OPPONENT_LOCATION
export type AmountExpression<V extends CardEffectVocabulary = DefaultVocabulary, Reference extends AmountReference<V> = CoreAmountReference<V>> = number | Reference
export type CountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V>
export type CostAmountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V> | typeof INFINITY_COST
export type CostMultiplier = number | typeof CARDS_IN_TRASH | 'played' | 'holds'
export type DamageAmountExpression<V extends CardEffectVocabulary = DefaultVocabulary> = AmountExpression<V, DamageAmountReference<V>>
export type DrawManaAmountExpression = number | typeof INFINITY_COST
export type SpawnCountExpression = number | typeof EACH_OPPONENT_LOCATION
export interface EffectCostDefinition<V extends CardEffectVocabulary = DefaultVocabulary> {
	type: CostType<V>
	minimumCost?: number
	matching?: string[]
	conditional?: CardConditional<V>[]
	query?: CardSetQuery<V>
}
export interface EffectCost<V extends CardEffectVocabulary = DefaultVocabulary> extends EffectCostDefinition<V> {
	amount?: CostAmountExpression<V>
	multiplier?: CostMultiplier
}
export interface EffectCostContainer<V extends CardEffectVocabulary = DefaultVocabulary, Cost extends EffectCostDefinition<V> = EffectCost<V>> {
	costs: Cost[]
	timing?: 'resolution'
	kind?: 'payment'
	cardTypes?: (CardType<V> | string)[]
	conditionals?: CardConditional<V>[]
	onlyDuringShowdown?: true
	amountMultiplier?: CardSetQuery<V>
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
	cardTypes?: (CardType<V> | string)[]
	names?: string[]
	named?: NamingType
	colors?: string[]
	allCardTypes?: (CardType<V> | string)[]
	excludeCardTypes?: (CardType<V> | string)[]
	/** Filters candidate controllers independently of where candidates come from. */
	players?: PlayerTarget<V>
	conditional?: CardConditional<V>[]
	isAtSite?: true
	includeSites?: true
	chosen?: true
	siteControl?: true
	uniqueCardTypes?: (CardType<V> | string)[]
	includeSource?: true
	hasModifier?: CardModifierType<V>
	requiredActionWindow?: ActionWindow<V>
	relations?: CardRelations<V>
	isFacedown?: true
	siteController?: 'selected' | 'open' | 'opponent' | 'self'
}
export interface EffectAmountMultiplier<V extends CardEffectVocabulary = DefaultVocabulary> {
	query: CardSetQuery<V>
	base?: number
}
export type EffectSelectionTiming = 'target' | 'privateChoice' | 'resolutionChoice' | 'programmatic'
export interface CardSetRequirement<V extends CardEffectVocabulary = DefaultVocabulary> {
	min?: number
	max?: number
	query: CardSetQuery<V>
}
export type RepeatPlayerRef = 'startFromMe' | 'startFromNext' | 'opponents' | 'others'
/** A scalar input: named card or selected entry; cost selections require an index to distinguish a card from the whole payment set. */
export type EffectSingleCardReference<V extends CardEffectVocabulary = DefaultVocabulary> = 'effectSource' | 'affectingCard' | 'eventSubject' | 'effectTarget' | 'recipient' | {
	from: 'selection' | 'previousSelection'
	index?: number
	cardType?: CardType<V>
} | {
	from: 'costSelection'
	cost: CostType<V>
	index: number
	cardType?: CardType<V>
}
export type EffectCardSetReference<V extends CardEffectVocabulary = DefaultVocabulary> = EffectSingleCardReference<V> | 'affected' | 'selection' | 'previousSelection' | {
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
	resolvingPlayer?: 'selectedOwner' | 'self' | 'opponent'
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
	repeat?: number
}
export type EffectChoice<V extends CardEffectVocabulary = DefaultVocabulary> = {
	timing?: 'target' | 'resolutionChoice'
	mode: 'effect'
	options: EffectInstance<V>[]
} | {
	mode: 'revealed'
	options: {
		match: string
		effect: EffectInstance<V>
	}[]
}
export type EffectPlay<V extends CardEffectVocabulary = DefaultVocabulary> = {
	subject: EffectCardReference<V>
	mode?: undefined
	reduceMana?: AmountExpression<V>
	reduceManaRecycle?: AmountExpression<V>
	controller?: 'owner'
	destination?: LocationArea<V> | 'lastLocation' | {
		area: LocationArea<V>
		cardTypes?: string[]
		allCardTypes?: string[]
	}
} | {
	subject: EffectSingleCardReference<V>
	mode: 'replay'
	costs?: EffectCostContainer<V>
	sourceArea?: LocationArea<V>
} | {
	subject: EffectSingleCardReference<V>
	mode: 'copy'
	copies: number
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
export type EffectModifierValue<V extends CardEffectVocabulary = DefaultVocabulary> = {
	stat: 'strength'
	card: EffectSingleCardReference<V>
}
export interface EffectModifierCalculation<V extends CardEffectVocabulary = DefaultVocabulary> {
	operation: 'subtract'
	left: EffectModifierValue<V>
	right: EffectModifierValue<V>
	minimum?: number
}
interface EffectModifierBase<V extends CardEffectVocabulary = DefaultVocabulary> extends Omit<CardModifier<V>, 'amount'> {
	/** Player rules apply to later arrivals too; omitted scope modifies only the resolved cards. */
	scope?: 'players'
	subject?: EffectCardReference<V>
}
/** Exactly one value source: literal/default, calculation, or a copied modifier. */
export type EffectModifier<V extends CardEffectVocabulary = DefaultVocabulary> = EffectModifierBase<V> & ({
	amount?: AmountExpression<V>
	calculation?: never
	copyFrom?: never
} | {
	calculation: EffectModifierCalculation<V>
	amount?: never
	copyFrom?: never
} | {
	copyFrom: EffectSingleCardReference<V>
	amount?: never
	calculation?: never
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
	to?: LocationArea<V> | EffectLocationReference<V>
	payCosts?: true
	onFailure?: 'killTarget'
}
export interface EffectReadies {
	action: 'ready' | 'exhaust' | 'toggle'
	amount?: number
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
	counts?: true
}
export interface EffectInstance<V extends CardEffectVocabulary = DefaultVocabulary> {
	endTurn?: true
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
	play?: EffectPlay<V>
	targetCostDiscount?: EffectCostContainer<V>
	siteToken?: {
		name: string
		enter?: true
	} | {
		restore: true
	}
	costs?: EffectCostContainer<V>
	addResource?: EffectCostContainer<V>
	addBuff?: number
	drawMana?: {
		amount: DrawManaAmountExpression
		isReady?: true
	}
	gainXP?: number
	enhancement?: 'apply' | 'remove'
	damage?: {
		amount: DamageAmountExpression<V>
		reciprocal?: true
		bonusPerSourceDamage?: number
	}
	draw?: number
	lookAtFacedown?: PlayerTarget<V>
	kills?: true | EffectKillOptions
	attaches?: true | EffectAttachment<V>
	triggerRepeat?: {
		key: EffectsKey<V>
		amount: number
	}
	changeEffect?: {
		type: 'redirect' | 'disable'
		destination?: 'hand' | 'discard'
	}
	disablesEffect?: CardModifierType<V>
	modifiers?: EffectModifier<V>[]
	passiveModifiers?: CardModifier<V>[]
	readies?: EffectReadies
	amountMultiplier?: EffectAmountMultiplier<V>
	preScry?: number
	reveal?: {
		target?: PlayerTarget<V>
		deck: PlayerCardsLocation<V>
		amount?: CountExpression<V>
		visibility?: 'private' | 'public' | 'selected'
		until?: CardType<V>
	}
	extraTurn?: true
	banishes?: true | {
		returnOnHolderHold?: true
	}
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
		recalls?: true
	}
	activateEffect?: EffectsKey<V>
	moves?: true | EffectMoves<V>
	heals?: boolean
	addPoints?: number
	spawn?: {
		name: string
		to?: LocationArea<V>
		count?: SpawnCountExpression
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
