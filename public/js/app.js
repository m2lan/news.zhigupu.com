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

      nav.innerHTML = `
        <div class="nav-item active" data-category="all">全部</div>
        ${categories.map(cat => `
          <div class="nav-item" data-category="${cat.id}">
            ${Utils.getCategoryName(cat.id)}
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
        搜索 "${Utils.escapeHtml(query)}" · ${total} 条结果
      </div>
      <div class="nav-item" data-category="all" onclick="App.clearSearch()">清除搜索</div>
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
    const heroSection = document.getElementById('heroSection');
    const loadMore = document.getElementById('loadMore');
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput.value.trim();

    if (!append) {
      list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
      heroSection.innerHTML = '';
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
        heroSection.innerHTML = '';
        list.innerHTML = `
          <div class="empty">
            <div class="empty-icon">🔍</div>
            <p>未找到 "${Utils.escapeHtml(searchQuery)}" 相关内容</p>
            <p style="margin-top: 8px;">换个关键词试试</p>
          </div>
        `;
        loadMore.style.display = 'none';
        return;
      }

      if (append) {
        // 追加模式：直接添加卡片
        const html = data.items.map(news => this.renderNewsCard(news)).join('');
        list.insertAdjacentHTML('beforeend', html);
      } else {
        // 首页加载：第一条为 hero，其余为卡片
        if (this.currentPage === 1 && data.items.length > 0) {
          const hero = data.items[0];
          heroSection.innerHTML = this.renderHeroCard(hero);

          const rest = data.items.slice(1);
          list.innerHTML = rest.map(news => this.renderNewsCard(news)).join('');
        } else {
          list.innerHTML = data.items.map(news => this.renderNewsCard(news)).join('');
        }
      }

      loadMore.style.display = this.hasMore ? 'block' : 'none';
    } catch (err) {
      console.error('Load news failed:', err);
      if (!append) {
        heroSection.innerHTML = '';
        list.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><p>加载失败，请稍后重试</p></div>';
      }
    } finally {
      this.loading = false;
    }
  },

  renderHeroCard(news) {
    return `
      <div class="hero" onclick="location.href='/news.html?id=${news.id}'">
        <div class="hero-label">头条</div>
        <h2 class="hero-title">${Utils.escapeHtml(news.title)}</h2>
        <p class="hero-summary">${Utils.escapeHtml(Utils.truncate(Utils.stripHtml(news.summary), 200))}</p>
        <div class="hero-meta">
          <span class="source">${Utils.escapeHtml(news.source)}</span>
          <span>${Utils.formatDate(news.publishedAt)}</span>
        </div>
      </div>
    `;
  },

  renderNewsCard(news) {
    return `
      <article class="news-card" onclick="location.href='/news.html?id=${news.id}'">
        <div class="news-card-header">
          <span class="news-category-tag">${Utils.getCategoryName(news.category)}</span>
          <h3 class="news-card-title">${Utils.escapeHtml(news.title)}</h3>
        </div>
        <p class="news-card-summary">${Utils.escapeHtml(Utils.truncate(Utils.stripHtml(news.summary), 120))}</p>
        <div class="news-card-meta">
          <span class="source">${Utils.escapeHtml(news.source)}</span>
          <span>${Utils.formatDate(news.publishedAt)}</span>
          ${news.tags.length ? `
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
        <span class="source">${Utils.escapeHtml(news.source)}</span>
        <span>${Utils.formatDate(news.publishedAt)}</span>
        <span>${Utils.getCategoryName(news.category)}</span>
      `;
      document.getElementById('detailContent').innerHTML = Utils.markdownToHtml(news.content);
      document.getElementById('detailTags').innerHTML = news.tags.map(
        tag => `<span class="tag">${Utils.escapeHtml(tag)}</span>`
      ).join('');

      document.title = `${news.title} - EverRead`;
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
