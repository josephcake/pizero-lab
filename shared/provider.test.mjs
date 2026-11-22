import test from "node:test";
import assert from "node:assert/strict";
import { askProvider } from "./provider.mjs";

function mockFetch(capture) {
  return async (url, options) => {
    capture.url = url;
    capture.headers = options.headers;
    capture.body = JSON.parse(options.body);
    assert.equal(String(url).includes("127.0.0.1"), false);
    if (String(url).includes("anthropic")) {
      return {
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "unverified outside the context" }] }),
      };
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "GPIO high is 3.3 V. source gpio-docs." } }] }),
    };
  };
}

test("OpenAI browser call shape does not touch the lab server", async () => {
  const capture = {};
  const text = await askProvider({
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "test-key-not-real",
    context: { route: "/lessons/ohms-led" },
    question: "What is a GPIO high?",
    fetchImpl: mockFetch(capture),
  });
  assert.match(text, /3\.3/);
  assert.equal(capture.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(capture.headers.Authorization, "Bearer test-key-not-real");
  assert.equal(capture.body.messages[0].role, "system");
  assert.match(capture.body.messages[0].content, /unverified/);
});

test("Anthropic browser call sends the direct-browser header", async () => {
  const capture = {};
  const text = await askProvider({
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    apiKey: "test-key-not-real",
    context: { route: "/" },
    question: "Bluetooth version?",
    fetchImpl: mockFetch(capture),
  });
  assert.match(text, /unverified/);
  assert.equal(capture.url, "https://api.anthropic.com/v1/messages");
  assert.equal(capture.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(capture.headers["x-api-key"], "test-key-not-real");
  assert.equal(capture.body.system.includes("unverified"), true);
});
