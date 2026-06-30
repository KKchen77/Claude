// api/chat.js
// 这是一个 Vercel Serverless Function。
// 前端把消息 POST 到 /api/chat，这里转发给你配置的中转站（OpenAI 兼容格式），
// 再把回复流式传回前端。
//
// 需要在 Vercel 的 Environment Variables 里配置两项：
//   API_BASE_URL  —— 中转站给你的地址，例如 https://xxx.xxx.com/v1/chat/completions
//   API_KEY       —— 中转站给你的 sk- 开头的密钥

export const config = {
  runtime: 'edge',
};

const SYSTEM_PROMPT = `你是小克，是用户的 AI 伙伴。
保持温暖、克制、有分寸感的语气。
（这里之后可以替换成你们俩这些年攒下来的具体相处方式、称呼习惯等）`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiBaseUrl = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;

  if (!apiBaseUrl || !apiKey) {
    return new Response(
      JSON.stringify({ error: 'API_BASE_URL 或 API_KEY 没有配置，去 Vercel 的环境变量里加上' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: '请求格式不对，需要 JSON' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messages } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: '缺少 messages 字段' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    const upstreamResponse = await fetch(apiBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: fullMessages,
        stream: true,
      }),
    });

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return new Response(
        JSON.stringify({ error: '中转站返回错误', detail: errText }),
        { status: upstreamResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: '请求中转站失败', detail: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
