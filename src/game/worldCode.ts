import { BLOCK_INFO, BlockKind, voxelKey } from './voxel';
import type { Voxel } from './voxel';
import { translate } from './language';

export const CUSTOM_WORLD_RADIUS = 64;
export const CUSTOM_WORLD_MAX_Y = 64;
export const CUSTOM_WORLD_MAX_BLOCKS = 12000;
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
blockAliases.set('ble', BlockKind.Wheat);
blockAliases.set('mais', BlockKind.Corn);
blockAliases.set('tomate', BlockKind.Tomato);
blockAliases.set('carotte', BlockKind.Carrot);
blockAliases.set('pasteque', BlockKind.Watermelon);

export function resolveWorldBlock(value: string) {
  return blockAliases.get(identifier(value));
}

export type EditorBlockCategory = { id: string; name: string; kinds: BlockKind[] };

export const EDITOR_BLOCK_CATEGORIES: EditorBlockCategory[] = [
  { id: 'nature', name: 'Terrain and ores', kinds: [BlockKind.Grass, BlockKind.ForestGrass, BlockKind.AutumnGrass, BlockKind.JungleGrass, BlockKind.Dirt, BlockKind.Stone, BlockKind.Sand, BlockKind.Snow, BlockKind.Bedrock, BlockKind.CoalOre, BlockKind.IronOre, BlockKind.GoldOre, BlockKind.DiamondOre] },
  { id: 'plants', name: 'Trees and crops', kinds: [BlockKind.Wood, BlockKind.Leaves, BlockKind.PineLeaves, BlockKind.AutumnLeaves, BlockKind.JungleLeaves, BlockKind.JungleVine, BlockKind.Apple, BlockKind.Cactus, BlockKind.OakSapling, BlockKind.PineSapling, BlockKind.AutumnSapling, BlockKind.Corn, BlockKind.Wheat, BlockKind.Tomato, BlockKind.Carrot, BlockKind.Watermelon] },
  { id: 'wood', name: translate('Bois et briques', 'Wood and bricks'), kinds: [BlockKind.OakPlanks, BlockKind.PinePlanks, BlockKind.AutumnPlanks, BlockKind.BeigeBrick, BlockKind.WhiteBrick, BlockKind.GrayBrick] },
  { id: 'concrete', name: translate('Béton', 'Concrete'), kinds: Array.from({ length: 16 }, (_, index) => (BlockKind.ConcreteWhite + index) as BlockKind) },
  { id: 'stairs', name: 'Stairs', kinds: Array.from({ length: 34 }, (_, index) => (BlockKind.StairOak + index) as BlockKind) },
  { id: 'slabs', name: translate('Plaques', 'Slabs'), kinds: Array.from({ length: 51 }, (_, index) => (BlockKind.SlabOak + index) as BlockKind) },
  { id: 'glass', name: translate('Verre, eau et glace', 'Glass, water, and ice'), kinds: [BlockKind.Glass, ...Array.from({ length: 16 }, (_, index) => (BlockKind.GlassWhite + index) as BlockKind), BlockKind.Water, BlockKind.CalmWater, BlockKind.Ice] },
  { id: 'doors', name: 'Doors and trapdoors', kinds: [...Array.from({ length: 32 }, (_, index) => (BlockKind.DoorWhite + index) as BlockKind), ...Array.from({ length: 3 }, (_, index) => (BlockKind.TrapdoorIron + index) as BlockKind)] },
  { id: 'furniture', name: translate('Maison et décoration', 'Home and decoration'), kinds: [BlockKind.Chest, BlockKind.Furnace, BlockKind.Ladder, BlockKind.Sign, BlockKind.Candle, BlockKind.Lantern, BlockKind.ModernCeilingLight, BlockKind.Tnt, BlockKind.Campfire, BlockKind.Wildfire, BlockKind.Food, ...Array.from({ length: 17 }, (_, index) => (BlockKind.Bed + index) as BlockKind)] },
  { id: 'street', name: 'Street and rails', kinds: [BlockKind.Rail, BlockKind.TrafficLight, BlockKind.StreetLamp, BlockKind.ParisStreetLamp, ...Array.from({ length: 12 }, (_, index) => (BlockKind.StopSign + index) as BlockKind), BlockKind.ParisStreetSign] },
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
      if (end < 0) throw new Error(translate(`Ligne ${line} : commentaire non terminé.`, `Line ${line}: unterminated comment.`));
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
        if (source[end] === '\n') throw new Error(translate(`Ligne ${line} : texte non terminé.`, `Line ${line}: unterminated text.`));
        if (source[end] === '\\') {
          end += 1;
          if (end >= source.length) break;
          const escaped = source[end];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : escaped;
        } else value += source[end];
        end += 1;
      }
      if (source[end] !== char) throw new Error(translate(`Ligne ${line} : texte non terminé.`, `Line ${line}: unterminated text.`));
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
    throw new Error(translate(`Ligne ${line} : le caractère « ${char} » n’est pas autorisé.`, `Line ${line}: character “${char}” is not allowed.`));
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
        if (left.type !== 'name') throw new Error(translate(`Ligne ${line} : seule une variable peut être modifiée.`, `Line ${line}: only a variable can be changed.`));
        left = { type: 'assignment', name: left.name, operator, value: right, line };
      } else left = { type: 'binary', operator, left, right, line };
    }
    if (minPrecedence === 0 && (this.current().value === '++' || this.current().value === '--')) {
      if (left.type !== 'name') throw new Error(translate(`Ligne ${this.current().line} : seule une variable peut être incrémentée.`, `Line ${this.current().line}: only a variable can be incremented.`));
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
    throw new Error(translate(`Ligne ${token.line} : expression incomplète ou instruction non autorisée.`, `Line ${token.line}: incomplete expression or unauthorized instruction.`));
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
  if (typeof source !== 'string' || source.length > CUSTOM_WORLD_MAX_SOURCE) throw new Error(translate(`Le code est limité à ${CUSTOM_WORLD_MAX_SOURCE} caractères.`, `Code is limited to ${CUSTOM_WORLD_MAX_SOURCE} characters.`));
  const program = new WorldCodeParser(tokenize(source)).parse();
  const blocks = new Map<string, Voxel>();
  let terrain: CustomTerrain = 'flat';
  let operations = 0;
  let randomState = seed >>> 0;
  const tick = (line?: number) => {
    operations += 1;
    if (operations > 250000) throw new Error(translate(`Ligne ${line ?? 1} : le code fait trop d’opérations. Réduis les boucles.`, `Line ${line ?? 1}: code performs too many operations. Reduce the loops.`));
  };
  const number = (value: Value, name: string, line: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(translate(`Ligne ${line} : ${name} doit être un nombre fini.`, `Line ${line}: ${name} must be a finite number.`));
    return value;
  };
  const integer = (value: Value, name: string, line: number) => {
    const result = number(value, name, line);
    if (!Number.isInteger(result)) throw new Error(translate(`Ligne ${line} : ${name} doit être un nombre entier.`, `Line ${line}: ${name} must be an integer.`));
    return result;
  };
  const position = (args: Value[], offset: number, line: number): [number, number, number] => {
    const x = integer(args[offset], 'x', line);
    const y = integer(args[offset + 1], 'y', line);
    const z = integer(args[offset + 2], 'z', line);
    const limit = infinite ? INFINITE_EDITOR_COORDINATE : CUSTOM_WORLD_RADIUS;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z) || Math.abs(x) > limit || Math.abs(z) > limit || y < 1 || y > CUSTOM_WORLD_MAX_Y) throw new Error(infinite ? translate(`Ligne ${line} : coordonnées entières trop grandes, y entre 1 et ${CUSTOM_WORLD_MAX_Y}.`, `Line ${line}: integer coordinates too large, y from 1 to ${CUSTOM_WORLD_MAX_Y}.`) : translate(`Ligne ${line} : x et z entre -${CUSTOM_WORLD_RADIUS} et ${CUSTOM_WORLD_RADIUS}, y entre 1 et ${CUSTOM_WORLD_MAX_Y}.`, `Line ${line}: x and z from -${CUSTOM_WORLD_RADIUS} to ${CUSTOM_WORLD_RADIUS}, y from 1 to ${CUSTOM_WORLD_MAX_Y}.`));
    return [x, y, z];
  };
  const kind = (value: Value, line: number) => {
    if (typeof value !== 'string') throw new Error(translate(`Ligne ${line} : écris le nom du bloc entre guillemets.`, `Line ${line}: write the block name in quotes.`));
    const result = resolveWorldBlock(value);
    if (result === undefined) throw new Error(translate(`Ligne ${line} : bloc « ${value} » inconnu. Choisis un nom dans l’éditeur.`, `Line ${line}: unknown block “${value}”. Choose a name in the editor.`));
    return result;
  };
  const put = (x: number, y: number, z: number, block: BlockKind, line: number, protectedBlock = false) => {
    tick(line);
    const key = voxelKey(x, y, z);
    if (!blocks.has(key) && blocks.size >= CUSTOM_WORLD_MAX_BLOCKS) throw new Error(translate(`Ligne ${line} : la construction est limitée à ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`, `Line ${line}: construction is limited to ${CUSTOM_WORLD_MAX_BLOCKS} blocks.`));
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
      if (name === 'bloc' ? args.length !== 4 && args.length !== 5 : args.length !== 3) throw new Error(translate(`Ligne ${line} : ${name} attend ${name === 'bloc' ? '4 arguments, plus true facultatif pour protéger' : '3 arguments'}.`, `Line ${line}: ${name} expects ${name === 'bloc' ? '4 arguments, plus optional true for protection' : '3 arguments'}.`));
      const [x, y, z] = position(args, 0, line);
      if (name === 'effacer') { blocks.delete(voxelKey(x, y, z)); return; }
      put(x, y, z, kind(args[3], line), line, args[4] === true);
      return;
    }
    if (name === 'remplir') {
      if (args.length !== 7 && args.length !== 8) throw new Error(translate(`Ligne ${line} : remplir attend 7 arguments, plus true facultatif pour protéger.`, `Line ${line}: fill expects 7 arguments, plus optional true for protection.`));
      const start = position(args, 0, line);
      const end = position(args, 3, line);
      const block = kind(args[6], line);
      if ((Math.abs(end[0] - start[0]) + 1) * (Math.abs(end[1] - start[1]) + 1) * (Math.abs(end[2] - start[2]) + 1) > CUSTOM_WORLD_MAX_BLOCKS) throw new Error(translate(`Ligne ${line} : cette zone dépasse ${CUSTOM_WORLD_MAX_BLOCKS} blocs.`, `Line ${line}: this area exceeds ${CUSTOM_WORLD_MAX_BLOCKS} blocks.`));
      for (let x = Math.min(start[0], end[0]); x <= Math.max(start[0], end[0]); x += 1) {
        for (let y = Math.min(start[1], end[1]); y <= Math.max(start[1], end[1]); y += 1) {
          for (let z = Math.min(start[2], end[2]); z <= Math.max(start[2], end[2]); z += 1) put(x, y, z, block, line, args[7] === true);
        }
      }
      return;
    }
    if (name === 'sphere') {
      if (args.length !== 5 && args.length !== 6) throw new Error(translate(`Ligne ${line} : sphere attend 5 arguments, plus true facultatif pour protéger.`, `Line ${line}: sphere expects 5 arguments, plus optional true for protection.`));
      const [cx, cy, cz] = position(args, 0, line);
      const radius = integer(args[3], 'rayon', line);
      const block = kind(args[4], line);
      if (radius < 1 || radius > 16) throw new Error(translate(`Ligne ${line} : le rayon doit être entre 1 et 16.`, `Line ${line}: radius must be between 1 and 16.`));
      for (let x = -radius; x <= radius; x += 1) for (let y = -radius; y <= radius; y += 1) for (let z = -radius; z <= radius; z += 1) {
        if (x * x + y * y + z * z <= radius * radius) position([cx + x, cy + y, cz + z], 0, line), put(cx + x, cy + y, cz + z, block, line, args[5] === true);
      }
      return;
    }
    if (name === 'ligne') {
      if (args.length !== 7 && args.length !== 8) throw new Error(translate(`Ligne ${line} : ligne attend 7 arguments, plus true facultatif pour protéger.`, `Line ${line}: line expects 7 arguments, plus optional true for protection.`));
      const start = position(args, 0, line);
      const end = position(args, 3, line);
      const block = kind(args[6], line);
      const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]), Math.abs(end[2] - start[2]), 1);
      for (let index = 0; index <= steps; index += 1) {
        const ratio = index / steps;
        position(start.map((value, axis) => Math.round(value + (end[axis] - value) * ratio)), 0, line);
        put(Math.round(start[0] + (end[0] - start[0]) * ratio), Math.round(start[1] + (end[1] - start[1]) * ratio), Math.round(start[2] + (end[2] - start[2]) * ratio), block, line, args[7] === true);
      }
      return;
    }
    if (name === 'mur') {
      if (args.length !== 8 && args.length !== 9) throw new Error(translate(`Ligne ${line} : mur attend 8 arguments, plus true facultatif pour protéger.`, `Line ${line}: wall expects 8 arguments, plus optional true for protection.`));
      const start = position(args, 0, line);
      const end = position(args, 3, line);
      const height = integer(args[6], 'hauteur', line);
      const block = kind(args[7], line);
      if (height < 1 || height > 32) throw new Error(translate(`Ligne ${line} : la hauteur du mur doit être entre 1 et 32.`, `Line ${line}: wall height must be between 1 and 32.`));
      const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[2] - start[2]), 1);
      for (let index = 0; index <= steps; index += 1) {
        const ratio = index / steps;
        const x = Math.round(start[0] + (end[0] - start[0]) * ratio);
        const z = Math.round(start[2] + (end[2] - start[2]) * ratio);
        for (let y = start[1]; y < start[1] + height; y += 1) put(x, y, z, block, line, args[8] === true);
      }
      return;
    }
    if (name === 'cylindre') {
      if (args.length !== 6 && args.length !== 7) throw new Error(translate(`Ligne ${line} : cylindre attend 6 arguments, plus true facultatif pour protéger.`, `Line ${line}: cylinder expects 6 arguments, plus optional true for protection.`));
      const [cx, cy, cz] = position(args, 0, line);
      const radius = integer(args[3], 'rayon', line);
      const height = integer(args[4], 'hauteur', line);
      const block = kind(args[5], line);
      if (radius < 1 || radius > 24 || height < 1 || height > 32) throw new Error(translate(`Ligne ${line} : le rayon doit être entre 1 et 24 et la hauteur entre 1 et 32.`, `Line ${line}: radius must be between 1 and 24 and height between 1 and 32.`));
      for (let y = cy; y < cy + height; y += 1) for (let x = -radius; x <= radius; x += 1) for (let z = -radius; z <= radius; z += 1) {
        if (x * x + z * z <= radius * radius) position([cx + x, y, cz + z], 0, line), put(cx + x, y, cz + z, block, line, args[6] === true);
      }
      return;
    }
    if (name === 'pyramide') {
      if (args.length !== 5 && args.length !== 6) throw new Error(translate(`Ligne ${line} : pyramide attend 5 arguments, plus true facultatif pour protéger.`, `Line ${line}: pyramid expects 5 arguments, plus optional true for protection.`));
      const [cx, cy, cz] = position(args, 0, line);
      const size = integer(args[3], 'taille', line);
      const block = kind(args[4], line);
      if (size < 1 || size > 16) throw new Error(translate(`Ligne ${line} : la taille doit être entre 1 et 16.`, `Line ${line}: size must be between 1 and 16.`));
      for (let layer = 0; layer < size; layer += 1) for (let x = -size + layer + 1; x <= size - layer - 1; x += 1) for (let z = -size + layer + 1; z <= size - layer - 1; z += 1) {
        position([cx + x, cy + layer, cz + z], 0, line);
        put(cx + x, cy + layer, cz + z, block, line, args[5] === true);
      }
      return;
    }
    if (name === 'arbre') {
      if (args.length !== 3 && args.length !== 4) throw new Error(translate(`Ligne ${line} : arbre attend 3 arguments, plus true facultatif pour protéger.`, `Line ${line}: tree expects 3 arguments, plus optional true for protection.`));
      const [x, y, z] = position(args, 0, line);
      for (let trunk = 0; trunk < 4; trunk += 1) put(x, y + trunk, z, BlockKind.Wood, line, args[3] === true);
      for (let dx = -2; dx <= 2; dx += 1) for (let dz = -2; dz <= 2; dz += 1) for (let dy = 0; dy <= 1; dy += 1) {
        if (Math.abs(dx) + Math.abs(dz) + dy <= 3) position([x + dx, y + 4 + dy, z + dz], 0, line), put(x + dx, y + 4 + dy, z + dz, BlockKind.Leaves, line, args[3] === true);
      }
      put(x, y + 6, z, BlockKind.Leaves, line, args[3] === true);
      return;
    }
    if (name === 'maison') {
      if (args.length !== 8 && args.length !== 9) throw new Error(translate(`Ligne ${line} : maison attend 8 arguments, plus true facultatif pour protéger.`, `Line ${line}: house expects 8 arguments, plus optional true for protection.`));
      const [cx, cy, cz] = position(args, 0, line);
      const width = integer(args[3], 'largeur', line);
      const depth = integer(args[4], 'profondeur', line);
      const height = integer(args[5], 'hauteur', line);
      const wall = kind(args[6], line);
      const roof = kind(args[7], line);
      if (width < 3 || depth < 3 || width > 24 || depth > 24 || height < 2 || height > 16) throw new Error(translate(`Ligne ${line} : dimensions invalides pour la maison.`, `Line ${line}: invalid house dimensions.`));
      const halfX = Math.floor(width / 2);
      const halfZ = Math.floor(depth / 2);
      for (let x = cx - halfX; x <= cx + halfX; x += 1) for (let z = cz - halfZ; z <= cz + halfZ; z += 1) {
        put(x, cy, z, BlockKind.OakPlanks, line, args[8] === true);
        for (let y = cy + 1; y < cy + height; y += 1) {
          const edge = x === cx - halfX || x === cx + halfX || z === cz - halfZ || z === cz + halfZ;
          const doorway = z === cz + halfZ && x === cx && y <= cy + 2;
          if (edge && !doorway) put(x, y, z, wall, line, args[8] === true);
        }
        for (let layer = 0; layer < 3; layer += 1) if (Math.abs(x - cx) <= halfX - layer) put(x, cy + height + layer, z, roof, line, args[8] === true);
      }
      put(cx, cy + 1, cz + halfZ, BlockKind.DoorBrown, line, args[8] === true);
      for (const side of [-1, 1]) {
        put(cx + side * halfX, cy + 2, cz, BlockKind.Glass, line, args[8] === true);
        put(cx + side, cy + 2, cz - halfZ, BlockKind.Glass, line, args[8] === true);
      }
      put(cx - 1, cy + 1, cz - 1, BlockKind.Bed, line, args[8] === true);
      put(cx + 1, cy + 1, cz, BlockKind.Chest, line, args[8] === true);
      return;
    }
    if (name === 'route') {
      if (args.length !== 8 && args.length !== 9) throw new Error(translate(`Ligne ${line} : route attend 8 arguments, plus true facultatif pour protéger.`, `Line ${line}: road expects 8 arguments, plus optional true for protection.`));
      const start = position(args, 0, line);
      const end = position(args, 3, line);
      const width = integer(args[6], 'largeur', line);
      const block = kind(args[7], line);
      if (width < 1 || width > 15 || width % 2 === 0) throw new Error(translate(`Ligne ${line} : la largeur doit être un nombre impair entre 1 et 15.`, `Line ${line}: width must be an odd number between 1 and 15.`));
      const steps = Math.max(Math.abs(end[0] - start[0]), Math.abs(end[2] - start[2]), 1);
      const horizontal = Math.abs(end[0] - start[0]) >= Math.abs(end[2] - start[2]);
      for (let index = 0; index <= steps; index += 1) {
        const ratio = index / steps;
        const x = Math.round(start[0] + (end[0] - start[0]) * ratio);
        const z = Math.round(start[2] + (end[2] - start[2]) * ratio);
        for (let offset = -(width - 1) / 2; offset <= (width - 1) / 2; offset += 1) put(x + (horizontal ? 0 : offset), start[1], z + (horizontal ? offset : 0), block, line, args[8] === true);
      }
      return;
    }
    if (name === 'champ') {
      if (args.length !== 6 && args.length !== 7) throw new Error(translate(`Ligne ${line} : champ attend 6 arguments, plus true facultatif pour protéger.`, `Line ${line}: field expects 6 arguments, plus optional true for protection.`));
      const [cx, cy, cz] = position(args, 0, line);
      const width = integer(args[3], 'largeur', line);
      const depth = integer(args[4], 'profondeur', line);
      const crop = kind(args[5], line);
      if (width < 1 || depth < 1 || width > 32 || depth > 32) throw new Error(translate(`Ligne ${line} : le champ est limité à 32 × 32.`, `Line ${line}: field is limited to 32 × 32.`));
      for (let dx = 0; dx < width; dx += 1) for (let dz = 0; dz < depth; dz += 1) {
        const x = cx + dx;
        const z = cz + dz;
        if (dx % 5 === 0) put(x, cy, z, BlockKind.CalmWater, line, args[6] === true);
        else {
          put(x, cy, z, BlockKind.Dirt, line, args[6] === true);
          if (dz % 2 === 0) put(x, cy + 1, z, crop, line, args[6] === true);
        }
      }
      return;
    }
    if (name === 'panneau') {
      if (args.length !== 4 && args.length !== 5) throw new Error(translate(`Ligne ${line} : panneau attend 4 arguments, plus true facultatif pour protéger.`, `Line ${line}: sign expects 4 arguments, plus optional true for protection.`));
      const [x, y, z] = position(args, 0, line);
      if (typeof args[3] !== 'string') throw new Error(translate(`Ligne ${line} : écris le texte du panneau entre guillemets.`, `Line ${line}: write the sign text in quotes.`));
      put(x, y, z, BlockKind.Wood, line, args[4] === true);
      const sign = { x, y: y + 1, z, kind: BlockKind.Sign, text: args[3].slice(0, 120), ...(args[4] === true ? { protected: true } : {}) };
      blocks.set(voxelKey(x, y + 1, z), sign);
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
    throw new Error(`Ligne ${line} : commande « ${name} » inconnue. Utilise terrain, bloc, remplir, sphere, ligne, mur, cylindre, pyramide, arbre, maison, route, champ, panneau, effacer, hauteur ou aleatoire.`);
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
    throw new Error(translate(`Ligne ${expression.line} : opération non autorisée.`, `Line ${expression.line}: unauthorized operation.`));
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
