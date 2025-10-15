import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { usingMockSupabase, getFixturesDir } from '@/lib/testing/test-environment';

type TableRecord = Record<string, any>;
type TableMap = Record<string, TableRecord[]>;

type QueryError = { message: string } | null;

type Operation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

type Filter = { column: string; value: any };

type OrderBy = { column: string; ascending: boolean } | null;

function clone<T>(value: T): T {
  return value ? (structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value))) : value;
}

interface MockStoreState {
  tables: TableMap;
  seed: TableMap;
}

const STORE_SYMBOL = Symbol.for('REPATCH_SUPABASE_STORE');

type GlobalWithStore = typeof globalThis & {
  [STORE_SYMBOL]?: MockStoreState;
};

function readSeed(): TableMap {
  const seedPath = process.env.REPATCH_SUPABASE_SEED;
  if (!seedPath) {
    return {};
  }

  const absolute = path.isAbsolute(seedPath)
    ? seedPath
    : path.resolve(process.cwd(), seedPath);

  if (!fs.existsSync(absolute)) {
    console.warn(`Supabase mock seed not found at ${absolute}`);
    return {};
  }

  const contents = fs.readFileSync(absolute, 'utf-8');
  try {
    const parsed = JSON.parse(contents);
    return parsed;
  } catch (error) {
    console.error('Failed to parse Supabase mock seed', error);
    return {};
  }
}

function getStore(): MockStoreState {
  const global = globalThis as GlobalWithStore;
  if (!global[STORE_SYMBOL]) {
    const seed = clone(readSeed());
    global[STORE_SYMBOL] = {
      tables: clone(seed || {}),
      seed: clone(seed || {}),
    };
  }
  return global[STORE_SYMBOL]!;
}

function resetStore() {
  const store = getStore();
  store.tables = clone(store.seed || {});
}

function ensureTable(table: string): TableRecord[] {
  const store = getStore();
  if (!store.tables[table]) {
    store.tables[table] = [];
  }
  return store.tables[table];
}

class QueryBuilder {
  private operation: Operation = 'select';
  private filters: Filter[] = [];
  private returning = false;
  private payload: TableRecord[] = [];
  private updateValues: TableRecord = {};
  private orderBy: OrderBy = null;
  private onConflict: string | null = null;

  constructor(private table: string) {}

  select(_columns: string = '*') {
    this.returning = true;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  insert(rows: TableRecord[]) {
    this.operation = 'insert';
    this.payload = rows;
    return this;
  }

  update(values: TableRecord) {
    this.operation = 'update';
    this.updateValues = values;
    return this;
  }

  upsert(rows: TableRecord | TableRecord[], options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.onConflict = options?.onConflict ?? null;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  maybeSingle() {
    const { data, error } = this.execute();
    return { data: data.length > 0 ? data[0] : null, error };
  }

  single() {
    const { data, error } = this.execute();
    if (error) {
      return { data: null, error };
    }
    if (data.length === 0) {
      return { data: null, error: { message: 'Row not found' } };
    }
    if (data.length > 1) {
      return { data: null, error: { message: 'Multiple rows returned' } };
    }
    return { data: data[0], error: null };
  }

  private matchesFilters(row: TableRecord) {
    return this.filters.every((filter) => row?.[filter.column] === filter.value);
  }

  private generateId(row: TableRecord) {
    if (!row.id) {
      row.id = randomUUID();
    }
  }

  private applyOrder(rows: TableRecord[]) {
    if (!this.orderBy) {
      return rows;
    }
    const { column, ascending } = this.orderBy;
    return [...rows].sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      if (av === undefined) return ascending ? -1 : 1;
      if (bv === undefined) return ascending ? 1 : -1;
      return ascending ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }

  private execute(): { data: TableRecord[]; error: QueryError } {
    const tableRows = ensureTable(this.table);
    switch (this.operation) {
      case 'select': {
        const filtered = tableRows.filter((row) => this.matchesFilters(row));
        const ordered = this.applyOrder(filtered);
        return { data: ordered, error: null };
      }
      case 'insert': {
        const inserted: TableRecord[] = [];
        for (const row of this.payload) {
          const newRow = { ...row };
          this.generateId(newRow);
          const now = new Date().toISOString();
          if (!newRow.created_at) newRow.created_at = now;
          if (!newRow.updated_at) newRow.updated_at = now;
          tableRows.push(newRow);
          inserted.push(newRow);
        }
        return { data: this.returning ? inserted : [], error: null };
      }
      case 'update': {
        const updated: TableRecord[] = [];
        const now = new Date().toISOString();
        tableRows.forEach((row, index) => {
          if (this.matchesFilters(row)) {
            tableRows[index] = {
              ...row,
              ...this.updateValues,
              updated_at: now,
            };
            updated.push(tableRows[index]);
          }
        });
        return { data: this.returning ? updated : [], error: null };
      }
      case 'delete': {
        const remaining = tableRows.filter((row) => !this.matchesFilters(row));
        (getStore().tables[this.table] = remaining);
        return { data: [], error: null };
      }
      case 'upsert': {
        const affected: TableRecord[] = [];
        for (const row of this.payload) {
          const newRow = { ...row };
          if (this.onConflict) {
            const existingIndex = tableRows.findIndex(
              (current) => current?.[this.onConflict!] === newRow[this.onConflict!]
            );
            if (existingIndex >= 0) {
              const now = new Date().toISOString();
              tableRows[existingIndex] = {
                ...tableRows[existingIndex],
                ...newRow,
                updated_at: now,
              };
              affected.push(tableRows[existingIndex]);
              continue;
            }
          }
          this.generateId(newRow);
          const now = new Date().toISOString();
          if (!newRow.created_at) newRow.created_at = now;
          if (!newRow.updated_at) newRow.updated_at = now;
          tableRows.push(newRow);
          affected.push(newRow);
        }
        return { data: this.returning ? affected : [], error: null };
      }
      default:
        return { data: [], error: { message: 'Unsupported operation' } };
    }
  }
}

export function createMockSupabaseClient() {
  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
  } as any;
}

export function resetMockSupabase() {
  if (!usingMockSupabase()) {
    return;
  }
  resetStore();
}

export function seedMockSupabase() {
  if (!usingMockSupabase()) {
    return;
  }
  const store = getStore();
  if (!store.seed || Object.keys(store.seed).length === 0) {
    const fixturesDir = getFixturesDir();
    const defaultSeedPath = path.join(fixturesDir, 'supabase-seed.json');
    if (fs.existsSync(defaultSeedPath)) {
      const contents = fs.readFileSync(defaultSeedPath, 'utf-8');
      const parsed = JSON.parse(contents) as TableMap;
      store.seed = clone(parsed);
      store.tables = clone(parsed);
    }
  }
}

if (usingMockSupabase()) {
  seedMockSupabase();
}
