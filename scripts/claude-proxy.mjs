#!/usr/bin/env node
/**
 * Claude CLI Proxy — runs on the HOST (not in Docker)
 * Accepts POST requests with { prompt } and streams back Claude CLI output.
 * The OnlyHulls container calls this instead of spawning claude directly.
 * Bound to 127.0.0.1 only — not exposed externally.
 */
import http from "node:http";
import { spawn } from "node:child_process";

const PORT = 3099;

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/chat") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let prompt;
    try {
      prompt = JSON.parse(body).prompt;
    } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    if (!prompt) {
      res.writeHead(400);
      res.end("Missing prompt");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const proc = spawn("claude", ["-p", "--output-format", "text", prompt], {
      env: { ...process.env, HOME: "/root" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk) => {
      res.write(`data: ${JSON.stringify({ text: chunk.toString() })}\n\n`);
    });

    proc.stderr.on("data", (chunk) => {
      console.error("[claude-proxy] stderr:", chunk.toString().trim());
    });

    proc.on("close", (code) => {
      res.write(`data: ${JSON.stringify({ done: true, code })}\n\n`);
      res.end();
    });

    proc.on("error", (err) => {
      console.error("[claude-proxy] spawn error:", err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[claude-proxy] Listening on 127.0.0.1:${PORT}`);
});
