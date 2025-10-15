import { randomUUID } from "crypto";

type TableStore = Record<string, any[]>;

type PostgrestError = {
  message: string;
  details: string | null;
  hint: string | null;
  code: string | null;
};

type SelectResult<T> = Promise<{ data: T[]; error: PostgrestError | null }>;
type SingleResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>;

type SeedData = {
  patch_notes?: any[];
  email_subscribers?: any[];
  github_configs?: any[];
};

type Filter = {
  column: string;
  value: any;
};

type OrderBy = {
  column: string;
  ascending: boolean;
};

const defaultTables = (): TableStore => ({
  patch_notes: [],
  email_subscribers: [],
  github_configs: [],
});

const globalStore = globalThis as {
  __supabaseMockStore?: TableStore;
};

function cloneDeep<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function ensureStore(): TableStore {
  if (!globalStore.__supabaseMockStore) {
    globalStore.__supabaseMockStore = defaultTables();
  }
  return globalStore.__supabaseMockStore;
}

function normalizeRows(rows: any[]): any[] {
  return rows.map((row) => {
    const now = new Date().toISOString();
    return {
      ...row,
      id: row.id ?? randomUUID(),
      created_at: row.created_at ?? now,
      updated_at: now,
    };
  });
}

function createError(message: string): PostgrestError {
  return { message, details: null, hint: null, code: "MOCK" };
}

class ImmediateResultBuilder<T> {
  private readonly rows: T[];

  constructor(rows: T[]) {
    this.rows = cloneDeep(rows);
  }

  async single(): SingleResult<T> {
    const first = this.rows[0] ?? null;
    if (!first) {
      return { data: null, error: createError("No rows returned") };
    }
    return { data: first, error: null };
  }

  async maybeSingle(): SingleResult<T> {
    const first = this.rows[0] ?? null;
    return { data: first, error: null };
  }

  async then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows, error: null }).then(onfulfilled, onrejected);
  }

  async catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<{ data: T[]; error: null } | TResult> {
    return Promise.resolve({ data: this.rows, error: null }).catch(onrejected);
  }
}

class FilterableBuilder<T> {
  protected filters: Filter[] = [];
  protected orderBy: OrderBy | null = null;

  constructor(protected readonly tableName: string, protected readonly store: TableStore) {}

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  protected applyFilters(rows: any[]): any[] {
    let result = rows;
    if (this.filters.length > 0) {
      result = result.filter((row) =>
        this.filters.every((filter) => row?.[filter.column] === filter.value)
      );
    }
    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      result = [...result].sort((a, b) => {
        if (a?.[column] === b?.[column]) return 0;
        if (a?.[column] === undefined) return ascending ? -1 : 1;
        if (b?.[column] === undefined) return ascending ? 1 : -1;
        return ascending
          ? a[column] > b[column]
            ? 1
            : -1
          : a[column] > b[column]
          ? -1
          : 1;
      });
    }
    return result;
  }
}

class SelectBuilder<T> extends FilterableBuilder<T> implements PromiseLike<{ data: T[]; error: PostgrestError | null }> {
  constructor(tableName: string, store: TableStore) {
    super(tableName, store);
  }

  select(_columns = "*") {
    return this;
  }

  async execute(): SelectResult<T> {
    const rows = this.applyFilters(this.store[this.tableName] ?? []);
    return { data: cloneDeep(rows), error: null };
  }

  async single(): SingleResult<T> {
    const { data } = await this.execute();
    const row = data[0] ?? null;
    if (!row) {
      return { data: null, error: createError("No rows returned") };
    }
    return { data: row, error: null };
  }

  async maybeSingle(): SingleResult<T> {
    const { data } = await this.execute();
    return { data: data[0] ?? null, error: null };
  }

