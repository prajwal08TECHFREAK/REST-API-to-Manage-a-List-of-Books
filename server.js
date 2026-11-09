/**
 * Books REST API
 * --------------
 * A simple CRUD API built with Node.js + Express.
 * Data is stored in memory (an array), so it resets on every restart.
 *
 * Endpoints
 *   GET    /books      -> list all books
 *   GET    /books/:id  -> get one book
 *   POST   /books      -> create a book
 *   PUT    /books/:id  -> update a book (full replace)
 *   PATCH  /books/:id  -> update a book (partial)
 *   DELETE /books/:id  -> delete a book
 *   GET    /health     -> liveness check
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Parses incoming JSON request bodies and puts the result on `req.body`.
// Without this line, req.body would be undefined.
app.use(express.json());

// Tiny request logger so you can see each call in the terminal.
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.originalUrl}`);
  next();
});

// ---------------------------------------------------------------------------
// In-memory "database"
// ---------------------------------------------------------------------------

/** @type {{id: number, title: string, author: string}[]} */
let books = [
  { id: 1, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas' },
  { id: 2, title: 'Clean Code', author: 'Robert C. Martin' },
  { id: 3, title: 'Eloquent JavaScript', author: 'Marijn Haverbeke' },
];

// Next id to hand out. Starts after the highest existing id so seed data and
// new data never collide.
let nextId = books.reduce((max, book) => Math.max(max, book.id), 0) + 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a book payload.
 * @param {any} body              the raw request body
 * @param {boolean} partialAllowed when true, missing fields are OK (PATCH)
 * @returns {string[]}            list of human-readable errors (empty = valid)
 */
function validateBook(body, partialAllowed = false) {
  const errors = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }

  // `id` is server-managed — clients must not send it.
  if (body.id !== undefined) {
    errors.push('Field "id" is managed by the server and cannot be set.');
  }

  for (const field of ['title', 'author']) {
    if (partialAllowed && body[field] === undefined) continue; // field not being updated
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      errors.push(`Field "${field}" is required and must be a non-empty string.`);
    }
  }

  const allowed = new Set(['title', 'author']);
  const unknown = Object.keys(body).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    errors.push(`Unknown field(s): ${unknown.join(', ')}. Allowed: title, author.`);
  }

  return errors;
}

/** Parse a route param into a positive integer id, or null if invalid. */
function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Shape a book for the API response (drop anything internal). */
function toPublicBook(book) {
  return { id: book.id, title: book.title, author: book.author };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET / — content negotiation: browsers get the HTML playground, curl/Postman
// get a JSON index of the available endpoints.
app.get('/', (req, res) => {
  // Browsers advertise "text/html" in the Accept header; curl and Postman send
  // "*/*" or "application/json". Requiring an explicit "text/html" keeps the
  // API JSON-first, so `curl http://localhost:3000/` still gives you JSON.
  const accept = req.get('accept') || '';
  const wantsHtml = accept.includes('text/html');

  if (wantsHtml) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  res.json({
    name: 'Books API',
    endpoints: {
      'GET /books': 'List all books',
      'GET /books/:id': 'Get a single book',
      'POST /books': 'Create a book  { title, author }',
      'PUT /books/:id': 'Replace a book  { title, author }',
      'PATCH /books/:id': 'Partially update a book  { title? , author? }',
      'DELETE /books/:id': 'Delete a book',
      'GET /health': 'Health check',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), bookCount: books.length });
});

// GET /books — return every book.
// Supports ?author=... and ?title=... filters, plus ?search=... across both.
app.get('/books', (req, res) => {
  const { author, title, search } = req.query;
  let result = books;

  if (author) result = result.filter((b) => b.author.toLowerCase().includes(String(author).toLowerCase()));
  if (title) result = result.filter((b) => b.title.toLowerCase().includes(String(title).toLowerCase()));
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }

  res.status(200).json({ count: result.length, data: result.map(toPublicBook) });
});

// GET /books/:id — return one book, or 404.
app.get('/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id. Expected a positive integer.' });

  const book = books.find((b) => b.id === id);
  if (!book) return res.status(404).json({ error: `Book with id ${id} not found.` });

  res.status(200).json(toPublicBook(book));
});

// POST /books — create a book from the request body.
app.post('/books', (req, res) => {
  const errors = validateBook(req.body);
  if (errors.length > 0) return res.status(400).json({ error: 'Validation failed.', details: errors });

  const newBook = {
    id: nextId++,
    title: req.body.title.trim(),
    author: req.body.author.trim(),
  };

  books.push(newBook);

  // 201 Created + a Location header pointing at the new resource.
  res.status(201).location(`/books/${newBook.id}`).json({ message: 'Book created.', data: newBook });
});

// PUT /books/:id — full update of an existing book.
app.put('/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id. Expected a positive integer.' });

  const index = books.findIndex((b) => b.id === id);
  if (index === -1) return res.status(404).json({ error: `Book with id ${id} not found.` });

  const errors = validateBook(req.body);
  if (errors.length > 0) return res.status(400).json({ error: 'Validation failed.', details: errors });

  books[index] = { id, title: req.body.title.trim(), author: req.body.author.trim() };

  res.status(200).json({ message: 'Book updated.', data: toPublicBook(books[index]) });
});

// PATCH /books/:id — partial update (only the fields you send).
app.patch('/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id. Expected a positive integer.' });

  const book = books.find((b) => b.id === id);
  if (!book) return res.status(404).json({ error: `Book with id ${id} not found.` });

  const errors = validateBook(req.body, true);
  if (errors.length > 0) return res.status(400).json({ error: 'Validation failed.', details: errors });

  if (req.body.title === undefined && req.body.author === undefined) {
    return res.status(400).json({ error: 'Nothing to update. Send "title" and/or "author".' });
  }

  if (typeof req.body.title === 'string') book.title = req.body.title.trim();
  if (typeof req.body.author === 'string') book.author = req.body.author.trim();

  res.status(200).json({ message: 'Book updated.', data: toPublicBook(book) });
});

// DELETE /books/:id — remove a book. 204 No Content on success.
app.delete('/books/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id. Expected a positive integer.' });

  const index = books.findIndex((b) => b.id === id);
  if (index === -1) return res.status(404).json({ error: `Book with id ${id} not found.` });

  const [removed] = books.splice(index, 1);

  res.status(204).send(); // nothing to return; the resource is gone
  console.log(`  -> deleted book ${removed.id} ("${removed.title}")`);
});

// ---------------------------------------------------------------------------
// Static files (the browser playground) — registered AFTER the API routes so
// they can never shadow an endpoint like /books.
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

// 404 for any route that did not match above.
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Central error handler (4 args = Express treats it as error middleware).
app.use((err, req, res, next) => {
  // Malformed JSON body -> express.json() throws an error with status 400.
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  const status = err.status || err.statusCode || 500;
  console.error('Unhandled error:', err.message);
  res.status(status).json({ error: err.message || 'Internal server error.' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n📚 Books API running at http://localhost:${PORT}`);
    console.log(`   Try:  curl http://localhost:${PORT}/books\n`);
  });
}

// Exported so automated tests can start the app on a random port.
module.exports = app;
