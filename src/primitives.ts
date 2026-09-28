export type RecordValue = Record<string, unknown>
declare const validatedType: unique symbol
export type Check = (value: unknown) => boolean
/** Output evidence for typed validators; plain boolean checks carry no output claim. */
export type Validator<T = unknown> = Check & { readonly [validatedType]?: T }
export type TypeGuard<T> = ((value: unknown) => value is T) & { readonly [validatedType]?: T }
export type FieldValidators<T> = {
	[Key in keyof Required<T>]: Validator<Required<T>[Key]>
}
export interface ValidationIssue {
	path: string
	expected: string
}
export type ValidationResult = {
	ok: true
} | {
	ok: false
	issues: ValidationIssue[]
}
type Segment = string | number
interface DiagnosticContext {
	path: Segment[]
	issues: {
		segments: Segment[]
		expected: string
	}[]
}
// Validators are synchronous. Each diagnostic call owns its context, including nested calls.
let diagnostics: DiagnosticContext | undefined
let activeContainers = new WeakSet<object>()
function container(value: object, validator: () => boolean): boolean {
	if (activeContainers.has(value)) return invalid('acyclic JSON data')
	activeContainers.add(value)
	try { return validator() } finally { activeContainers.delete(value) }
}
function pathString(path: Segment[]): string {
	return path.reduce<string>((result, part) => typeof part === 'number' ? `${result}[${part}]` : /^[A-Za-z_$][\w$]*$/.test(part) ? `${result}${result ? '.' : ''}${part}` : `${result}[${JSON.stringify(part)}]`, '') || '$'
}
export function invalid(expected: string): false {
	if (diagnostics)
		diagnostics.issues.push({ segments: diagnostics.path, expected })
	return false
}
function check(value: unknown, validator: Validator, path: Segment[]): boolean {
	if (!diagnostics)
		return validator(value)
	const context = diagnostics
	const previous = context.path
	const start = context.issues.length
	context.path = path
	try {
		const valid = validator(value)
		if (valid)
			context.issues.length = start
		else if (context.issues.length === start)
			invalid('valid value satisfying the document constraints')
		return valid
	}
	finally {
		context.path = previous
	}
}
/** Validate a field in a cross-field constraint without losing its diagnostic path. */
export function property(value: RecordValue, key: string, validator: Check): boolean {
	return check(value[key], validator, [...(diagnostics?.path ?? []), key])
}
/** Return the deepest failed field. Successful alternative branches discard their diagnostics. */
export function validate(value: unknown, validator: Validator, root = ''): ValidationResult {
	const previous = diagnostics
	const previousContainers = activeContainers
	activeContainers = new WeakSet()
	const context: DiagnosticContext = { path: [], issues: [] }
	diagnostics = context
	try {
		if (check(value, validator, []))
			return { ok: true }
		const issue = context.issues.reduce((best, item) => item.segments.length > best.segments.length ? item : best)
		const path = pathString(issue.segments)
		return { ok: false, issues: [{ path: root ? root + (path === '$' ? '' : path.startsWith('[') ? path : `.${path}`) : path, expected: issue.expected }] }
	}
	finally {
		diagnostics = previous
		activeContainers = previousContainers
	}
}
export const record: TypeGuard<RecordValue> = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) || invalid('plain object')
export const number: TypeGuard<number> = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) || invalid('finite number')
export const count: TypeGuard<number> = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 || invalid('nonnegative safe integer')
export const string: TypeGuard<string> = (value: unknown): value is string => typeof value === 'string' || invalid('string')
export const boolean: TypeGuard<boolean> = (value: unknown): value is boolean => typeof value === 'boolean' || invalid('boolean')
export const trueValue: TypeGuard<true> = (value: unknown): value is true => value === true || invalid('true')
export const strings: TypeGuard<string[]> = (value: unknown): value is string[] => stringArray(value)
export const numbers: TypeGuard<number[]> = (value: unknown): value is number[] => numberArray(value)
export function oneOf(value: unknown, expected: ReadonlySet<string> | readonly string[]): boolean {
	return typeof value === 'string' && ('has' in expected ? expected.has(value) : expected.includes(value)) || invalid(`one of ${[...expected].map(item => JSON.stringify(item)).join(', ')}`)
}
export function values(value: unknown, validator: (value: unknown, key: string) => boolean): boolean {
	if (!record(value))
		return false
	const path = diagnostics?.path ?? []
	return container(value, () => Object.entries(value).every(([key, item]) => diagnostics ? check(item, item => validator(item, key), [...path, key]) : validator(item, key)))
}
export function only(value: RecordValue, keys: readonly string[]): boolean {
	return Object.keys(value).every(key => keys.includes(key) || check(value[key], () => invalid('known field'), [...(diagnostics?.path ?? []), key]))
}
function checkFields(value: RecordValue, entries: readonly (readonly [
	string,
	Validator
])[], keys: ReadonlySet<string>, required: readonly string[], extraKeys: readonly string[]): boolean {
	const path = diagnostics?.path ?? []
	for (const key of Object.keys(value))
		if (!keys.has(key) && !extraKeys.includes(key))
			return check(value[key], () => invalid('known field'), [...path, key])
	for (const key of required)
		if (!Object.hasOwn(value, key) || value[key] === undefined)
			return check(undefined, () => invalid('required field'), [...path, key])
	return entries.every(([key, validator]) => value[key] === undefined || (diagnostics ? check(value[key], validator, [...path, key]) : validator(value[key])))
}
export function fields<T>(value: RecordValue, validators: FieldValidators<T>, required: readonly (keyof T)[] = [], extraKeys: readonly string[] = []): boolean {
	const entries = Object.entries(validators) as [
		string,
		Validator
	][]
	return container(value, () => checkFields(value, entries, new Set(entries.map(([key]) => key)), required as readonly string[], extraKeys))
}
/** Snapshot a field map once. Later mutations of the caller's map cannot change the contract. */
export function object<T>(validators: FieldValidators<T>, required: readonly (keyof T)[] = [], extraKeys: readonly string[] = []): Check {
	const entries = Object.entries(validators) as [
		string,
		Validator
	][]
	const keys = new Set(entries.map(([key]) => key))
	const requiredKeys = [...required] as string[]
	const allowedExtras = [...extraKeys]
	return value => record(value) && container(value, () => checkFields(value, entries, keys, requiredKeys, allowedExtras))
}
export const nullableNumber: TypeGuard<number | null> = (value: unknown): value is number | null => value === null || number(value)
export function array<T>(validator: (value: unknown) => value is T): Validator<T[]>
export function array<T = never>(validator: Validator<T>): Validator<[T] extends [never] ? never : T[]>
export function array(validator: Check): Check { return value => {
	if (!Array.isArray(value))
		return invalid('array')
	const path = diagnostics?.path ?? []
	return container(value, () => {
	for (let index = 0; index < value.length; index++) {
		if (!(diagnostics ? check(value[index], validator, [...path, index]) : validator(value[index]))) return false
	}
	return true
	})
}
}
export const literal = <const T extends readonly unknown[]>(...expected: T): Validator<T[number]> => value => expected.includes(value) || invalid(expected.map(item => JSON.stringify(item)).join(' or '))
export function stringRecord<T>(validator: (value: unknown) => value is T): Validator<Record<string, T>>
export function stringRecord<T = never>(validator: Validator<T>): Validator<[T] extends [never] ? never : Record<string, T>>
export function stringRecord(validator: Check): Check { return value => values(value, item => validator(item)) }
const stringArray = array(string)
const numberArray = array(number)
export function required(value: RecordValue, keys: readonly string[]): boolean {
	const path = diagnostics?.path ?? []
	return keys.every(key => Object.hasOwn(value, key) && value[key] !== undefined || check(undefined, () => invalid('required field'), [...path, key]))
}

/** Serialized property paths use strings and nonnegative safe array indexes. */
export const pathSegments = array(value => typeof value === 'string' || count(value))
