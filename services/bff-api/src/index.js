import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: [/^https:\/\/(.*\.)?github\.io$/, /localhost:\\d+$/] }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/echo', (req, res) => res.json({ query: req.query }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`bff-api listening on :${port}`));
