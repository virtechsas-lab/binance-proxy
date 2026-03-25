const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BINANCE_FUTURES_BASE = 'https://fapi.binance.com';

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─── Binance proxy ───────────────────────────────────────────────────────────
app.post('/binance', async (req, res) => {
  const { method, path, params = {}, apiKey, apiSecret } = req.body;

  if (!method || !path || !apiKey || !apiSecret) {
    return res.status(400).json({
      error: 'Missing required fields: method, path, apiKey, apiSecret',
    });
  }

  const upperMethod = method.toUpperCase();
  if (!['GET', 'POST', 'DELETE'].includes(upperMethod)) {
    return res.status(400).json({ error: 'method must be GET, POST or DELETE' });
  }

  try {
    // 1. Agregar timestamp obligatorio de Binance
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };

    // 2. Construir el query string para firmar
    const queryString = new URLSearchParams(queryParams).toString();

    // 3. Generar firma HMAC-SHA256
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('hex');

    // 4. Construir URL final
    const url = `${BINANCE_FUTURES_BASE}${path}?${queryString}&signature=${signature}`;

    // 5. Ejecutar la llamada a Binance
    const response = await axios({
      method: upperMethod,
      url,
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json',
      },
      // Para POST/DELETE, Binance Futures acepta params en query string (ya incluidos en la URL)
      timeout: 10000,
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      // Error con respuesta de Binance → lo retransmitimos tal cual
      return res.status(error.response.status).json(error.response.data);
    }
    return res.status(500).json({ error: error.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Binance proxy listening on port ${PORT}`);
});
