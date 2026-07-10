export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'all';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const tag = url.searchParams.get('tag');

  try {
    let newsIds = [];

    if (tag) {
      // 按标签筛选
      const tagIndex = await env.NEWS_KV.get('index:tags', 'json') || {};
      const tagEntry = Object.entries(tagIndex).find(([t]) => t.toLowerCase() === tag.toLowerCase());
      newsIds = tagEntry ? tagEntry[1].ids || [] : [];
    } else if (category === 'all') {
      // 获取所有分类的新闻
      const categories = ['current', 'tech', 'sports', 'custom'];
      const allIds = await Promise.all(
        categories.map(cat => env.NEWS_KV.get(`index:news:${cat}`, 'json'))
      );
      newsIds = allIds
        .filter(Boolean)
        .flat()
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } else {
      newsIds = await env.NEWS_KV.get(`index:news:${category}`, 'json') || [];
    }

    // 分页
    const total = newsIds.length;
    const start = (page - 1) * limit;
    const pageIds = newsIds.slice(start, start + limit);
    const hasMore = start + limit < total;

    // 获取新闻详情
    const items = await Promise.all(
      pageIds.map(async (id) => {
        const news = await env.NEWS_KV.get(`news:${id}`, 'json');
        return news;
      })
    );

    return Response.json({
      items: items.filter(Boolean),
      total,
      page,
      hasMore,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
