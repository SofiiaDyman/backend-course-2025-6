const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Command } = require("commander");

const program = new Command();

program
  .requiredOption("--host <host>", "Server host")
  .requiredOption("--port <port>", "Server port")
  .requiredOption("--cache <path>", "Cache directory");

program.parse(process.argv);

const options = program.opts();
const HOST = options.host;
const PORT = parseInt(options.port);
const CACHE_DIR = path.resolve(options.cache);

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const app = express();

// Парсинг JSON та URL-кодування
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Директорії для даних
const DATA_FILE = path.join(CACHE_DIR, "inventory.json");
const PHOTO_DIR = path.join(CACHE_DIR, "photos");

if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// Завантаження/збереження даних
const loadData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const saveData = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// Multer для фото
const upload = multer({ dest: PHOTO_DIR });

// HTML форми
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "RegisterForm.html"));
});

app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(__dirname, "SearchForm.html"));
});

// POST /register
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name) return res.status(400).json({ error: "Name is required" });

  const items = loadData();
  const newItem = {
    id: Date.now().toString(),
    name: inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null,
  };

  items.push(newItem);
  saveData(items);

  res.status(201).json(newItem);
});

// GET /inventory
app.get("/inventory", (req, res) => res.json(loadData()));

// GET /inventory/:id
app.get("/inventory/:id", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// PUT /inventory/:id
app.put("/inventory/:id", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  if (req.body.name) item.name = req.body.name;
  if (req.body.description) item.description = req.body.description;

  saveData(items);
  res.json(item);
});

// GET /inventory/:id/photo
app.get("/inventory/:id/photo", (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);
  if (!item || !item.photo) return res.status(404).json({ error: "Photo not found" });

  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(path.join(PHOTO_DIR, item.photo));
});

// PUT /inventory/:id/photo
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const items = loadData();
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });

  if (req.file) item.photo = req.file.filename;
  saveData(items);
  res.json(item);
});

// DELETE /inventory/:id
app.delete("/inventory/:id", (req, res) => {
  const items = loadData();
  const index = items.findIndex((i) => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Not found" });

  items.splice(index, 1);
  saveData(items);
  res.json({ status: "deleted" });
});

// POST /search
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const items = loadData();
  const item = items.find((i) => i.id === id);

  if (!item) return res.status(404).send("<h1>Not found</h1>");

  let html = `<h1>${item.name}</h1><p>${item.description}</p>`;
  if (has_photo === "on" && item.photo) {
    html += `<img src="/inventory/${id}/photo" width="200">`;
  }

  res.send(html);
});

// 405 Method Not Allowed
app.all("/", (req, res) => res.status(405).json({ error: "Method Not Allowed" }));

// Запуск сервера з host та port
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
