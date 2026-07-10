const API = {
  baseUrl: '',

  async getNews(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${this.baseUrl}/api/news?${query}`);
    return res.json();
  },

  async getNewsById(id) {
    const res = await fetch(`${this.baseUrl}/api/news/${id}`);
    return res.json();
  },

  async getCategories() {
    const res = await fetch(`${this.baseUrl}/api/categories`);
    return res.json();
  },

  async chat(messages, options = {}) {
    const res = await fetch(`${this.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, options }),
    });
    return res.body;
  },
};
