# sehee-1219.github.io

Static GitHub Pages site wired to Supabase in the browser, with a simple bulletin board.

## What was added

- Live Supabase client initialization in [script.js](./script.js)
- Email sign-up, sign-in, sign-out UI in [index.html](./index.html)
- Bulletin board UI backed by the `board_posts` table
- SQL setup file in [supabase-board.sql](./supabase-board.sql)

## Supabase settings to verify

- Project URL: `https://fppakfwjnflpraokazvq.supabase.co`
- Legacy `anon` public key is stored in `script.js`
- Keep the `service_role` key out of the repository and out of client-side code
- Run `supabase-board.sql` in the Supabase SQL Editor before testing the board
- In Supabase Auth > URL Configuration, set `Site URL` to `https://sehee-1219.github.io/`
- In Supabase Auth > URL Configuration, add `https://sehee-1219.github.io/` to Additional Redirect URLs
- Enable email/password auth if you want users to publish posts

## Local preview

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy

Push to the repository's default branch. GitHub Pages will serve the root `index.html`.
