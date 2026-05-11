const mysql = require('mysql2/promise');
const fs = require('fs');

const CONCURRENCY = Number(process.env.URL_VERIFY_CONCURRENCY || 20);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        let value = line.slice(index + 1).trim();
        if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
          value = value.slice(1, -1);
        }
        return [line.slice(0, index).trim(), value];
      }),
  );
}

function dbConfigFromEnv() {
  const env = { ...readEnv('.env.example'), ...readEnv('.env.local'), ...process.env };
  const jdbc = env.SPRING_DATASOURCE_URL || 'jdbc:mysql://localhost:3306/gx_geo_news';
  const matched = jdbc.match(/jdbc:mysql:\/\/([^:/?]+)(?::(\d+))?\/([^?]+)/);
  if (!matched) {
    throw new Error(`Unsupported SPRING_DATASOURCE_URL: ${jdbc}`);
  }
  return {
    host: matched[1],
    port: matched[2] ? Number(matched[2]) : 3306,
    user: env.SPRING_DATASOURCE_USERNAME || 'root',
    password: env.SPRING_DATASOURCE_PASSWORD || '',
    database: matched[3],
    charset: 'utf8mb4'
  };
}

async function checkUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 gx-geo-news/url-verifier'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    await response.body?.cancel?.();
    return {
      accessible: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      finalUrl: response.url,
      error: null
    };
  } catch (error) {
    return {
      accessible: false,
      statusCode: null,
      finalUrl: '',
      error: error.message
    };
  }
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfigFromEnv());
    console.log('数据库连接成功');

    // 查询所有新闻
    const [rows] = await connection.execute(`
      SELECT n.id, nv.id AS version_id, nv.original_url, nv.title
      FROM news n
      JOIN news_versions nv ON n.current_version_id = nv.id
      ORDER BY n.id
    `);

    console.log(`\n开始检查 ${rows.length} 条新闻的URL可访问性...\n`);

    let accessibleCount = 0;
    let inaccessibleCount = 0;

    const results = await mapLimit(rows, CONCURRENCY, async (row, i) => {
      const progress = `[${i + 1}/${rows.length}]`;

      process.stdout.write(`${progress} 检查: ${row.original_url.substring(0, 60)}... `);

      const result = await checkUrl(row.original_url);

      const item = {
        id: row.id,
        versionId: row.version_id,
        url: row.original_url,
        title: row.title,
        ...result
      };

      if (result.accessible) {
        console.log(`✓ ${result.statusCode}`);
      } else {
        console.log(`✗ ${result.error || result.statusCode}`);
      }
      return item;
    });

    for (const result of results) {
      if (result.accessible) accessibleCount++;
      else inaccessibleCount++;
      await connection.execute(
        'UPDATE news_versions SET url_verified_at=NOW(3), url_status=?, final_url=? WHERE id=?',
        [result.accessible ? 'accessible' : 'inaccessible', result.finalUrl || result.url, result.versionId]
      );
    }

    // 生成报告
    console.log('\n' + '='.repeat(80));
    console.log('URL可访问性检查报告');
    console.log('='.repeat(80));
    console.log(`总计: ${rows.length} 条新闻`);
    console.log(`可访问: ${accessibleCount} 条 (${(accessibleCount / rows.length * 100).toFixed(1)}%)`);
    console.log(`不可访问: ${inaccessibleCount} 条 (${(inaccessibleCount / rows.length * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    // 输出不可访问的新闻列表
    const inaccessibleNews = results.filter(r => !r.accessible);
    if (inaccessibleNews.length > 0) {
      console.log('\n不可访问的新闻列表:');
      console.log('-'.repeat(80));
      inaccessibleNews.forEach((news, index) => {
        console.log(`${index + 1}. ID: ${news.id}`);
        console.log(`   标题: ${news.title}`);
        console.log(`   URL: ${news.url}`);
        console.log(`   错误: ${news.error || news.statusCode}`);
        console.log('');
      });
    }

    // 保存结果到JSON文件
    const fs = require('fs');
    const reportPath = 'backend/target/audit/url-accessibility-report.json';
    fs.mkdirSync('backend/target/audit', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      checkTime: new Date().toISOString(),
      total: rows.length,
      accessible: accessibleCount,
      inaccessible: inaccessibleCount,
      results: results
    }, null, 2));
    console.log(`\n详细报告已保存到: ${reportPath}`);

    // 输出需要删除的新闻ID列表
    if (inaccessibleNews.length > 0) {
      console.log('\n需要删除的新闻ID列表:');
      console.log(inaccessibleNews.map(n => n.id).join(', '));
    }

  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
