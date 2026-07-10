const App = {
  currentCategory: 'all',
  currentPage: 1,
  loading: false,
  hasMore: true,

  init() {
    this.bindEvents();
    this.loadCategories();
    this.loadNews();
  },

  bindEvents() {
    // 分类导航点击
    document.getElementById('navCategories').addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (!item) return;

      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      this.currentCategory = item.dataset.category;
      this.currentPage = 1;
      this.hasMore = true;
      this.loadNews();
    });

    // 搜索
    const searchInput = document.getElementById('searchInput');
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.currentPage = 1;
        this.hasMore = true;
        this.loadNews();
      }, 300);
    });

    // 加载更多
    document.getElementById('loadMore').addEventListener('click', () => {
      if (!this.loading && this.hasMore) {
        this.currentPage++;
        this.loadNews(true);
      }
    });
  },

  async loadCategories() {
    try {
      const categories = await API.getCategories();
      const nav = document.getElementById('navCategories');
      const allCount = categories.reduce((sum, cat) => sum + cat.count, 0);

      nav.innerHTML = `
        <div class="nav-item active" data-category="all">全部 (${allCount})</div>
        ${categories.map(cat => `
          <div class="nav-item" data-category="${cat.id}">
            ${Utils.getCategoryIcon(cat.id)} ${cat.name} (${cat.count})
          </div>
        `).join('')}
      `;
    } catch (err) {
      console.error('Load categories failed:', err);
    }
  },

  updateNavSearchResult(total, query) {
    const nav = document.getElementById('navCategories');
    nav.innerHTML = `
      <div class="nav-item active" data-category="all">
        🔍 搜索 "${Utils.escapeHtml(query)}" - 找到 ${total} 条
      </div>
      <div class="nav-item" data-category="all" onclick="App.clearSearch()">✕ 清除搜索</div>
    `;
  },

  clearSearch() {
    document.getElementById('searchInput').value = '';
    this.currentPage = 1;
    this.hasMore = true;
    this.loadCategories().then(() => this.loadNews());
  },

  async loadNews(append = false) {
    if (this.loading) return;
    this.loading = true;

    const list = document.getElementById('newsList');
    const loadMore = document.getElementById('loadMore');
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput.value.trim();

    if (!append) {
      list.innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>';
    }

    try {
      const params = {
        page: this.currentPage,
        limit: 20,
      };

      if (this.currentCategory !== 'all') {
        params.category = this.currentCategory;
      }

      if (searchQuery) {
        params.q = searchQuery;
      }

      const data = await API.getNews(params);
      this.hasMore = data.hasMore;

      // 搜索时更新导航显示
      if (searchQuery) {
        this.updateNavSearchResult(data.total, searchQuery);
      }

      if (data.items.length === 0 && !append) {
        list.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🔍</div>
            <p>未找到 "${Utils.escapeHtml(searchQuery)}" 相关新闻</p>
            <p style="font-size: 14px; margin-top: 8px;">换个关键词试试</p>
          </div>
        `;
        loadMore.style.display = 'none';
        return;
      }

      const html = data.items.map(news => this.renderNewsCard(news)).join('');

      if (append) {
        list.insertAdjacentHTML('beforeend', html);
      } else {
        list.innerHTML = html;
      }

      loadMore.style.display = this.hasMore ? 'block' : 'none';
    } catch (err) {
      console.error('Load news failed:', err);
      if (!append) {
        list.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>加载失败，请稍后重试</p></div>';
      }
    } finally {
      this.loading = false;
    }
  },

  renderNewsCard(news) {
    return `
      <article class="news-card" onclick="location.href='/news.html?id=${news.id}'">
        <div class="news-card-header">
          <span class="news-category">${Utils.getCategoryIcon(news.category)}</span>
          <h3 class="news-card-title">${Utils.escapeHtml(news.title)}</h3>
        </div>
        <p class="news-card-summary">${Utils.escapeHtml(Utils.truncate(news.summary, 120))}</p>
        <div class="news-card-meta">
          <span>${Utils.formatDate(news.publishedAt)}</span>
          <span>·</span>
          <span>${Utils.escapeHtml(news.source)}</span>
          ${news.tags.length ? `
            <span>·</span>
            <div class="news-tags">
              ${news.tags.slice(0, 3).map(tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  },
};

// 详情页逻辑
const Detail = {
  async init() {
    const urlParams = new URLSearchParams(location.search);
    const id = urlParams.get('id');

    if (!id) {
      location.href = '/';
      return;
    }

    try {
      const news = await API.getNewsById(id);

      if (news.error) {
        throw new Error(news.error);
      }

      document.getElementById('detailTitle').textContent = news.title;
      document.getElementById('detailMeta').innerHTML = `
        <span>${Utils.getCategoryIcon(news.category)} ${Utils.getCategoryName(news.category)}</span>
        <span>·</span>
        <span>${Utils.formatDate(news.publishedAt)}</span>
        <span>·</span>
        <span>${Utils.escapeHtml(news.source)}</span>
      `;
      document.getElementById('detailContent').innerHTML = Utils.markdownToHtml(news.content);
      document.getElementById('detailTags').innerHTML = news.tags.map(
        tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`
      ).join('');

      document.title = `${news.title} - 常青藤快讯`;
    } catch (err) {
      console.error('Load detail failed:', err);
      document.getElementById('detailContent').innerHTML = `
        <div class="empty">
          <div class="empty-icon">⚠️</div>
          <p>加载失败</p>
          <a href="/">返回首页</a>
        </div>
      `;
    }
  },
};
