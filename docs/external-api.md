# External API

The external API exposes read-only access to sanitized patch note data for partners.
All requests must include a valid `X-Api-Key` header that references an active key
managed in the **Integrations → External API** admin screen.

## Authentication

- Provide the API key value in the `X-Api-Key` header.
- Keys can be rotated or revoked at any time. Revoke a compromised key immediately.
- Requests exceeding **60 calls per minute per key** receive a `429` response with
  a `Retry-After` header that indicates when to retry.

### Example

```http
GET /api/external/patch-notes HTTP/1.1
Host: app.example.com
X-Api-Key: rk_XXXX
Accept: application/json
```

## Endpoints

### `GET /api/external/patch-notes`

Returns up to the 25 most recent patch notes in a sanitized format.

```json
{
  "data": [
    {
      "id": "5d8f…",
      "repoName": "acme/awesome-project",
      "repoUrl": "https://github.com/acme/awesome-project",
      "title": "Weekly Update",
      "timePeriod": "1week",
      "generatedAt": "2025-10-04T14:21:00.000Z",
      "summary": "Top-line summary text",
      "highlights": [
        { "title": "Authentication", "summary": "OAuth fixes" }
      ],
      "changeMetrics": { "added": 2543, "modified": 1823, "removed": 456 }
    }
  ]
}
```

### `GET /api/external/patch-notes/:id`

Fetches a single sanitized patch note by identifier. Returns `404` when the
resource does not exist.

### `GET /api/external/summaries`

Provides a lightweight view focused on human-readable summaries and highlights.
Structure matches:

```json
{
  "data": [
    {
      "id": "5d8f…",
      "title": "Weekly Update",
      "generatedAt": "2025-10-04T14:21:00.000Z",
      "summary": "Top-line summary text",
      "highlights": [
        { "title": "Authentication", "summary": "OAuth fixes" }
      ]
    }
  ]
}
```

## Error Responses

| Status | Meaning                         | Notes                                        |
| ------ | -------------------------------- | -------------------------------------------- |
| 401    | Missing or invalid API key       | Ensure `X-Api-Key` header is present & valid |
| 403    | Revoked or expired API key       | Rotate or create a new key                   |
| 429    | Rate limit exceeded              | Respect `Retry-After` header                 |
| 500    | Internal server error            | Retry later or contact support               |

## Usage Tips

- Rotate keys regularly and update downstream services promptly.
- Use the prefix displayed in the admin UI for quick key identification.
- Store API keys in a secure secret manager—tokens are only shown once.
