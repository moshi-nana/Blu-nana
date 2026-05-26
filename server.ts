import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Gemini
  app.post("/api/gemini", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(401).json({ error: "API Key is missing. Silakan tambahkan GEMINI_API_KEY via Settings > Secrets di AI Studio." });
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const { model, contents, config } = req.body;
      
      const response = await ai.models.generateContent({
        model: model || "gemini-3.5-flash",
        contents,
        config
      });

      res.json({ text: response.text });
    } catch (error: any) {
      let msg = error.message || "Failed to generate content.";
      if (typeof msg === 'string' && (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid'))) {
        msg = "API Key not valid. Please check your Gemini API Key.";
      }
      console.error("Gemini API Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support history api fallback
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
