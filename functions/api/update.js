const CATEGORIES = {
  current: '时事热点',
  tech: '科技财经',
  sports: '体育娱乐',
  custom: '自定义标签',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function buildPrompt(category) {
  return `你是新闻编辑，请搜索并整理最新的${CATEGORIES[category] || category}领域新闻。

要求：
1. 真实、客观、最近24小时内的新闻
2. 返回 5-10 条新闻
3. 每条新闻包含以下字段（严格JSON格式）：

{
  "title": "新闻标题",
  "summary": "100字以内的摘要",
  "content": "详细内容，markdown格式，300-500字",
  "tags": ["标签1", "标签2"],
  "source": "来源说明"
}

请直接返回JSON数组，不要包含其他文字。`;
}

async function callAI(env, prompt) {
  const response = await fetch(env.AI_BASE_URI + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        { role: 'system', content: '你是一个专业的新闻编辑助手，负责搜索和整理最新新闻。请直接返回JSON数组格式的新闻数据。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  console.log('AI response:', JSON.stringify(data).slice(0, 500));

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned empty content');
  }

  // 尝试解析 JSON，处理可能的 markdown 代码块包裹
  try {
    // 先尝试直接解析
    return JSON.parse(content);
  } catch {
    // 尝试提取 JSON 数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // 尝试提取 JSON 对象（可能包装在 {news: [...]} 中）
    const objMatch = content.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const parsed = JSON.parse(objMatch[0]);
      // 如果是对象，尝试找到数组字段
      if (Array.isArray(parsed)) return parsed;
      const arrField = Object.values(parsed).find(v => Array.isArray(v));
      if (arrField) return arrField;
    }
    throw new Error('Cannot parse AI response as JSON');
  }
}

async function saveNews(env, category, newsList) {
  const now = new Date().toISOString();
  const existingIds = await env.NEWS_KV.get(`index:news:${category}`, 'json') || [];
  const existingTitles = new Set();

  // 获取已有标题用于去重
  for (const id of existingIds.slice(0, 50)) {
    const news = await env.NEWS_KV.get(`news:${id}`, 'json');
    if (news) existingTitles.add(news.title);
  }

  let added = 0;
  const newIds = [];

  for (const item of newsList) {
    if (existingTitles.has(item.title)) continue;

    const id = generateId();
    const news = {
      id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      category,
      tags: item.tags || [],
      source: item.source || 'AI 整理',
      publishedAt: now,
      createdAt: now,
    };

    await env.NEWS_KV.put(`news:${id}`, JSON.stringify(news));
    newIds.push({ id, publishedAt: now });
    added++;
  }

  // 更新索引（新新闻在前）
  const allIds = [...newIds, ...existingIds.map(id => ({ id, publishedAt: '' }))];
  const sortedIds = allIds.slice(0, 500).map(item => item.id || item);
  await env.NEWS_KV.put(`index:news:${category}`, JSON.stringify(sortedIds));

  // 更新标签索引
  const tagIndex = await env.NEWS_KV.get('index:tags', 'json') || {};
  for (const item of newsList) {
    for (const tag of (item.tags || [])) {
      if (!tagIndex[tag]) tagIndex[tag] = { ids: [], count: 0 };
      const newsId = newIds.find(n => n.title === item.title)?.id;
      if (newsId && !tagIndex[tag].ids.includes(newsId)) {
        tagIndex[tag].ids.unshift(newsId);
        tagIndex[tag].count++;
      }
    }
  }
  await env.NEWS_KV.put('index:tags', JSON.stringify(tagIndex));

  return added;
}

export async function onRequestPost(context) {
  const { env, request } = context;

  // 鉴权
  const authHeader = request.headers.get('Authorization');
  const secret = env.UPDATE_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const categories = body.category ? [body.category] : Object.keys(CATEGORIES);

    let totalAdded = 0;
    const results = [];

    for (const category of categories) {
      try {
        const prompt = buildPrompt(category);
        const newsList = await callAI(env, prompt);
        const added = await saveNews(env, category, Array.isArray(newsList) ? newsList : []);
        totalAdded += added;
        results.push({ category, added });
      } catch (err) {
        results.push({ category, error: err.message });
      }
    }

    // 更新最后更新时间
    await env.NEWS_KV.put('meta:last_update', new Date().toISOString());

    return Response.json({
      success: true,
      added: totalAdded,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
