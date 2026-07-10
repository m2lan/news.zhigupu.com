const CATEGORIES = {
  current: '时事热点',
  tech: '科技财经',
  sports: '体育娱乐',
  custom: '自定义标签',
};

// 新闻源配置（RSS/JSON API）
const NEWS_SOURCES = {
  current: [
    { url: 'https://36kr.com/feed', name: '36氪' },
    { url: 'https://www.zhihu.com/rss', name: '知乎热榜' },
    { url: 'https://www.chinanews.com.cn/rss/scroll-news.xml', name: '中新网' },
  ],
  tech: [
    { url: 'https://36kr.com/feed', name: '36氪' },
    { url: 'https://sspai.com/feed', name: '少数派' },
    { url: 'https://www.ruanyifeng.com/blog/atom.xml', name: '阮一峰' },
  ],
  sports: [
    { url: 'https://36kr.com/feed', name: '36氪' },  // 36kr 也有体育娱乐内容
    { url: 'https://www.dongqiudi.com/rss', name: '懂球帝' },
  ],
  custom: [
    { url: 'https://36kr.com/feed', name: '36氪' },
  ],
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 解析 RSS XML
function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title) {
      items.push({
        title: cleanCDATA(title),
        link: cleanCDATA(link),
        description: cleanCDATA(description),
        pubDate,
      });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function cleanCDATA(str) {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

// 抓取 RSS 源
async function fetchRSS(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EverRead/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return parseRSS(text);
  } catch (err) {
    console.error(`Fetch RSS failed: ${url}`, err.message);
    return [];
  }
}

// 获取指定分类的新闻源数据
async function fetchCategoryNews(category) {
  const sources = NEWS_SOURCES[category] || [];
  const allItems = [];

  for (const source of sources) {
    const items = await fetchRSS(source.url);
    for (const item of items.slice(0, 10)) {
      allItems.push({
        ...item,
        sourceName: source.name,
      });
    }
  }

  return allItems;
}

// 用 AI 整理新闻
async function formatWithAI(env, category, rawNews) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const newsContext = rawNews.map((item, i) =>
    `${i + 1}. 标题: ${item.title}\n   来源: ${item.sourceName}\n   链接: ${item.link}\n   摘要: ${item.description?.slice(0, 200) || '无'}`
  ).join('\n\n');

  const prompt = `你是新闻编辑，请根据以下新闻素材整理出高质量的${CATEGORIES[category]}新闻。

当前日期：${dateStr}

新闻素材：
${newsContext}

要求：
1. 从素材中挑选 5-10 条最新、最有价值的新闻
2. 为每条新闻撰写详细内容（300-500字，markdown格式）
3. 添加合适的标签
4. 返回严格JSON格式

返回格式（JSON数组）：
[{
  "title": "新闻标题",
  "summary": "100字以内的摘要",
  "content": "详细内容（markdown格式）",
  "tags": ["标签1", "标签2"],
  "source": "来源名称"
}]

请直接返回JSON数组，不要包含其他文字。`;

  const response = await fetch(env.AI_BASE_URI + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        { role: 'system', content: '你是专业的新闻编辑，擅长整理和撰写新闻。请直接返回JSON数组。' },
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
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI returned empty content');
  }

  // 解析 JSON
  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Cannot parse AI response');
  }
}

// 无 AI 模式：直接使用 RSS 数据
function formatWithoutAI(rawNews) {
  return rawNews.map(item => ({
    title: item.title,
    summary: item.description?.slice(0, 100) || '',
    content: item.description || item.title,
    tags: [],
    source: item.sourceName,
  }));
}

async function saveNews(env, category, newsList) {
  const now = new Date().toISOString();
  const existingIds = await env.NEWS_KV.get(`index:news:${category}`, 'json') || [];
  const existingTitles = new Set();

  for (const id of existingIds.slice(0, 100)) {
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
      source: item.source || '未知',
      publishedAt: now,
      createdAt: now,
    };

    await env.NEWS_KV.put(`news:${id}`, JSON.stringify(news));
    newIds.push({ id, publishedAt: now });
    added++;
  }

  const allIds = [...newIds, ...existingIds.map(id => ({ id, publishedAt: '' }))];
  const sortedIds = allIds.slice(0, 500).map(item => item.id || item);
  await env.NEWS_KV.put(`index:news:${category}`, JSON.stringify(sortedIds));

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

  const authHeader = request.headers.get('Authorization');
  const secret = env.UPDATE_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const categories = body.category ? [body.category] : Object.keys(CATEGORIES);
    const useAI = body.useAI !== false; // 默认使用 AI

    let totalAdded = 0;
    const results = [];

    for (const category of categories) {
      try {
        // 1. 从 RSS 源获取真实新闻
        const rawNews = await fetchCategoryNews(category);

        if (rawNews.length === 0) {
          results.push({ category, added: 0, message: 'No news from RSS sources' });
          continue;
        }

        // 2. 用 AI 整理或直接使用
        let newsList;
        if (useAI && env.AI_API_KEY) {
          newsList = await formatWithAI(env, category, rawNews);
        } else {
          newsList = formatWithoutAI(rawNews);
        }

        // 3. 保存到 KV
        const added = await saveNews(env, category, Array.isArray(newsList) ? newsList : []);
        totalAdded += added;
        results.push({ category, added, fetched: rawNews.length });
      } catch (err) {
        results.push({ category, error: err.message });
      }
    }

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
