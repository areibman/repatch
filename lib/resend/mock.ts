import { randomUUID } from "crypto";

type ContactInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
  audienceId?: string;
  id?: string;
};

type ContactRecord = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed: boolean;
  audienceId: string;
  created_at: string;
  updated_at: string;
};

type Seed = {
  contacts?: Array<Partial<ContactRecord>>;
};

const globalStore = globalThis as {
  __resendStore?: {
    contacts: ContactRecord[];
  };
};

function ensureStore() {
  if (!globalStore.__resendStore) {
    globalStore.__resendStore = { contacts: [] };
  }
  return globalStore.__resendStore;
}

function normalizeContact(input: Partial<ContactRecord> & { email: string; audienceId?: string }): ContactRecord {
  const now = new Date().toISOString();
  return {
    id: input.id ?? randomUUID(),
    email: input.email,
    firstName: input.firstName ?? "",
    lastName: input.lastName ?? "",
    unsubscribed: input.unsubscribed ?? false,
    audienceId: input.audienceId ?? "default",
    created_at: input.created_at ?? now,
    updated_at: now,
  };
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function createMockResend() {
  const store = ensureStore();

  return {
    contacts: {
      list: async ({ audienceId }: { audienceId: string }) => {
        const contacts = store.contacts.filter((contact) => contact.audienceId === audienceId);
        return {
          data: {
            data: clone(contacts),
          },
        };
      },
      create: async ({ email, firstName, lastName, unsubscribed, audienceId }: ContactInput) => {
        const existing = store.contacts.find((contact) => contact.email === email);
        if (existing) {
          throw new Error("Contact already exists");
        }
        const record = normalizeContact({
          email,
          firstName,
          lastName,
          unsubscribed,
          audienceId,
        });
        store.contacts.push(record);
        return { data: clone(record) };
      },
      remove: async ({ id, email, audienceId }: { id?: string; email?: string; audienceId: string }) => {
        const index = store.contacts.findIndex((contact) => {
          if (id) {
            return contact.id === id && contact.audienceId === audienceId;
          }
          if (email) {
            return contact.email === email && contact.audienceId === audienceId;
          }
          return false;
        });
        if (index === -1) {
          throw new Error("Contact not found");
        }
        const [removed] = store.contacts.splice(index, 1);
        return { data: clone(removed) };
      },
      update: async ({ id, email, audienceId, unsubscribed }: { id?: string; email?: string; audienceId: string; unsubscribed?: boolean }) => {
        const contact = store.contacts.find((record) => {
          if (id) {
            return record.id === id && record.audienceId === audienceId;
          }
          if (email) {
            return record.email === email && record.audienceId === audienceId;
          }
          return false;
        });
        if (!contact) {
          throw new Error("Contact not found");
        }
        contact.unsubscribed = unsubscribed ?? contact.unsubscribed;
        contact.updated_at = new Date().toISOString();
        return { data: clone(contact) };
      },
    },
  };
}

export function resetMockResend(seed?: Seed) {
  const store = ensureStore();
  store.contacts = (seed?.contacts ?? []).map((contact) =>
    normalizeContact({
      email: contact.email!,
      firstName: contact.firstName,
      lastName: contact.lastName,
      unsubscribed: contact.unsubscribed,
      audienceId: contact.audienceId,
      id: contact.id,
      created_at: contact.created_at,
    })
  );
}

export function getResendSnapshot() {
  return clone(ensureStore());
}
