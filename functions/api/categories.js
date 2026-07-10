const CATEGORIES = [
  { id: 'current', name: '时事热点', slug: 'current' },
  { id: 'tech', name: '科技财经', slug: 'tech' },
  { id: 'sports', name: '体育娱乐', slug: 'sports' },
  { id: 'custom', name: '自定义', slug: 'custom' },
];

export async function onRequest(context) {
  const { env } = context;

  try {
    const categories = await Promise.all(
      CATEGORIES.map(async (cat) => {
        const ids = await env.NEWS_KV.get(`index:news:${cat.id}`, 'json') || [];
        return { ...cat, count: ids.length };
      })
    );

    return Response.json(categories);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
