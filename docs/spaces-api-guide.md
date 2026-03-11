# Spaces API Guide

This REST API lets you create Spaces and their Tickets programmatically.

As well as this guide we have some resources to help use this API:

- [Function reference](https://panaudia.com/docs/spaces-api-v1)
- [OpenAPI spec](https://github.com/panaudia/panaudia-client/blob/main/schemata/panaudia-spaces-1.0.2.openapi.json)

## API Keys

To access this API you must use an API Key created in the Panaudia web console.

To create an API Key navigate to the Organisation page in the web console and click on the API Keys tab. Then Click + to create a new Key for this Organisation.

You will be asked to give the key a name, choose its permissions and select which projects it can access. The name can be anything you like, it's just to help you to identify it. Choose read and write for a Key that can create new Spaces and Tickets, or just read for one that can only browse resources. You can select a number of existing Projects for the Key to access or pick All Projects. If you choose All Projects the key will work for any new Projects created in the future as well as existing ones.

When you create an API Key you will see its two parts, an ID and a secret, something like this:

```
API Key ID        apikey_6905b764-b670-4184-bc80-b23c34f78bfe
API Key Secret    uphnj3nfrjw9j59y39d4zlrglq3q4i9zjz7l285y
```

Copy these both down right away and store them somewhere safe, we don't keep a copy of the secret so if you lose it you will have to delete its Key and create a new one. Store and use the Secret securely as anyone with access to it will be able to create resources on your account.

To use an API Key to access this API you should present it using Basic HTTP auth with the ID as the username and the secret as the password in every call to the API.

You can check your API is working with an unauthenticated ping:

```
GET /ping
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Auth/ping)

You can check what permissions an API Key has:

```
GET /permissions
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Auth/permissions)

## Projects

You can browse available Projects with:

```
GET /projects
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Projects/getApiKeyProjects)

And view a single Project with:

```
GET /projects/{project-id}
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Projects/getProject)

## Spaces

### Browsing Spaces

You can view all the Spaces for a Project with:

```
GET /projects/{project-id}/spaces
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Spaces/projectSpaces)

Which can also be filtered by Space status:

```
GET /projects/{project-id}/spaces?status={status}
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Spaces/projectSpaces)

And you can view a single Space with:

```
GET /spaces/{space-id}
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Spaces/getSpace)

### Creating Spaces

To create a new Space post to:

```
POST /projects/{project-id}/spaces
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Spaces/addNewSpace)

Giving these details about the space you want in a JSON body:

- **name** — A short human-readable name for the Space.
- **description** — An optional longer description of the Space.
- **start_time** — When you would like the Space to start.
- **duration_minutes** — How long the Space goes on for, in minutes (15–1440).
- **region** — Which of our available regions you would like to create the Space in. Pick the one nearest your users.
- **capacity** — The maximum number of people the Space can hold. The options are 10, 25, 50, 100, 250 or 500.
- **size** — The size across the virtual Space in meters (10–1000). Spaces are cubes with normalised coordinates (0.0–1.0); this value determines how sound is modelled across the space.
- **public_key** — The public key Panaudia will use to validate Tickets.
- **link** — Optional. Set to `true` to enable Panaudia Link for this Space.

Which should look something like this:

```json
{
  "name": "Example Space One",
  "start_time": "2024-12-05T09:30:00Z",
  "region": "London",
  "capacity": 100,
  "size": 40,
  "description": "This is a very fine example Space.",
  "duration_minutes": 60,
  "public_key": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA8gWcYikVd36AGFBDIgPRohe/qf3bzAyO2iTgz4148qQ=\n-----END PUBLIC KEY-----"
}
```

### Deleting Spaces

After creating a Space you can delete it until Panaudia starts booking the Space for you, which usually happens about ten minutes after creation. This allows you to check the configured Space's details including the `total_price` and cancel if needed.

```
DELETE /spaces/{space-id}
```

[Function reference](https://panaudia.com/docs/spaces-api-v1#/Spaces/deleteSpace)

## Tickets

See the [Tickets documentation](tickets.md) for details on creating and using Tickets.
