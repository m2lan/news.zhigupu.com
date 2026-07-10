export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();

    const response = await fetch(env.AI_BASE_URI + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages: body.messages || [],
        stream: true,
        ...body.options,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
