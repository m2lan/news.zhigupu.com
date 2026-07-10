export async function onRequestPost(context) {
  const { env, request } = context;

  // 鉴权
  const authHeader = request.headers.get('Authorization');
  const secret = env.UPDATE_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const categories = ['current', 'tech', 'sports', 'custom'];
    const allNews = [];

    // 遍历所有分类，获取所有新闻 ID
    for (const category of categories) {
      const ids = await env.NEWS_KV.get(`index:news:${category}`, 'json') || [];

      for (const id of ids) {
        const news = await env.NEWS_KV.get(`news:${id}`, 'json');
        if (news) {
          allNews.push({
            id: news.id,
            title: news.title,
            summary: news.summary?.slice(0, 150) || '',
            tags: news.tags || [],
            category: news.category,
          });
        }
      }
    }

    // 保存搜索索引
    await env.NEWS_KV.put('index:search', JSON.stringify(allNews));

    return Response.json({
      success: true,
      indexed: allNews.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
