export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'all';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const tag = url.searchParams.get('tag');
  const query = url.searchParams.get('q')?.trim();

  try {
    let newsIds = [];

    if (query) {
      // 全文搜索：从搜索索引中匹配标题和摘要
      const searchIndex = await env.NEWS_KV.get('index:search', 'json') || [];
      const lowerQuery = query.toLowerCase();

      const matched = searchIndex.filter(item =>
        item.title?.toLowerCase().includes(lowerQuery) ||
        item.summary?.toLowerCase().includes(lowerQuery) ||
        item.tags?.some(t => t.toLowerCase().includes(lowerQuery))
      );

      // 如果同时指定了分类，再过滤
      const filtered = category !== 'all'
        ? matched.filter(item => item.category === category)
        : matched;

      newsIds = filtered.map(item => item.id);
    } else if (tag) {
      const tagIndex = await env.NEWS_KV.get('index:tags', 'json') || {};
      const tagEntry = Object.entries(tagIndex).find(([t]) => t.toLowerCase() === tag.toLowerCase());
      newsIds = tagEntry ? tagEntry[1].ids || [] : [];
    } else if (category === 'all') {
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
