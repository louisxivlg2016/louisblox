import { BLOCK_INFO, BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';

export const CUSTOM_WORLD_RADIUS = 32;
export const CUSTOM_WORLD_MAX_Y = 48;
export const CUSTOM_WORLD_MAX_BLOCKS = 4000;
export const CUSTOM_WORLD_MAX_SOURCE = 240000;
export const INFINITE_EDITOR_COORDINATE = 1000000000;

export type CustomTerrain = 'flat' | 'natural';
export type CustomWorldDefinition = {
  version: 1;
  terrain: CustomTerrain;
  source: string;
  blocks: Voxel[];
  infinite?: boolean;
};

export const DEFAULT_WORLD_SOURCE = `terrain("plat");

// Une plateforme et deux piliers pour commencer.
remplir(-5, 1, -5, 5, 1, 5, "planches_chene");
remplir(-5, 2, -5, -5, 4, -5, "brique_beige");
remplir(5, 2, -5, 5, 4, -5, "brique_beige");
bloc(0, 2, -4, "bougie");

// Tu peux aussi faire des boucles :
// for (let x = -3; x <= 3; x += 1) {
//   bloc(x, 2, 3, "beton_bleu");
// }`;

function identifier(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function worldBlockId(kind: BlockKind) {
  return identifier(BLOCK_INFO[kind].name);
}

const blockAliases = new Map<string, BlockKind>();
for (const [name, value] of Object.entries(BlockKind)) {
  if (!Number.isInteger(value) || !(value in BLOCK_INFO)) continue;
  const kind = value as BlockKind;
  blockAliases.set(identifier(name), kind);
  blockAliases.set(worldBlockId(kind), kind);
  blockAliases.set(worldBlockId(kind).replace(/_de_|_du_|_des_|_la_|_le_/g, '_'), kind);
}
blockAliases.set('eau', BlockKind.CalmWater);
blockAliases.set('eau_inondation', BlockKind.Water);

export function resolveWorldBlock(value: string) {
  return blockAliases.get(identifier(value));
}

export type EditorBlockCategory = { id: string; name: string; kinds: BlockKind[] };

export const EDITOR_BLOCK_CATEGORIES: EditorBlockCategory[] = [
  { id: 'nature', name: 'Terrain et minerais', kinds: [BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass, BlockKind.JungleGrass, BlockKind.Dirt, BlockKind.Stone, BlockKind.Sand, BlockKind.Snow, BlockKind.Bedrock, BlockKind.CoalOre, BlockKind.IronOre, BlockKind.GoldOre, BlockKind.DiamondOre] },
  { id: 'plants', name: 'Arbres et cultures', kinds: [BlockKind.Wood, BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple, BlockKind.Cactus, BlockKind.OakSapling, BlockKind.PineSapling, BlockKind.AutumnSapling, BlockKind.Corn, BlockKind.Wheat, BlockKind.Tomato, BlockKind.Carrot, BlockKind.Watermelon] },
  { id: 'wood', name: 'Bois et briques', kinds: [BlockKind.OakPlanks, BlockKind.PinePlanks, BlockKind.AutumnPlanks, BlockKind.BeigeBrick, BlockKind.WhiteBrick, BlockKind.GrayBrick] },
  { id: 'concrete', name: 'Béton', kinds: Array.from({ length: 16 }, (_, index) => (BlockKind.ConcreteWhite + index) as BlockKind) },
  { id: 'glass', name: 'Verre, eau et glace', kinds: [BlockKind.Glass, ...Array.from({ length: 16 }, (_, index) => (BlockKind.GlassWhite + index) as BlockKind), BlockKind.Water, BlockKind.CalmWater, BlockKind.Ice] },
  { id: 'doors', name: 'Portes et trappes', kinds: Array.from({ length: 32 }, (_, index) => (BlockKind.DoorWhite + index) as BlockKind) },
  { id: 'furniture', name: 'Maison et décoration', kinds: [BlockKind.Chest, BlockKind.Furnace, BlockKind.Ladder, BlockKind.Sign, BlockKind.Candle, BlockKind.Tnt, BlockKind.Campfire, BlockKind.Wildfire, BlockKind.Food, ...Array.from({ length: 17 }, (_, index) => (BlockKind.Bed + index) as BlockKind)] },
  { id: 'street', name: 'Rue et rails', kinds: [BlockKind.Rail, BlockKind.TrafficLight, BlockKind.StreetLamp, BlockKind.ParisStreetLamp, ...Array.from({ length: 12 }, (_, index) => (BlockKind.StopSign + index) as BlockKind), BlockKind.ParisStreetSign] },
];

type Value = number | string | boolean | undefined;
type Token = { type: 'number' | 'string' | 'name' | 'symbol' | 'end'; value: string; line: number };
type Expression =
  | { type: 'value'; value: Value }
  | { type: 'name'; name: string; line: number }
  | { type: 'unary'; operator: string; argument: Expression; line: number }
  | { type: 'binary'; operator: string; left: Expression; right: Expression; line: number }
  | { type: 'assignment'; name: string; operator: string; value: Expression; line: number }
  | { type: 'update'; name: string; amount: number; line: number }
  | { type: 'call'; name: string; args: Expression[]; line: number };
type Statement =
  | { type: 'expression'; expression: Expression }
  | { type: 'declaration'; name: string; value: Expression; line: number }
  | { type: 'block'; body: Statement[] }
  | { type: 'if'; condition: Expression; yes: Statement; no?: Statement }
  | { type: 'for'; init?: Statement; condition?: Expression; update?: Expression; body: Statement; line: number }
  | { type: 'break' | 'continue' };

function tokenize(source: string) {
  const tokens: Token[] = [];
  let index = 0;
  let line = 1;
  const symbols = ['===', '!==', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '++', '--'];
  while (index < source.length) {
    const char = source[index];
    if (char === '\n') { line += 1; index += 1; continue; }
    if (/\s/.test(char)) { index += 1; continue; }
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error(`Ligne ${line} : commentaire non terminé.`);
      line += source.slice(index, end + 2).split('\n').length - 1;
      index = end + 2;
      continue;
    }
    if (/[0-9]/.test(char)) {
      const match = /^(?:\d+\.?\d*|\.\d+)/.exec(source.slice(index));
      if (match) {
        tokens.push({ type: 'number', value: match[0], line });
        index += match[0].length;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(char)) {
      const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index))!;
      tokens.push({ type: 'name', value: match[0], line });
      index += match[0].length;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = '';
      let end = index + 1;
      while (end < source.length && source[end] !== char) {
        if (source[end] === '\n') throw new Error(`Ligne ${line} : texte non terminé.`);
        if (source[end] === '\\') {
          end += 1;
          if (end >= source.length) break;
          const escaped = source[end];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
        } else value += source[end];
        end += 1;
      }
      if (source[end] !== char) throw new Error(`Ligne ${line} : texte non terminé.`);
      tokens.push({ type: 'string', value, line });
      index = end + 1;
      continue;
    }
    const symbol = symbols.find((candidate) => source.startsWith(candidate, index));
    if (symbol) {
      tokens.push({ type: 'symbol', value: symbol, line });
      index += symbol.length;
      continue;
    }
    if ('+-*/%<>=!(){};,'.includes(char)) {
      tokens.push({ type: 'symbol', value: char, line });
      index += 1;
      continue;
    }
    throw new Error(`Ligne ${line} : le caractère « ${char} » n’est pas autorisé.`);
  }
  tokens.push({ type: 'end', value: '', line });
  return tokens;
}

