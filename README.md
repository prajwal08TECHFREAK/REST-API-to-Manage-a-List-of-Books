# 📚 Books API — Node.js + Express

A minimal REST API for managing a list of books. CRUD operations, in-memory storage (no database), input validation and proper HTTP status codes.

Built as a learning project — every part of `server.js` is commented.

---

## Quick start

```bash
npm install     # installs express
npm start       # starts the server on http://localhost:3000
```

Then open <http://localhost:3000> in a browser — you get a web UI you can click through.
Prefer the terminal? Run the automated smoke test in a **second** terminal:

```bash
npm test        # 18 curl-based checks: happy paths + error cases
```

Useful extras:

```bash
npm run dev                 # auto-restarts on file changes (node --watch)
PORT=4000 npm start         # run on a different port
BASE=http://localhost:4000 npm test
```

> **The API only works while `server.js` is running.** If you close the terminal, the API is gone. See [Hosting this project](#hosting-this-project-read-this-if-you-published-it-to-github-pages) below.

---

## ⚠️ Hosting this project (read this if you published it to GitHub Pages)

**GitHub Pages cannot run this API.** It is a static file host: it serves HTML, CSS, JavaScript and images, and nothing else. It cannot start a Node process, so `server.js` never executes and every endpoint returns a `404` HTML page.

Two things go wrong when you push this repo to Pages as-is:

1. **The homepage shows the README instead of the UI.** Pages builds with Jekyll, and Jekyll's `jekyll-readme-index` plugin turns `README.md` into `index.html` whenever the repository root has no `index.html` of its own. In this repo the UI lives at the root as `index.html`, so that no longer happens — and a `.nojekyll` file is included to skip Jekyll entirely and serve the files exactly as they are.
2. **Even with the UI served, the API calls fail.** The page loads, then `fetch('/books')` hits GitHub's servers, which reply `404 text/html`. The catalogue stays empty.

### What this repo does about it

`index.html` checks for a live API on load by calling `GET /health` and looking for a JSON response. There are three outcomes:

| Situation | What you see |
| --- | --- |
| Page served **by Express** (`npm start`, <http://localhost:3000>) | The normal UI, talking to the real API. No footnote. |
| Page on static hosting, **no API reachable** | A one-line footnote, and the UI switches to **demo mode**. |
| Page on static hosting **plus `?api=<url>`** | The UI talks to that remote API. The footnote confirms the connection. |

**Demo mode** is a copy of the API reimplemented in the browser: the same routes, the same validation rules, the same response shapes and the same status codes (`201`, `204`, `400`, `404`), stored in your browser's `localStorage`. It is a faithful rehearsal of the real thing — useful for showing the project on a portfolio page — but it is *not* the Express server, and the data never leaves that one browser. The only endpoint that differs is `GET /health`, which reports `"mode": "demo (in-browser)"` instead of `"uptimeSeconds"`.

The footnote carries two small text links: **reset the shelf** (clears `localStorage` and restores the three seed books) and **look for a live server** (reloads and probes again). Nothing else on the page mentions the fallback — the aim is a page that reads like a book, not like a console. The technical explanation lives here in the README instead.

### Option A — run it locally (what the project is for)

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install
npm start
# open http://localhost:3000
```

### Option B — deploy the API to a host that runs Node

Keep the UI on GitHub Pages and put `server.js` somewhere that can execute it. `server.js` already reads `process.env.PORT`, which is what these platforms expect.

**Render** (free tier)

1. Push the repo to GitHub.
2. <https://render.com> → **New** → **Web Service** → connect the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy. You get a URL like `https://books-api-xxxx.onrender.com`.
6. Open your Pages site as
   `https://<you>.github.io/<repo>/?api=https://books-api-xxxx.onrender.com`

**Railway** — create a project **from a GitHub repo**; it detects Node and runs `npm start`, and injects `PORT` automatically. Same `?api=` step afterwards.

**Fly.io** — `fly launch` generates a Dockerfile and `fly.toml`; set the internal port to 3000.

Other workable choices: Koyeb, Azure App Service, a VPS with `pm2`, or Docker anywhere.

Free tiers usually sleep when idle, so the first request after a pause can take 10–30 seconds.

### CORS is already handled

Because the UI and the API are then on **different origins**, the browser blocks the calls unless the API sends CORS headers. `server.js` includes a small hand-written CORS middleware (no extra dependency) that answers the `OPTIONS` preflight and allows `GET, POST, PUT, PATCH, DELETE`:

```bash
npm start                                # allows any origin (fine for a demo)
CORS_ORIGIN=https://<you>.github.io npm start   # restrict it to your site
```

Restrict the origin before you add authentication or anything private. `Access-Control-Allow-Origin: *` means any website can call your API.

### Other ways to get a live API on a static site

- **Serverless functions.** Port the handlers to Vercel, Netlify or Cloudflare Workers functions and point `?api=` at them. The route logic transfers almost unchanged; the in-memory array does not survive between invocations, so you would need a real store.
- **A mock API service.** JSONPlaceholder-style hosts can fake GET requests but not your validation rules.
- **Skip the UI.** Publish the repo as documentation only — the README, the curl examples and the Postman collection all stand on their own, and anyone reviewing the project can run it locally.

---

## Endpoints

| Method | Path            | Description                       | Success | Errors          |
| ------ | --------------- | --------------------------------- | ------- | --------------- |
| GET    | `/books`        | List all books (optional filters) | `200`   | —               |
| GET    | `/books/:id`    | Get one book                      | `200`   | `400`, `404`    |
| POST   | `/books`        | Create a book                     | `201`   | `400`           |
| PUT    | `/books/:id`    | Replace a book (all fields)       | `200`   | `400`, `404`    |
| PATCH  | `/books/:id`    | Partially update a book           | `200`   | `400`, `404`    |
| DELETE | `/books/:id`    | Delete a book                     | `204`   | `400`, `404`    |
| GET    | `/health`       | Liveness check                    | `200`   | —               |
| GET    | `/`             | API index (JSON) or the web UI    | `200`   | —               |

`GET /` uses content negotiation: a browser sending `Accept: text/html` receives `index.html`; curl and Postman receive a JSON index of the endpoints.

Query filters on `GET /books`: `?search=` (title or author), `?title=`, `?author=`.

A book object looks like this:

```json
{ "id": 1, "title": "Clean Code", "author": "Robert C. Martin" }
```

`id` is generated by the server — never send it yourself.

---

## Example requests (curl)

```bash
# 1. List all books
curl http://localhost:3000/books

# 2. Get one book
curl http://localhost:3000/books/2

# 3. Create a book  (Content-Type: application/json is required)
curl -X POST http://localhost:3000/books \
     -H "Content-Type: application/json" \
     -d '{"title":"The Hobbit","author":"J.R.R. Tolkien"}'

# 4. Update a book (PUT = full replace)
curl -X PUT http://localhost:3000/books/4 \
     -H "Content-Type: application/json" \
     -d '{"title":"The Hobbit (2nd ed.)","author":"J.R.R. Tolkien"}'

# 4b. Update a book (PATCH = only the fields you send)
curl -X PATCH http://localhost:3000/books/4 \
     -H "Content-Type: application/json" \
     -d '{"author":"Tolkien, J.R.R."}'

# 5. Delete a book (no response body, status 204)
curl -i -X DELETE http://localhost:3000/books/4

# 6. Search
curl "http://localhost:3000/books?search=hobbit"
```

---

## Example responses

**`GET /books` → `200 OK`**

```json
{
  "count": 3,
  "data": [
    { "id": 1, "title": "The Pragmatic Programmer", "author": "Hunt & Thomas" },
    { "id": 2, "title": "Clean Code", "author": "Robert C. Martin" },
    { "id": 3, "title": "Eloquent JavaScript", "author": "Marijn Haverbeke" }
  ]
}
```

**`POST /books` → `201 Created`** (also sets a `Location: /books/4` header)

```json
{
  "message": "Book created.",
  "data": { "id": 4, "title": "The Hobbit", "author": "J.R.R. Tolkien" }
}
```

**`POST /books` with a bad body → `400 Bad Request`**

```json
{
  "error": "Validation failed.",
  "details": ["Field \"author\" is required and must be a non-empty string."]
}
```

**`GET /books/999` → `404 Not Found`**

```json
{ "error": "Book with id 999 not found." }
```

**`DELETE /books/4` → `204 No Content`** (empty body, as per HTTP spec)

---

## The web UI

`index.html` is a single self-contained file — no build step, no framework, no external fonts, images or CDNs, so it renders the same offline as online. Set in black and white like a printed book.

- **Chapter I — Add a Volume:** `POST /books`, plus a button that deliberately sends an invalid body so you can read the `400` response.
- **Chapter II — The Catalogue:** `GET /books` with a live search box; each row has **Get**, **Edit** (`PUT`), **Author** (`PATCH`) and **Delete**.
- **Chapter III — The Day Book:** each request is logged as a plain-English line — the HTTP verb, what it did (*"Added a volume"*, *"Withdrew volume 4"*) and the status code. The request path and the formatted JSON response are folded away behind a **response** toggle, so the page shows no code until you ask for it. A running tally sits above the ledger.
- **Run full CRUD demo:** walks all seven endpoints in order, including a `400` and two `404`s, so the status codes can be compared side by side.

It talks to the API with **relative URLs**, which is why it works when Express serves it and why it needs `?api=` when it is hosted somewhere else.

---

## Testing with Postman

1. Start the server: `npm start`
2. In Postman: **Import** → select `Books-API.postman_collection.json`
3. Pick any request and hit **Send**.

The collection includes a test script on *Create book* that saves the new `id` into the `book_id` variable, so the Get / Update / Delete requests point at the book you just created. It also has two "should fail" requests (400 and 404) with assertions, so you can run the whole collection with **Collection Runner** and see green ticks.

Collection variables you can change: `base_url` (default `http://localhost:3000` — set this to your deployed URL), `book_id`.

---

## Project structure

```
.
├── server.js                             # the whole API (commented line by line)
├── index.html                            # the web UI, served at / by Express
│                                         #   and directly by GitHub Pages
├── test.sh                               # curl-based end-to-end smoke test
├── Books-API.postman_collection.json     # importable Postman collection
├── package.json
├── package-lock.json
├── .nojekyll                             # tells GitHub Pages to skip Jekyll
├── .gitignore
└── README.md
```

`index.html` sits at the repository root, not in a `public/` folder, because GitHub Pages only serves `index.html` as a homepage from the root. Express delivers it with `res.sendFile` rather than `express.static(__dirname)` — serving the project root statically would also expose `server.js`, `package.json` and any `.env` file to whoever asked for them.

### How the server is put together

| Piece                                | What it does                                                          |
| ------------------------------------ | --------------------------------------------------------------------- |
| `app.use(express.json())`            | Parses JSON request bodies into `req.body`. Without it, `req.body` is `undefined`. |
| CORS middleware                      | Adds `Access-Control-Allow-*` headers and answers the `OPTIONS` preflight, so a UI on another origin can call the API. |
| `let books = [...]`                  | The in-memory store. It is lost on every restart.                     |
| `let nextId = ...`                   | Auto-increment counter for new books.                                 |
| `validateBook(body, partialAllowed)` | Shared validation: required non-empty strings, rejects unknown fields and client-set `id`. |
| `parseId(raw)`                       | Route params are always strings — this converts `/books/4` → `4` and rejects `abc`. |
| `app.use((req,res)=>...)`            | Catch-all 404 handler, registered *after* the real routes.            |
| `app.use((err,req,res,next)=>...)`   | Central error handler (4 parameters = Express knows it is error middleware). Turns malformed JSON into a clean `400`. |

### Status codes used, and why

- **200 OK** — successful GET / PUT / PATCH.
- **201 Created** — POST that made a new resource, with a `Location` header.
- **204 No Content** — DELETE succeeded; there is nothing left to return.
- **400 Bad Request** — the client sent something unusable (bad JSON, missing fields, non-numeric id).
- **404 Not Found** — the route or the book id does not exist.

---

## Notes & limitations

- **No database.** Data lives in a plain array and disappears when the process stops — including on every deploy. Swap the array for a real store (a JSON file, SQLite, Postgres, MongoDB) by changing only the route handlers.
- **Not safe to scale horizontally.** Two instances would each keep their own array. Fine for one process, wrong for a cluster.
- **Express 5** is installed (`express@^5`). Differences from Express 4 worth knowing: async route handlers that reject are forwarded to the error handler automatically, and route-path syntax is stricter.
- **CORS is wide open by default.** Set `CORS_ORIGIN` to your site's origin before adding anything sensitive.
- **No pagination** — a real list endpoint would add `?page=` and `?limit=`.
- **`DELETE` returns 204 with no body.** If your Postman test expects JSON, use `200` + `{ "message": "Book deleted." }` instead.

## Next steps if you want to extend it

1. Split routes into `routes/books.js` with `express.Router()` and mount via `app.use('/books', booksRouter)`.
2. Add `year`, `isbn` or `genre` fields (remember to update `validateBook`, and the demo-mode copy in `index.html`).
3. Persist to a JSON file with `fs.writeFileSync`, or move to SQLite via `better-sqlite3`.
4. Add real unit tests with Jest or Node's built-in `node:test` + `supertest`.
5. Add rate limiting (`express-rate-limit`) and schema validation with `zod`.
6. Add a `Dockerfile` so the API deploys anywhere unchanged.
