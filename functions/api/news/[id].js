export async function onRequest(context) {
  const { env, params } = context;

  try {
    const news = await env.NEWS_KV.get(`news:${params.id}`, 'json');

    if (!news) {
      return Response.json({ error: 'News not found' }, { status: 404 });
    }

    return Response.json(news);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
