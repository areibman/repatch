export type MockResendContact = {
  id: string;
  email: string;
  unsubscribed: boolean;
  created_at: string;
  updated_at: string;
};

type ResendListResponse = {
  data: {
    data: MockResendContact[];
  };
};

type ResendSendResponse = {
  data: {
    id: string;
  };
  error: null;
};

export interface MockResendClient {
  contacts: {
    list: (input: { audienceId: string }) => Promise<ResendListResponse>;
    create: (input: {
      email: string;
      firstName?: string;
      lastName?: string;
      unsubscribed?: boolean;
      audienceId: string;
    }) => Promise<{ data: MockResendContact } | { data: null; error: Error };
    remove: (input: { audienceId: string; id?: string; email?: string }) => Promise<{ data: { id: string } } | { data: null }>;
    update: (input: {
      audienceId: string;
      id?: string;
      email?: string;
      unsubscribed?: boolean;
    }) => Promise<{ data: MockResendContact } | { data: null }>;
  };
  emails: {
    send: (input: {
      from: string;
      to: string[];
      subject: string;
      html: string;
    }) => Promise<ResendSendResponse>;
  };
}

const CONTACTS: MockResendContact[] = [
  {
    id: "mock-contact-1",
    email: "maintainer@example.com",
    unsubscribed: false,
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    updated_at: new Date(Date.now() - 43_200_000).toISOString(),
  },
  {
    id: "mock-contact-2",
    email: "stakeholder@example.com",
    unsubscribed: false,
    created_at: new Date(Date.now() - 172_800_000).toISOString(),
    updated_at: new Date(Date.now() - 21_600_000).toISOString(),
  },
];

export function createMockResendClient(): MockResendClient {
  return {
    contacts: {
      async list() {
        return { data: { data: CONTACTS } };
      },
      async create({ email }) {
        if (CONTACTS.find((contact) => contact.email === email)) {
          return { data: null, error: new Error("Contact already exists") } as const;
        }
        const contact: MockResendContact = {
          id: `mock-${Buffer.from(email).toString("hex").slice(0, 10)}`,
          email,
          unsubscribed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        CONTACTS.push(contact);
        return { data: contact };
      },
      async remove({ id, email }) {
        const idx = CONTACTS.findIndex((contact) =>
          id ? contact.id === id : contact.email === email
        );
        if (idx === -1) {
          return { data: null };
        }
        const [removed] = CONTACTS.splice(idx, 1);
        return { data: { id: removed.id } };
      },
      async update({ id, email, unsubscribed }) {
        const contact = CONTACTS.find((item) =>
          id ? item.id === id : item.email === email
        );
        if (!contact) {
          return { data: null };
        }
        if (typeof unsubscribed === "boolean") {
          contact.unsubscribed = unsubscribed;
        }
        contact.updated_at = new Date().toISOString();
        return { data: contact };
      },
    },
    emails: {
      async send({ to }) {
        return {
          data: {
            id: `mock-email-${Date.now()}`,
          },
          error: null,
        };
      },
    },
  };
}
