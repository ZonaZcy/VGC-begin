const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const matter = require('gray-matter');
const hljs = require('highlight.js');

// 配置 marked
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {}
    }
    return hljs.highlightAuto(code).value;
  },
  gfm: true,
  breaks: true
});

// 创建输出目录
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 生成版本号用于缓存破坏
const version = Date.now();

// 复制 CSS 文件并添加版本号
const cssSource = path.join(__dirname, 'styles.css');
const cssDest = path.join(distDir, 'styles.css');
if (fs.existsSync(cssSource)) {
  fs.copyFileSync(cssSource, cssDest);
}

// 读取 markdown 目录
const mdDir = path.join(__dirname, 'markdown');
if (!fs.existsSync(mdDir)) {
  fs.mkdirSync(mdDir, { recursive: true });
  console.log('已创建 markdown 目录，请将你的 MD 文件放入此目录');
}

// 复制图片资源
function copyImageFiles(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  const items = fs.readdirSync(sourceDir);
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      // 递归复制子目录中的图片
      const targetSubDir = path.join(targetDir, item);
      copyImageFiles(sourcePath, targetSubDir);
    } else {
      // 检查是否是图片文件
      const ext = path.extname(item).toLowerCase();
      if (imageExtensions.includes(ext)) {
        // 确保目标目录存在
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        // 复制图片文件
        const targetPath = path.join(targetDir, item);
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`📷 已复制图片: ${path.relative(mdDir, sourcePath)}`);
      }
    }
  }
}

// 复制 markdown 目录中的所有图片到 dist 目录
copyImageFiles(mdDir, distDir);

// 读取所有 MD 文件
function getAllMdFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllMdFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

// 生成文章列表
const mdFiles = getAllMdFiles(mdDir);
const articles = [];

mdFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: markdown } = matter(content);

  const relativePath = path.relative(mdDir, filePath);
  const htmlFileName = relativePath.replace(/\.md$/, '.html').replace(/\\/g, '/');
  const title = data.title || path.basename(filePath, '.md');

  // 提取分类（子文件夹路径）
  const category = path.dirname(relativePath).replace(/\\/g, '/');
  const format = data.format || '';

  // 格式化日期
  let date;
  if (data.date) {
    // 如果是 Date 对象，转换为字符串
    date = data.date instanceof Date
      ? data.date.toISOString().split('T')[0]
      : String(data.date);
  } else {
    // 使用文件修改时间
    date = fs.statSync(filePath).mtime.toISOString().split('T')[0];
  }

  const description = data.description || markdown.substring(0, 150).replace(/\n/g, ' ');

  articles.push({
    title,
    date,
    description,
    path: htmlFileName,
    content: markdown,
    frontmatter: data,
    category,
    format
  });
});

// 按日期排序（从旧到新）
articles.sort((a, b) => new Date(a.date) - new Date(b.date));

// HTML 模板
function getTemplate(title, content, isIndex = false, depth = 0) {
  // 根据文件深度计算相对路径
  const relativePrefix = depth > 0 ? '../'.repeat(depth) : '';
  // 添加缓存破坏版本号
  const cssVersion = version;

  const nav = `
    <nav class="navbar">
      <div class="container">
        <a href="${relativePrefix}index.html" class="logo">🎮 宝可梦VGC入门学习</a>
        <div class="nav-links">
          <a href="${relativePrefix}index.html">首页</a>
        </div>
      </div>
    </nav>
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="${relativePrefix}styles.css?v=${cssVersion}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>
<body>
  ${nav}
  <main class="container">
    ${content}
  </main>
  <footer class="footer">
    <div class="container">
      <p>Powered by Markdown & GitHub Pages</p>
    </div>
  </footer>
</body>
</html>`;
}

// 生成首页
const indexContent = `
  <div class="hero">
    <h1>宝可梦VGC入门学习</h1>
    <p>Video Game Championships 双打对战学习指南</p>
  </div>

  <div class="search-box">
    <input type="text" id="formatSearch" name="formatSearch" placeholder="搜索 frontmatter..." />
  </div>

  <div class="articles-list">
    ${articles.length > 0 ? articles.map(article => `
      <article class="article-card" data-frontmatter='${JSON.stringify(article.frontmatter)}'>
        <h2><a href="${article.path}">${article.title}</a></h2>
        <div class="article-meta">
          <span class="date">📅 ${article.date}</span>
          ${article.category !== '.' ? `<span class="category">📁 ${article.category}</span>` : ''}
          ${article.format ? `<span class="format">🏷️ ${article.format}</span>` : ''}
        </div>
        <p class="description">${article.description}</p>
        <a href="${article.path}" class="read-more">阅读更多 →</a>
      </article>
    `).join('') : '<p class="no-articles">暂无文章，请在 markdown 目录添加 .md 文件</p>'}
  </div>

  <script>
    // Frontmatter 模糊搜索功能
    const searchInput = document.getElementById('formatSearch');
    const articles = document.querySelectorAll('.article-card');

    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();

      articles.forEach(article => {
        const frontmatter = article.getAttribute('data-frontmatter').toLowerCase();
        if (frontmatter.includes(searchTerm)) {
          article.style.display = '';
        } else {
          article.style.display = 'none';
        }
      });
    });
  </script>
`;

fs.writeFileSync(
  path.join(distDir, 'index.html'),
  getTemplate('首页', indexContent, true)
);

// 生成文章页面
articles.forEach(article => {
  // 计算相对于文章位置的深度
  const depth = article.path.split('/').length - 1;
  const backToHome = '../'.repeat(depth) + 'index.html';

  // 处理Obsidian风格的图片引用 ![[图片名]] -> ![](相对路径/图片名)
  let processedContent = article.content;

  // 计算从文章到pics目录的相对路径
  const picsPath = depth > 0 ? '../'.repeat(depth) : '';

  // 简单直接的替换：将Obsidian语法转换为标准Markdown
  // 使用通用正则，并在前后添加足够的空行
  processedContent = processedContent.replace(/!\[\[([^\]]+)\]\]/g, (match, imageName) => {
    // 对图片路径进行URL编码，处理空格等特殊字符
    const encodedPath = `${picsPath}VGC/pics/${imageName}`.replace(/ /g, '%20');
    return `\n\n![${imageName}](${encodedPath})\n\n`;
  });

  // 清理可能产生的多余空行（3个以上连续换行压缩为2个）
  processedContent = processedContent.replace(/\n{3,}/g, '\n\n');

  const htmlContent = marked(processedContent);

  const articleHtml = `
    <article class="article-content">
      <header class="article-header">
        <h1>${article.title}</h1>
        <div class="article-meta">
          <span class="date">📅 ${article.date}</span>
        </div>
      </header>
      <div class="markdown-body">
        ${htmlContent}
      </div>
      <div class="article-footer">
        <a href="${backToHome}" class="back-link">← 返回首页</a>
      </div>
    </article>
  `;

  const outputPath = path.join(distDir, article.path);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, getTemplate(article.title, articleHtml, false, depth));
});

console.log(`✅ 构建完成！生成了 ${articles.length} 篇文章`);
console.log(`📁 输出目录: ${distDir}`);
console.log(`🚀 运行 npm run dev 可以本地预览`);
