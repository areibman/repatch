import { randomUUID } from "crypto";
import type { Database } from "@/lib/supabase/database.types";

export type TableName = keyof Database["public"]["Tables"];

type TableRow<K extends TableName> = Database["public"]["Tables"][K]["Row"];
type TableInsert<K extends TableName> = Database["public"]["Tables"][K]["Insert"];

type MemoryDatabase = {
  [K in TableName]: TableRow<K>[];
};

type PostgrestError = { message: string };
type PostgrestResponse<T> = {
  data: T | null;
  error: PostgrestError | null;
};

type Filter<Table extends TableName> = {
  column: keyof TableRow<Table>;
  value: unknown;
};

const GLOBAL_KEY = "__REPATCH_MEMORY_DB__";

function nowIso(): string {
  return new Date().toISOString();
}

function createDefaultVideoData() {
  return {
    langCode: "en",
    topChanges: [
      { title: "Typefully integration", description: "Queue Twitter threads" },
      { title: "Video helper", description: "Reusable Remotion renderer" },
      { title: "Playwright", description: "E2E coverage for queue flow" },
    ],
    allChanges: [
      "Typefully integration: Queue Twitter threads",
      "Video helper: Reusable Remotion renderer",
      "Playwright: E2E coverage for queue flow",
    ],
  };
}

function createInitialDb(): MemoryDatabase {
  const now = nowIso();
  return {
    patch_notes: [
      {
        id: "memory-patch-note",
        repo_name: "octo/repatch",
        repo_url: "https://github.com/octo/repatch",
        time_period: "1week",
        title: "Repatch 1.4",
        content: `- Added Typefully integration to queue patch notes threads\n- Extracted Remotion renderer helper\n- Added Playwright coverage for queueing flow`,
        changes: { added: 42, modified: 8, removed: 3 },
        contributors: ["alice", "bob"],
        generated_at: now,
        created_at: now,
        updated_at: now,
        video_data: createDefaultVideoData(),
        video_url: null,
        ai_summaries: null,
        ai_overall_summary: null,
      },
    ],
    email_subscribers: [],
    github_configs: [],
    typefully_configs: [],
    typefully_jobs: [],
  };
}

function getStore(): MemoryDatabase {
  const globalAny = globalThis as any;
  if (!globalAny[GLOBAL_KEY]) {
    globalAny[GLOBAL_KEY] = createInitialDb();
  }
  return globalAny[GLOBAL_KEY] as MemoryDatabase;
}

export function resetMemorySupabase() {
  const globalAny = globalThis as any;
  globalAny[GLOBAL_KEY] = createInitialDb();
  return globalAny[GLOBAL_KEY] as MemoryDatabase;
}

function applyFilters<Table extends TableName>(
  rows: TableRow<Table>[],
  filters: Filter<Table>[]
) {
  if (filters.length === 0) return [...rows];
  return rows.filter((row) =>
    filters.every((filter) => (row as any)[filter.column] === filter.value)
  );
}

function applyOrder<Table extends TableName>(
  rows: TableRow<Table>[],
  orderBy: { column: keyof TableRow<Table>; ascending: boolean } | null
) {
  if (!orderBy) return rows;
  return [...rows].sort((a, b) => {
    const av = (a as any)[orderBy.column];
    const bv = (b as any)[orderBy.column];
    if (av === bv) return 0;
    if (av === undefined || av === null) return orderBy.ascending ? -1 : 1;
    if (bv === undefined || bv === null) return orderBy.ascending ? 1 : -1;
    if (av > bv) return orderBy.ascending ? 1 : -1;
    if (av < bv) return orderBy.ascending ? -1 : 1;
    return 0;
  });
}

function withDefaults<Table extends TableName>(
  table: Table,
  record: TableInsert<Table>
): TableRow<Table> {
  const now = nowIso();
  switch (table) {
    case "patch_notes": {
      const input = record as TableInsert<"patch_notes">;
      return {
        id: input.id ?? randomUUID(),
        repo_name: input.repo_name!,
        repo_url: input.repo_url!,
        time_period: input.time_period!,
        title: input.title!,
        content: input.content!,
        changes: input.changes ?? { added: 0, modified: 0, removed: 0 },
        contributors: input.contributors ?? [],
        generated_at: input.generated_at ?? now,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
        video_data: input.video_data ?? null,
        video_url: input.video_url ?? null,
        ai_summaries: input.ai_summaries ?? null,
        ai_overall_summary: input.ai_overall_summary ?? null,
      } as TableRow<Table>;
    }
    case "email_subscribers": {
      const input = record as TableInsert<"email_subscribers">;
      return {
        id: input.id ?? randomUUID(),
        email: input.email!,
        active: input.active ?? true,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
      } as TableRow<Table>;
    }
    case "github_configs": {
      const input = record as TableInsert<"github_configs">;
      return {
        id: input.id ?? randomUUID(),
        repo_url: input.repo_url!,
        repo_owner: input.repo_owner ?? null,
        repo_name: input.repo_name ?? null,
        access_token: input.access_token!,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
      } as TableRow<Table>;
    }
    case "typefully_configs": {
      const input = record as TableInsert<"typefully_configs">;
      return {
        id: input.id ?? randomUUID(),
        profile_id: input.profile_id!,
        workspace_id: input.workspace_id ?? null,
        api_key: input.api_key!,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
      } as TableRow<Table>;
    }
    case "typefully_jobs": {
      const input = record as TableInsert<"typefully_jobs">;
      return {
        id: input.id ?? randomUUID(),
        patch_note_id: input.patch_note_id!,
        typefully_config_id: input.typefully_config_id!,
        thread_id: input.thread_id ?? null,
        status: input.status ?? "pending",
        error: input.error ?? null,
        video_url: input.video_url ?? null,
        payload: input.payload ?? null,
        response: input.response ?? null,
        created_at: input.created_at ?? now,
        updated_at: input.updated_at ?? now,
      } as TableRow<Table>;
    }
    default:
      throw new Error(`Unsupported table: ${table}`);
  }
}

