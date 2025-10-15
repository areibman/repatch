# External API Guide

Repatch exposes a read-only JSON API for downstream consumers. This guide summarizes the
available endpoints, authentication mechanism, and rate limiting behaviour.

## Authentication

All requests must include an API key issued from **Integrations → External API**.
Keys are hashed at rest and only shown once when created or rotated.

```http
GET https://your-app.example.com/api/external/patch-notes
X-Api-Key: rk_live_your_token_here
```

## Rate limiting

Requests are throttled to `EXTERNAL_API_RATE_LIMIT` calls per
`EXTERNAL_API_RATE_WINDOW_MS` milliseconds (defaults: 60 requests per minute).
Each response includes:

- `X-Rate-Limit-Limit` – total calls allowed during the window
- `X-Rate-Limit-Remaining` – how many calls are left
- `X-Rate-Limit-Reset` – UNIX timestamp (ms) when the window resets

Once the threshold is exceeded, the API replies with `429 Too Many Requests` and a
`Retry-After` header indicating when you can retry.

## Endpoints

### `GET /api/external/patch-notes`

Returns the latest patch notes sorted by `generatedAt` (newest first).

**Query parameters**

- `limit` – optional integer 1–50 (default 10)
- `repo` – optional repository name to filter notes
- `since` – optional ISO timestamp to return notes generated after the value

**Response**

```json
{
  "patchNotes": [
    {
      "id": "uuid",
      "title": "Weekly update",
      "repoName": "open-source/repatch",
      "repoUrl": "https://github.com/open-source/repatch",
      "generatedAt": "2025-01-06T15:21:00.000Z",
      "timePeriod": "1week",
      "summary": "High-level summary of the iteration.",
      "content": "Markdown body of the patch note...",
      "totals": { "added": 10, "modified": 4, "removed": 2 },
      "contributors": ["octocat"],
      "highlights": [
        {
          "sha": "abcdef1",
          "message": "Improve onboarding flow",
          "summary": "AI summary of the commit.",
          "additions": 120,
          "deletions": 10
        }
      ]
    }
  ]
}
```

### `GET /api/external/patch-notes/:id`

Returns a single sanitized patch note using the same shape as the collection
endpoint. Missing records respond with `404 Not Found`.

## Error reference

| Status | Meaning |
| --- | --- |
| `401 Unauthorized` | Missing, invalid, revoked, or expired API key |
| `404 Not Found` | Patch note does not exist |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Server misconfiguration or transient failure |

## Managing API keys

Use the External API integration page to create, rotate, or revoke tokens. Copy the
plaintext token immediately and store it in your secret manager — the value cannot be
retrieved later.
