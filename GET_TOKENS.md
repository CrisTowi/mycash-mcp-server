# How to get your Supabase tokens

1. Open MyCash in Chrome/Safari while logged in
2. Open DevTools → Application → Local Storage → `https://mycash-ten.vercel.app`
3. Find the key that looks like `sb-<project-ref>-auth-token`
4. Copy the value (it's a JSON string). You need:
   - `access_token`
   - `refresh_token`
   - `expires_at` (Unix timestamp)

Or run this in the DevTools console:

```js
const key = Object.keys(localStorage).find(k => k.includes('auth-token'))
const session = JSON.parse(localStorage[key])
console.log('ACCESS:', session.access_token)
console.log('REFRESH:', session.refresh_token)
console.log('EXPIRES_AT:', session.expires_at)
```

# Claude Desktop config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mycash": {
      "command": "node",
      "args": ["/Users/cconsuelo/Documents/Development/MyCash/mycash-mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://<your-project-ref>.supabase.co",
        "SUPABASE_ANON_KEY": "<your-anon-key>",
        "MYCASH_BASE_URL": "https://mycash-ten.vercel.app",
        "MYCASH_ACCESS_TOKEN": "<access_token from above>",
        "MYCASH_REFRESH_TOKEN": "<refresh_token from above>",
        "MYCASH_TOKEN_EXPIRES_AT": "<expires_at from above>"
      }
    }
  }
}
```

After editing, **restart Claude Desktop** to pick up the new server.
