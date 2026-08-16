// server.js — Containment Breach V2 Token Server
//
// Exchanges your Reactor API key for a short-lived session JWT.
// The browser never sees the raw key.
// Docs: https://docs.reactor.inc/authentication

import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/health", (_req, res) => res.json({ ok: true, model: "lingbot-world-2" }));

app.post("/api/token", async (_req, res) => {
  if (!process.env.REACTOR_API_KEY) {
    return res.status(500).json({
      error: "missing_api_key",
      message: "Set REACTOR_API_KEY in your .env file (copy .env.example).",
    });
  }

  try {
    const upstream = await fetch("https://api.reactor.inc/tokens", {
      method: "POST",
      headers: {
        "Reactor-API-Key": process.env.REACTOR_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authorization_details: [
          {
            type: "session",
            resources: {
              models: { match: ["reactor/lingbot-world-2"] },
            },
          },
        ],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("Reactor token exchange failed:", upstream.status, detail);
      return res.status(upstream.status).json({ error: "token_mint_failed", detail });
    }

    const data = await upstream.json();
    res.json(data); // { jwt: "..." }
  } catch (err) {
    console.error("Token server error:", err);
    res.status(500).json({ error: "token_mint_failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Token server ready → http://localhost:${PORT}`);
  if (!process.env.REACTOR_API_KEY) {
    console.warn("⚠ REACTOR_API_KEY is not set — copy .env.example to .env and fill it in.");
  }
});
