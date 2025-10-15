# Email Integrations

Repatch can deliver newsletters through multiple providers. The app stores provider credentials in Supabase so you can switch between services without redeploying the project. Use the **Integrations → Email** pages in the dashboard to manage settings after running migrations.

## Prerequisites

- Run the Supabase migration `supabase/migrations/20250107000000_add_email_integrations.sql` to create the `email_integrations` table.
- Seed at least one subscriber via `/api/subscribers` or the Subscribers dashboard before triggering a send test.
- Restart the dev server after editing `.env.local` so new provider credentials load into server-side routes.

## Resend

Resend is enabled by default for backwards compatibility. If the `email_integrations` table is empty, the API falls back to the `RESEND_*` environment variables.

### Required values

| Field | Description |
| --- | --- |
| `RESEND_API_KEY` | Server-side API key with access to your newsletter audience. |
| `RESEND_AUDIENCE_ID` | Audience that stores newsletter subscribers (used for list syncs). |

### Optional values

| Field | Description |
| --- | --- |
| `RESEND_FROM_EMAIL` | Default sender email address. |
| `RESEND_FROM_NAME` | Display name for the sender. |
| `RESEND_REPLY_TO` | Reply-to override for newsletter emails. |

### Configuring in the UI

1. Navigate to **Integrations → Resend**.
2. Enter your API key, audience ID, sender, and reply-to values.
3. Check **Set Resend as the active provider after saving** if you want it to deliver new campaigns.
4. Click **Save configuration**.

## Customer.io

Customer.io uses the Transactional API to send newsletters. The integration sends one message per recipient to ensure tracking and opt-out enforcement.

### Required values

| Field | Description |
| --- | --- |
| `CUSTOMERIO_TRANSACTIONAL_API_KEY` | API key with access to transactional messaging. |
| `CUSTOMERIO_TRANSACTIONAL_MESSAGE_ID` | Identifier of the transactional message template to trigger. |

### Optional values

| Field | Description |
| --- | --- |
| `CUSTOMERIO_FROM_EMAIL` | Default sender email address. |
| `CUSTOMERIO_FROM_NAME` | Display name for the sender. |
| `CUSTOMERIO_REPLY_TO` | Reply-to override for newsletters. |
| `CUSTOMERIO_REGION` | Workspace region (`us` or `eu`). Defaults to `us`. |

### Configuring in the UI

1. Navigate to **Integrations → Customer.io**.
2. Paste your transactional API key and message ID.
3. Provide sender, reply-to, and region details.
4. Toggle **Set Customer.io as the active provider after saving** to make it live.
5. Click **Save configuration**.

## Switching providers

- The active provider is stored in Supabase (`email_integrations.is_active`).
- Switching providers automatically deactivates others so only one service sends newsletters at a time.
- Patch note and subscriber pages surface the current provider so teams know which service will deliver emails.

## Testing

- Run `bun run lint` for static checks.
- Use `npx playwright test` to execute mocked end-to-end flows under `tests/e2e`.
- When working locally, start the dev server with `bun dev` before running Playwright so the UI is accessible at `http://localhost:3000`.