  async then<TResult1 = { data: T[]; error: PostgrestError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: PostgrestError | null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<{ data: T[]; error: PostgrestError | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

class UpdateBuilder<T> extends FilterableBuilder<T> {
  constructor(tableName: string, store: TableStore, private readonly values: Partial<T>) {
    super(tableName, store);
  }

  select(_columns = "*") {
    const rows = this.applyUpdates();
    return new ImmediateResultBuilder<T>(rows as T[]);
  }

  async then<TResult1 = { data: T[]; error: PostgrestError | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T[]; error: PostgrestError | null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    const rows = this.applyUpdates();
    return Promise.resolve({ data: cloneDeep(rows as T[]), error: null }).then(
      onfulfilled,
      onrejected
    );
  }

  private applyUpdates(): any[] {
    const table = this.store[this.tableName] ?? [];
    const now = new Date().toISOString();
    const updated: any[] = [];
    this.store[this.tableName] = table.map((row) => {
      const matches = this.filters.every((filter) => row?.[filter.column] === filter.value);
      if (!matches) {
        return row;
      }
      const nextRow = { ...row, ...this.values, updated_at: now };
      updated.push(nextRow);
      return nextRow;
    });
    return updated;
  }
}

class DeleteBuilder extends FilterableBuilder<any> implements PromiseLike<{ error: PostgrestError | null }> {
  constructor(tableName: string, store: TableStore) {
    super(tableName, store);
  }

  async execute(): Promise<{ error: PostgrestError | null }> {
    const table = this.store[this.tableName] ?? [];
    const remaining = table.filter(
      (row) => !this.filters.every((filter) => row?.[filter.column] === filter.value)
    );
    this.store[this.tableName] = remaining;
    return { error: null };
  }

  async then<TResult1 = { error: PostgrestError | null }, TResult2 = never>(
    onfulfilled?: ((value: { error: PostgrestError | null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<{ error: PostgrestError | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

class InsertBuilder<T> {
  private readonly rows: any[];

  constructor(tableName: string, store: TableStore, payload: any[]) {
    const table = store[tableName] ?? [];
    const normalized = normalizeRows(payload);
    store[tableName] = [...table, ...normalized];
    this.rows = normalized;
  }

  select(_columns = "*") {
    return new ImmediateResultBuilder<T>(this.rows as T[]);
  }
}

class UpsertBuilder<T> {
  private readonly rows: any[];

  constructor(
    tableName: string,
    store: TableStore,
    payload: any,
    options?: { onConflict?: string }
  ) {
    const table = store[tableName] ?? [];
    const conflictKey = options?.onConflict;
    const now = new Date().toISOString();
    let mergedRow: any = payload;

    if (conflictKey) {
      const index = table.findIndex((row) => row?.[conflictKey] === payload?.[conflictKey]);
      if (index >= 0) {
        const existing = table[index];
        mergedRow = { ...existing, ...payload, updated_at: now };
        table[index] = mergedRow;
      } else {
        mergedRow = normalizeRows([payload])[0];
        table.push(mergedRow);
      }
    } else {
      mergedRow = normalizeRows([payload])[0];
      table.push(mergedRow);
    }

    store[tableName] = table;
    this.rows = [mergedRow];
  }

  select(_columns = "*") {
    return new ImmediateResultBuilder<T>(this.rows as T[]);
  }
}

export class MockSupabaseClient {
  constructor(private readonly store: TableStore) {}

  from<T>(tableName: string) {
    if (!this.store[tableName]) {
      this.store[tableName] = [];
    }

    return {
      select: (_columns = "*") => new SelectBuilder<T>(tableName, this.store).select(_columns),
      insert: (payload: any[]) => new InsertBuilder<T>(tableName, this.store, payload),
      update: (values: Partial<T>) => new UpdateBuilder<T>(tableName, this.store, values),
      upsert: (payload: any, options?: { onConflict?: string }) =>
        new UpsertBuilder<T>(tableName, this.store, payload, options),
      delete: () => new DeleteBuilder(tableName, this.store),
      eq: (column: string, value: any) => new SelectBuilder<T>(tableName, this.store).eq(column, value),
    };
  }
}

export function createMockClient() {
  return new MockSupabaseClient(ensureStore());
}

export function resetMockSupabase(seed?: SeedData) {
  const store = ensureStore();
  store.patch_notes = normalizeRows(seed?.patch_notes ?? []);
  store.email_subscribers = normalizeRows(seed?.email_subscribers ?? []);
  store.github_configs = normalizeRows(seed?.github_configs ?? []);
}

export function getSupabaseSnapshot() {
  const store = ensureStore();
  return cloneDeep(store);
}
