Help the user interact with the Panaudia Spaces REST API. Generate working code (curl, Python, TypeScript, or other languages) for creating Spaces, browsing Projects, managing API keys, and deleting Spaces.

## Key files to consult

- `docs/spaces-api-guide.md` — the full guide with all endpoints and field descriptions
- `docs/tickets.md` — ticket (JWT) creation, referenced from the Spaces workflow
- `schemata/panaudia-spaces-1.0.2.openapi.json` — the authoritative OpenAPI spec

## Base URL

```
https://panaudia.com/shapes/v1
```

## Authentication

All endpoints except `GET /ping` require Basic HTTP auth with an API Key:
- **Username**: the API Key ID (e.g. `apikey_6905b764-b670-4184-bc80-b23c34f78bfe`)
- **Password**: the API Key Secret

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ping` | Unauthenticated liveness check |
| `GET` | `/permissions` | Check API Key permissions |
| `GET` | `/projects` | List Projects accessible to this API Key |
| `GET` | `/projects/{project-id}` | Get a single Project |
| `GET` | `/projects/{project-id}/spaces` | List Spaces in a Project (optional `?status=` filter) |
| `POST` | `/projects/{project-id}/spaces` | Create a new Space |
| `GET` | `/spaces/{space-id}` | Get a single Space |
| `DELETE` | `/spaces/{space-id}` | Delete a Space (only before booking starts, ~10 min window) |

## Creating a Space — required and optional fields

Required fields:
- **name** (string) — human-readable name
- **start_time** (string, ISO 8601) — when the Space starts
- **duration_minutes** (integer, 15–1440) — how long the Space runs
- **region** (string) — hosting region nearest to users
- **capacity** (integer, enum: 10, 25, 50, 100, 250, 500) — max participants
- **size** (integer, 10–1000) — virtual Space size in metres
- **public_key** (string) — Ed25519 PEM public key for ticket validation

Optional fields:
- **description** (string) — longer description
- **link** (boolean) — set `true` to enable Panaudia Link

## Example: curl

```bash
# Ping (no auth needed)
curl https://panaudia.com/shapes/v1/ping

# List projects
curl -u "$API_KEY_ID:$API_KEY_SECRET" \
  https://panaudia.com/shapes/v1/projects

# Create a Space
curl -X POST \
  -u "$API_KEY_ID:$API_KEY_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Space",
    "start_time": "2025-06-01T14:00:00Z",
    "duration_minutes": 60,
    "region": "London",
    "capacity": 50,
    "size": 40,
    "public_key": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----"
  }' \
  https://panaudia.com/shapes/v1/projects/$PROJECT_ID/spaces

# Delete a Space (within ~10 min of creation)
curl -X DELETE \
  -u "$API_KEY_ID:$API_KEY_SECRET" \
  https://panaudia.com/shapes/v1/spaces/$SPACE_ID
```

## Example: Python (requests)

```python
import requests

BASE = "https://panaudia.com/shapes/v1"
AUTH = ("apikey_xxx", "secret_xxx")

# List projects
projects = requests.get(f"{BASE}/projects", auth=AUTH).json()

# Create a Space
space = requests.post(
    f"{BASE}/projects/{project_id}/spaces",
    auth=AUTH,
    json={
        "name": "My Space",
        "start_time": "2025-06-01T14:00:00Z",
        "duration_minutes": 60,
        "region": "London",
        "capacity": 50,
        "size": 40,
        "public_key": public_key_pem,
    },
).json()

# Check total_price before it gets booked
print(space["total_price"])

# Delete if unhappy (within ~10 min)
requests.delete(f"{BASE}/spaces/{space['id']}", auth=AUTH)
```

## Typical workflow

1. **Get API Key** from the Panaudia web console (Organisation → API Keys)
2. **List Projects** to find the project ID
3. **Create a Space** with the desired configuration
4. **Check the response** — review `total_price` and configuration
5. **Delete** within ~10 minutes if you want to cancel
6. **Create Tickets** (see `create-tickets` skill or `docs/tickets.md`) using the Space ID as the JWT `aud` claim

## Common questions

- **"What regions are available?"** — Check the OpenAPI spec for the current enum. Currently: London.
- **"How do I filter Spaces by status?"** — Add `?status=` query param to `GET /projects/{id}/spaces`.
- **"Can I update a Space after creation?"** — No. Delete and recreate within the booking window.
- **"Where does the public key come from?"** — You generate an Ed25519 key pair. The public key goes here; the private key signs tickets. See the `create-tickets` skill.

$ARGUMENTS
