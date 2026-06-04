const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const Anichin = require('./anichin');

const app = express();
const ani = new Anichin();

app.use(cors());
app.use(morgan('dev'));
app.set('json spaces', 2);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  const base = req.protocol + '://' + req.get('host');
  res.render('index', { base });
});

app.get('/slide', async (req, res) => {
  try {
    const data = await ani.SwipperSlide();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/popular', async (req, res) => {
  try {
    const data = await ani.popular();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});


app.get('/genres', async (req, res) => {
  try {
    const data = await ani.genres();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/genres/:genre', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.genre(req.params.genre, page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/latest', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.latest(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/detail/:slug', async (req, res) => {
  try {
    const data = await ani.detail(req.params.slug);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/episode/:slug', async (req, res) => {
  try {
    const data = await ani.episode(req.params.slug);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    const page = parseInt(req.query.page || '1');
    if (!q) return res.json({ status: false, message: 'Missing query ?q=' });
    const data = await ani.search(q, page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/ongoing', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.ongoing(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/completed', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const data = await ani.completed(page);
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

app.get('/schedule', async (req, res) => {
  try {
    const data = await ani.schedule();
    res.json({ status: true, data });
  } catch (e) {
    res.status(500).json({ status: false, message: e.message });
  }
});

const PORT = process.env.PORT || 2504;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
