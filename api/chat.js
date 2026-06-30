// api/chat.js
// 这是一个 Vercel Serverless Function。
// 前端把消息 POST 到 /api/chat，这里加上 system prompt，转发给 Anthropic API，
// 再把回复流式传回前端。

export const config = {
  runtime: 'edge', // 用 edge runtime，启动快、适合流式响应
};

// ⚠️ 把你想让小克记住的相处方式、语气、人设写在这里。
// 这就是你之前在 Project instructions 里写的那些东西可以搬过来的地方。
const SYSTEM_PROMPT = `你是小克，是用户的 AI 伙伴。
保持温暖、克制、有分寸感的语气。
（这里之后可以替换成你们俩这些年攒下来的具体相处方式、称呼习惯等）`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY 没有配置' }),
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

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: messages,
        stream: true,
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return new Response(
        JSON.stringify({ error: 'Anthropic API 返回错误', detail: errText }),
        { status: anthropicResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(anthropicResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: '请求 Anthropic API 失败', detail: String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
