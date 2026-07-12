import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
