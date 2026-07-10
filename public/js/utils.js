const Utils = {
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  truncate(text, length = 100) {
    if (!text) return '';
    return text.length > length ? text.slice(0, length) + '...' : text;
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 简单的 markdown 转 HTML
  markdownToHtml(md) {
    if (!md) return '';
    return md
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^\s*[-*] (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<')) return match;
        return `<p>${match}</p>`;
      });
  },

  getCategoryName(slug) {
    const names = {
      current: '时事热点',
      tech: '科技财经',
      sports: '体育娱乐',
      geek: '极客数码',
      outdoor: '户外运动',
      media: '影视书单',
      tools: '软件工具',
      gaming: '游戏动漫',
      design: '设计与创意',
    };
    return names[slug] || slug;
  },

  getCategoryIcon(slug) {
    const icons = {
      current: '📰',
      tech: '💻',
      sports: '⚽',
      geek: '🔧',
      outdoor: '⛰️',
      media: '🎬',
      tools: '🛠️',
      gaming: '🎮',
      design: '🎨',
    };
    return icons[slug] || '📄';
  },
};