class WorldCodeParser {
  private index = 0;
  constructor(private tokens: Token[]) {}
  private current() { return this.tokens[this.index]; }
  private match(value: string) {
    if (this.current().value !== value) return false;
    this.index += 1;
    return true;
  }
  private expect(value: string) {
    if (!this.match(value)) throw new Error(`Ligne ${this.current().line} : « ${value} » attendu.`);
  }
  private keyword(value: string) {
    return this.current().type === 'name' && this.match(value);
  }
  private name() {
    const token = this.current();
    if (token.type !== 'name') throw new Error(`Ligne ${token.line} : nom de variable attendu.`);
    this.index += 1;
    return token;
  }
  parse() {
    const body: Statement[] = [];
    while (this.current().type !== 'end') body.push(this.statement());
    return body;
  }
  private statement(): Statement {
    if (this.match(';')) return { type: 'block', body: [] };
    if (this.match('{')) {
      const body: Statement[] = [];
      while (!this.match('}')) {
        if (this.current().type === 'end') throw new Error(`Ligne ${this.current().line} : accolade fermante manquante.`);
        body.push(this.statement());
      }
      return { type: 'block', body };
    }
    if (this.keyword('if')) {
      this.expect('(');
      const condition = this.expression();
      this.expect(')');
      const yes = this.statement();
      const no = this.keyword('else') ? this.statement() : undefined;
      return { type: 'if', condition, yes, no };
    }
    if (this.keyword('for')) {
      const line = this.current().line;
      this.expect('(');
      let init: Statement | undefined;
      if (!this.match(';')) {
        init = this.simpleStatement();
        this.expect(';');
      }
      const condition = this.match(';') ? undefined : this.expression();
      if (condition) this.expect(';');
      const update = this.match(')') ? undefined : this.expression();
      this.expect(')');
      return { type: 'for', init, condition, update, body: this.statement(), line };
    }
    if (this.keyword('break')) { this.expect(';'); return { type: 'break' }; }
    if (this.keyword('continue')) { this.expect(';'); return { type: 'continue' }; }
    const statement = this.simpleStatement();
    this.expect(';');
    return statement;
  }
  private simpleStatement(): Statement {
    if (this.current().value === 'let' || this.current().value === 'const') {
      const line = this.current().line;
      this.index += 1;
      const name = this.name();
      this.expect('=');
      return { type: 'declaration', name: name.value, value: this.expression(), line };
    }
    return { type: 'expression', expression: this.expression() };
  }
  private expression(minPrecedence = 0): Expression {
    let left = this.prefix();
    const precedence: Record<string, number> = { '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '||': 2, '&&': 3, '==': 4, '!=': 4, '===': 4, '!==': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 };
    while (precedence[this.current().value] > minPrecedence) {
      const operator = this.current().value;
      const line = this.current().line;
      const priority = precedence[operator];
      this.index += 1;
      const right = this.expression(priority);
      if (priority === 1) {
        if (left.type !== 'name') throw new Error(`Ligne ${line} : seule une variable peut être modifiée.`);
        left = { type: 'assignment', name: left.name, operator, value: right, line };
      } else left = { type: 'binary', operator, left, right, line };
    }
    if (minPrecedence === 0 && (this.current().value === '++' || this.current().value === '--')) {
      if (left.type !== 'name') throw new Error(`Ligne ${this.current().line} : seule une variable peut être incrémentée.`);
      left = { type: 'update', name: left.name, amount: this.current().value === '++' ? 1 : -1, line: this.current().line };
      this.index += 1;
    }
    return left;
  }
  private prefix(): Expression {
    const token = this.current();
    if (this.match('!') || this.match('-') || this.match('+')) return { type: 'unary', operator: token.value, argument: this.expression(8), line: token.line };
    if (this.match('(')) {
      const value = this.expression();
      this.expect(')');
      return value;
    }
    if (token.type === 'number') { this.index += 1; return { type: 'value', value: Number(token.value) }; }
    if (token.type === 'string') { this.index += 1; return { type: 'value', value: token.value }; }
    if (token.value === 'true' || token.value === 'false') { this.index += 1; return { type: 'value', value: token.value === 'true' }; }
    if (token.type === 'name') {
      this.index += 1;
      if (this.match('(')) {
        const args: Expression[] = [];
        if (!this.match(')')) {
          do { args.push(this.expression()); } while (this.match(','));
          this.expect(')');
        }
        return { type: 'call', name: token.value, args, line: token.line };
      }
      return { type: 'name', name: token.value, line: token.line };
    }
    throw new Error(`Ligne ${token.line} : expression incomplète ou instruction non autorisée.`);
  }
}

class Scope {
  private values = new Map<string, Value>();
  constructor(private parent?: Scope) {}
  declare(name: string, value: Value) { this.values.set(name, value); }
  has(name: string): boolean { return this.values.has(name) || (this.parent?.has(name) ?? false); }
  get(name: string): Value { return this.values.has(name) ? this.values.get(name) : this.parent?.get(name); }
  set(name: string, value: Value) {
    if (this.values.has(name)) this.values.set(name, value);
    else if (this.parent?.has(name)) this.parent.set(name, value);
    else throw new Error(`La variable « ${name} » n’existe pas.`);
  }
}

type CompiledWorld = Pick<CustomWorldDefinition, 'terrain' | 'blocks'>;

export function executeWorldCode(source: string, seed = 73421, terrainHeight: (x: number, z: number) => number = () => 0, infinite = false): CompiledWorld {
  if (typeof source !== 'string' || source.length > CUSTOM_WORLD_MAX_SOURCE) throw new Error(`Le code est limité à ${CUSTOM_WORLD_MAX_SOURCE} caractères.`);
  const program = new WorldCodeParser(tokenize(source)).parse();
  const blocks = new Map<string, Voxel>();
  let terrain: CustomTerrain = 'flat';
  let operations = 0;
  let randomState = seed >>> 0;
  const tick = (line?: number) => {
    operations += 1;
    if (operations > 100000) throw new Error(`Ligne ${line ?? 1} : le code fait trop d’opérations. Réduis les boucles.`);
  };
  const number = (value: Value, name: string, line: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Ligne ${line} : ${name} doit être un nombre fini.`);
    return value;
  };
  const integer = (value: Value, name: string, line: number) => {
    const result = number(value, name, line);
    if (!Number.isInteger(result)) throw new Error(`Ligne ${line} : ${name} doit être un nombre entier.`);
    return result;
  };
  const position = (args: Value[], offset: number, line: number): [number, number, number] => {
    const x = integer(args[offset], 'x', line);
    const y = integer(args[offset + 1], 'y', line);
    const z = integer(args[offset + 2], 'z', line);
    const limit = infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z) || Math.abs(x) > limit || Math.abs(z) > limit || y < 1 || y > CUSTOM_WORLD_MAX_Y) throw new Error(infinite ? `Ligne ${line} : coordonnées entières trop grandes, y entre 1 et 48.` : `Ligne ${line} : x et z entre -32 et 32, y entre 1 et 48.`);
    return [x, y, z];
  };
  const kind = (value: Value, line: number) => {
    if (typeof value !== 'string') throw new Error(`Ligne ${line} : écris le nom du bloc entre guillemets.`);
    const result = resolveWorldBlock(value);
    if (result === undefined) throw new Error(`Ligne ${line} : bloc « ${value} » inconnu. Choisis un nom dans l’éditeur.`);
    return result;
  };
  const put = (x: number, y: number, z: number, block: BlockKind, line: number, protectedBlock = false) => {
    tick(line);
    const key = voxelKey(x, y, z);
    if (!blocks.has(key) && blocks.size >= CUSTOM_WORLD_MAX_BLOCKS) throw new Error(`Ligne ${line} : la construction est limitée à ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`);
    blocks.set(key, { x, y, z, kind: block, ...(protectedBlock ? { protected: true } : {}) });
  };
  const arity = (args: Value[], count: number, name: string, line: number) => {
    if (args.length !== count) throw new Error(`Ligne ${line} : ${name} attend ${count} arguments.`);
  };
  const call = (name: string, args: Value[], line: number): Value => {
    tick(line);
    if (name === 'terrain') {
      arity(args, 1, name, line);
      const value = args[0];
      if (value !== 'plat' && value !== 'nature') throw new Error(`Ligne ${line} : terrain accepte « plat » ou « nature ».`);
      terrain = value === 'nature' ? 'natural' : 'flat';
      return;
    }
    if (name === 'bloc' || name === 'effacer') {
      if (name === 'bloc' ? args.length !== 4 && args.length !== 5 : args.length !== 3) throw new Error(`Ligne ${line} : ${name} attend ${name === 'bloc' ? '4 arguments, plus true facultatif pour protéger' : '3 arguments'}.`);
      const [x, y, z] = position(args, 0, line);
      if (name === 'effacer') { blocks.delete(voxelKey(x, y, z)); return; }
      put(x, y, z, kind(args[3], line), line, args[4] === true);
      return;
    }
    if (name === 'remplir') {
      if (args.length !== 7 && args.length !== 8) throw new Error(`Ligne ${line} : remplir attend 7 arguments, plus true facultatif pour protéger.`);
      const start = position(args, 0, line);
      const end = position(args, 3, line);
      const block = kind(args[6], line);
      if ((Math.abs(end[0] - start[0]) + 1) * (Math.abs(end[1] - start[1]) + 1) * (Math.abs(end[2] - start[2]) + 1) > CUSTOM_WORLD_MAX_BLOCKS) throw new Error(`Ligne ${line} : cette zone dépasse ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`);
      for (let x = Math.min(start[0], end[0]); x <= Math.max(start[0], end[0]); x += 1) {
        for (let y = Math.min(start[1], end[1]); y <= Math.max(start[1], end[1]); y += 1) {
          for (let z = Math.min(start[2], end[2]); z <= Math.max(start[2], end[2]); z += 1) put(x, y, z, block, line, args[7] === true);
        }
      }
      return;
    }
    if (name === 'sphere') {
      if (args.length !== 5 && args.length !== 6) throw new Error(`Ligne ${line} : sphere attend 5 arguments, plus true facultatif pour protéger.`);
      const [cx, cy, cz] = position(args, 0, line);
      const radius = integer(args[3], 'rayon', line);
      const block = kind(args[4], line);
      if (radius < 1 || radius > 16) throw new Error(`Ligne ${line} : le rayon doit être entre 1 et 16.`);
      for (let x = -radius; x <= radius; x += 1) for (let y = -radius; y <= radius; y += 1) for (let z = -radius; z <= radius; z += 1) {
        if (x * x + y * y + z * z <= radius * radius) position([cx + x, cy + y, cz + z], 0, line), put(cx + x, cy + y, cz + z, block, line, args[5] === true);
      }
      return;
    }
    if (name === 'hauteur') {
      arity(args, 2, name, line);
      const x = integer(args[0], 'x', line);
      const z = integer(args[1], 'z', line);
      return terrain === 'natural' ? Math.round(number(terrainHeight(x, z), 'hauteur', line)) : 0;
    }
    if (name === 'aleatoire') {
      arity(args, 0, name, line);
      randomState = (randomState + 0x6D2B79F5) >>> 0;
      let value = randomState;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    }
    throw new Error(`Ligne ${line} : commande « ${name} » inconnue. Utilise terrain, bloc, remplir, sphere, effacer, hauteur ou aleatoire.`);
  };
  const evaluate = (expression: Expression, scope: Scope): Value => {
    if (expression.type === 'value') return expression.value;
    if (expression.type === 'name') {
      if (!scope.has(expression.name)) throw new Error(`Ligne ${expression.line} : variable « ${expression.name} » inconnue.`);
      return scope.get(expression.name);
    }
    if (expression.type === 'call') return call(expression.name, expression.args.map((arg) => evaluate(arg, scope)), expression.line);
    if (expression.type === 'update') {
      const value = number(evaluate({ type: 'name', name: expression.name, line: expression.line }, scope), expression.name, expression.line);
      scope.set(expression.name, value + expression.amount);
      return value;
    }
    if (expression.type === 'assignment') {
      const right = evaluate(expression.value, scope);
      if (expression.operator === '=') { scope.set(expression.name, right); return right; }
      const left = number(evaluate({ type: 'name', name: expression.name, line: expression.line }, scope), expression.name, expression.line);
      const value = evaluate({ type: 'binary', operator: expression.operator[0], left: { type: 'value', value: left }, right: { type: 'value', value: right }, line: expression.line }, scope);
      scope.set(expression.name, value);
      return value;
    }
    if (expression.type === 'unary') {
      const value = evaluate(expression.argument, scope);
      if (expression.operator === '!') return !value;
      return expression.operator === '-' ? -number(value, 'valeur', expression.line) : number(value, 'valeur', expression.line);
    }
    tick(expression.line);
    const left = evaluate(expression.left, scope);
    if (expression.operator === '&&') return left ? evaluate(expression.right, scope) : false;
    if (expression.operator === '||') return left ? true : evaluate(expression.right, scope);
    const right = evaluate(expression.right, scope);
    if (expression.operator === '+') {
      if (typeof left === 'string' || typeof right === 'string') return `${left ?? ''}${right ?? ''}`;
      return number(left, 'gauche', expression.line) + number(right, 'droite', expression.line);
    }
    if (expression.operator === '-') return number(left, 'gauche', expression.line) - number(right, 'droite', expression.line);
    if (expression.operator === '*') return number(left, 'gauche', expression.line) * number(right, 'droite', expression.line);
    if (expression.operator === '/') return number(left, 'gauche', expression.line) / number(right, 'droite', expression.line);
    if (expression.operator === '%') return number(left, 'gauche', expression.line) % number(right, 'droite', expression.line);
    if (expression.operator === '<') return Number(left) < Number(right);
    if (expression.operator === '<=') return Number(left) <= Number(right);
    if (expression.operator === '>') return Number(left) > Number(right);
    if (expression.operator === '>=') return Number(left) >= Number(right);
    if (expression.operator === '==' || expression.operator === '===') return left === right;
    if (expression.operator === '!=' || expression.operator === '!==') return left !== right;
    throw new Error(`Ligne ${expression.line} : opération non autorisée.`);
  };
  const run = (statement: Statement, scope: Scope): 'break' | 'continue' | undefined => {
    if (statement.type === 'expression') { evaluate(statement.expression, scope); return; }
    if (statement.type === 'declaration') { scope.declare(statement.name, evaluate(statement.value, scope)); return; }
    if (statement.type === 'block') {
      const inner = new Scope(scope);
      for (const child of statement.body) { const result = run(child, inner); if (result) return result; }
      return;
    }
    if (statement.type === 'if') return evaluate(statement.condition, scope) ? run(statement.yes, scope) : statement.no ? run(statement.no, scope) : undefined;
    if (statement.type === 'for') {
      const loop = new Scope(scope);
      if (statement.init) run(statement.init, loop);
      while (statement.condition === undefined || evaluate(statement.condition, loop)) {
        tick(statement.line);
        const result = run(statement.body, loop);
        if (result === 'break') break;
        if (statement.update) evaluate(statement.update, loop);
      }
    }
    return statement.type === 'break' || statement.type === 'continue' ? statement.type : undefined;
  };
  const global = new Scope();
  for (const statement of program) run(statement, global);
  return { terrain, blocks: [...blocks.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z) };
}

export function sanitizeCustomWorld(value: unknown): CustomWorldDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const definition = value as Partial<CustomWorldDefinition>;
  if (definition.version !== 1 || definition.terrain !== 'flat' && definition.terrain !== 'natural' || typeof definition.source !== 'string' || definition.source.length > CUSTOM_WORLD_MAX_SOURCE || !Array.isArray(definition.blocks) || definition.blocks.length > CUSTOM_WORLD_MAX_BLOCKS || definition.infinite !== undefined && typeof definition.infinite !== 'boolean') return null;
  const limit = definition.infinite === true ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS;
  const blocks = new Map<string, Voxel>();
  for (const block of definition.blocks) {
    if (!block || typeof block !== 'object' || !Number.isSafeInteger(block.x) || !Number.isSafeInteger(block.y) || !Number.isSafeInteger(block.z) || typeof block.kind !== 'number' || !(block.kind in BLOCK_INFO)) return null;
    if (Math.abs(block.x) > limit || Math.abs(block.z) > limit || block.y < 1 || block.y > CUSTOM_WORLD_MAX_Y) return null;
    blocks.set(voxelKey(block.x, block.y, block.z), { x: block.x, y: block.y, z: block.z, kind: block.kind, ...(block.protected === true ? { protected: true } : {}) });
  }
  return { version: 1, terrain: definition.terrain, source: definition.source, blocks: [...blocks.values()], ...(definition.infinite === true ? { infinite: true } : {}) };
}

export function createCustomWorld(source: string, seed: number, terrainHeight?: (x: number, z: number) => number, infinite = false): CustomWorldDefinition {
  return { version: 1, source, ...executeWorldCode(source, seed, terrainHeight, infinite), ...(infinite ? { infinite: true } : {}) };
}

export function worldCodeFromBlocks(definition: Pick<CustomWorldDefinition, 'terrain' | 'blocks'>) {
  const sorted = [...definition.blocks].sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  return `terrain("${definition.terrain === 'natural' ? 'nature' : 'plat'}");\n\n${sorted.map((block) => `bloc(${block.x}, ${block.y}, ${block.z}, "${worldBlockId(block.kind)}"${block.protected === true ? ', true' : ''});`).join('\n')}`;
}
