export const metadata = {
  title: 'External API',
};

const rateLimit = process.env.EXTERNAL_API_RATE_LIMIT ?? '60';
const rateWindowMs = process.env.EXTERNAL_API_RATE_WINDOW_MS ?? '60000';

export default function ExternalApiDocsPage() {
  const windowMinutes = Math.round(Number(rateWindowMs) / 60000);

  return (
    <div className="container mx-auto px-4 py-10 prose prose-slate dark:prose-invert">
      <h1>External API</h1>
      <p>
        Repatch exposes a read-only HTTP API for distributing sanitized patch notes and
        AI summaries to downstream consumers. All requests must include a valid API key
        issued from <code>Integrations → External API</code>.
      </p>

      <h2>Authentication</h2>
      <p>
        Provide your token in the <code>X-Api-Key</code> header. Keys are hashed at rest, so
        you will only see the plaintext value once during creation or rotation.
      </p>
      <pre>
{`GET https://your-app.example.com/api/external/patch-notes
X-Api-Key: rk_1234...`}
      </pre>

      <h2>Rate limiting</h2>
      <p>
        Requests are limited to approximately {rateLimit} calls every{' '}
        {windowMinutes || 1} minute(s). When you approach the limit, responses include
        the following headers:
      </p>
      <ul>
        <li>
          <code>X-Rate-Limit-Limit</code> — the total number of calls allowed in the window
        </li>
        <li>
          <code>X-Rate-Limit-Remaining</code> — how many calls you can still make
        </li>
        <li>
          <code>X-Rate-Limit-Reset</code> — UNIX timestamp (ms) when the window resets
        </li>
      </ul>
      <p>
        If the limit is exceeded the API responds with <code>429 Too Many Requests</code> and
        includes a <code>Retry-After</code> header.
      </p>

      <h2>Endpoints</h2>
      <h3>GET /api/external/patch-notes</h3>
      <p>Returns the newest patch notes sorted by <code>generatedAt</code>.</p>
      <h4>Query parameters</h4>
      <ul>
        <li>
          <code>limit</code> — optional integer between 1 and 50 (default 10)
        </li>
        <li>
          <code>repo</code> — optional repository name to filter results
        </li>
        <li>
          <code>since</code> — optional ISO date string to return notes generated after the timestamp
        </li>
      </ul>
      <h4>Response</h4>
      <pre>
{`{
  "patchNotes": [
    {
      "id": "uuid",
      "title": "Weekly update",
      "repoName": "open-source/repatch",
      "repoUrl": "https://github.com/open-source/repatch",
      "generatedAt": "2025-01-06T15:21:00.000Z",
      "timePeriod": "1week",
      "summary": "High-level AI generated summary.",
      "content": "Markdown body of the patch note...",
      "totals": { "added": 10, "modified": 4, "removed": 2 },
      "contributors": ["octocat"],
      "highlights": [
        {
          "sha": "abcdef1",
          "message": "Improve onboarding",
          "summary": "AI summary for the commit.",
          "additions": 120,
          "deletions": 10
        }
      ]
    }
  ]
}`}
      </pre>

      <h3>GET /api/external/patch-notes/:id</h3>
      <p>
        Returns a single sanitized patch note. The shape matches the objects in the
        collection response and includes the same rate-limit headers.
      </p>

      <h2>Error handling</h2>
      <ul>
        <li>
          <code>401 Unauthorized</code> — missing, invalid, revoked, or expired API key
        </li>
        <li>
          <code>404 Not Found</code> — patch note does not exist
        </li>
        <li>
          <code>429 Too Many Requests</code> — slow down and retry after the provided interval
        </li>
      </ul>

      <h2>Managing keys</h2>
      <p>
        Use the External API integration page to create, rotate, or revoke tokens. Each
        action returns the token value once, so copy it immediately and store it in your
        secret manager.
      </p>
    </div>
  );
}
