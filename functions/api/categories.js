const CATEGORIES = [
  { id: 'current', name: '时事热点', slug: 'current' },
  { id: 'tech', name: '科技财经', slug: 'tech' },
  { id: 'sports', name: '体育娱乐', slug: 'sports' },
  { id: 'geek', name: '极客数码', slug: 'geek' },
  { id: 'outdoor', name: '户外运动', slug: 'outdoor' },
  { id: 'media', name: '影视书单', slug: 'media' },
  { id: 'tools', name: '软件工具', slug: 'tools' },
  { id: 'gaming', name: '游戏动漫', slug: 'gaming' },
  { id: 'design', name: '设计与创意', slug: 'design' },
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