class MemoryQueryBuilder<Table extends TableName> {
  private filters: Filter<Table>[] = [];
  private orderBy: { column: keyof TableRow<Table>; ascending: boolean } | null =
    null;
  private limitCount: number | null = null;
  private returningSingle = false;
  private maybeSingle = false;
  private returning = false;
  private operation: "select" | "insert" | "update" | "delete" = "select";
  private insertPayload: TableInsert<Table>[] = [];
  private updatePayload: Partial<TableRow<Table>> | null = null;

  constructor(private table: Table, private db: MemoryDatabase) {}

  select(_columns?: string) {
    if (this.operation === "insert" || this.operation === "update") {
      this.returning = true;
      return this;
    }
    this.operation = "select";
    return this;
  }

  insert(values: TableInsert<Table> | TableInsert<Table>[]) {
    this.operation = "insert";
    this.insertPayload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values: Partial<TableRow<Table>>) {
    this.operation = "update";
    this.updatePayload = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: keyof TableRow<Table>, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(
    column: keyof TableRow<Table>,
    options: { ascending?: boolean } = {}
  ) {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.returningSingle = true;
    this.maybeSingle = false;
    return this.execute();
  }

  maybeSingle() {
    this.maybeSingle = true;
    this.returningSingle = false;
    return this.execute();
  }

  then<TResult1 = PostgrestResponse<any>, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestResponse<any>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<PostgrestResponse<any>> {
    const tableRows = this.db[this.table] as TableRow<Table>[];
    switch (this.operation) {
      case "select":
        return this.handleSelect(tableRows);
      case "insert":
        return this.handleInsert(tableRows);
      case "update":
        return this.handleUpdate(tableRows);
      case "delete":
        return this.handleDelete(tableRows);
      default:
        return { data: null, error: { message: "Unsupported operation" } };
    }
  }

  private handleSelect(
    tableRows: TableRow<Table>[]
  ): PostgrestResponse<any> {
    let rows = applyFilters(tableRows, this.filters);
    rows = applyOrder(rows, this.orderBy);
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.returningSingle) {
      if (rows.length === 0) {
        return { data: null, error: { message: "Row not found" } };
      }
      return { data: rows[0], error: null };
    }

    if (this.maybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }

  private handleInsert(
    tableRows: TableRow<Table>[]
  ): PostgrestResponse<any> {
    const inserted = this.insertPayload.map((payload) =>
      withDefaults(this.table, payload)
    );
    tableRows.push(...inserted);

    if (this.returningSingle) {
      return { data: inserted[0] ?? null, error: null };
    }

    if (this.maybeSingle) {
      return { data: inserted[0] ?? null, error: null };
    }

    return { data: inserted, error: null };
  }

  private handleUpdate(
    tableRows: TableRow<Table>[]
  ): PostgrestResponse<any> {
    if (!this.updatePayload) {
      return { data: null, error: { message: "Missing update payload" } };
    }

    const rows = applyFilters(tableRows, this.filters);
    const now = nowIso();
    const updatedRows: TableRow<Table>[] = [];

    for (const row of rows) {
      const targetIndex = tableRows.findIndex((candidate) => candidate.id === (row as any).id);
      if (targetIndex >= 0) {
        const updatedRow = {
          ...row,
          ...this.updatePayload,
          ...("updated_at" in row ? { updated_at: now } : {}),
        } as TableRow<Table>;
        (tableRows as any)[targetIndex] = updatedRow;
        updatedRows.push(updatedRow);
      }
    }

    if (this.returningSingle) {
      if (updatedRows.length === 0) {
        return { data: null, error: { message: "Row not found" } };
      }
      return { data: updatedRows[0], error: null };
    }

    if (this.maybeSingle) {
      return { data: updatedRows[0] ?? null, error: null };
    }

    return { data: updatedRows, error: null };
  }

  private handleDelete(
    tableRows: TableRow<Table>[]
  ): PostgrestResponse<any> {
    const rows = applyFilters(tableRows, this.filters);
    const remaining = tableRows.filter((row) => !rows.includes(row));
    (this.db as any)[this.table] = remaining;
    return { data: rows, error: null };
  }
}

class MemorySupabaseClient {
  constructor(private db: MemoryDatabase) {}

  from<Table extends TableName>(table: Table) {
    return new MemoryQueryBuilder<Table>(table, this.db);
  }
}

export function createMemoryClient() {
  return new MemorySupabaseClient(getStore());
}
