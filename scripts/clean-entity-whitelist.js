const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../datasets/config/entity-whitelist.json');
const outputPath = inputPath;
const backupPath = path.join(
  __dirname,
  '../datasets/config/backups',
  `entity-whitelist_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

// 读取原始文件
const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// 备份
fs.mkdirSync(path.dirname(backupPath), { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log(`Backup created: ${backupPath}`);

// 过滤实体
const filteredEntities = data.entities.filter((entity) => {
  // 移除"新闻来源"类别
  if (entity.category === '新闻来源') {
    return false;
  }

  // 只保留直接相关的实体
  const allowedRelevance = ['直接相关', '直接/应用相关', '直接/间接相关'];

  return allowedRelevance.includes(entity.relevance);
});

// 生成新文件
const newData = {
  ...data,
  count: filteredEntities.length,
  entities: filteredEntities,
  cleanedAt: new Date().toISOString(),
  cleanedFrom: data.count,
  cleanedReason: '移除新闻来源类别和非直接相关实体',
};

fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2));
console.log(`Cleaned whitelist saved: ${outputPath}`);
console.log(`Entities: ${data.count} -> ${filteredEntities.length}`);
console.log(`Removed: ${data.count - filteredEntities.length} entities`);

// 统计移除的实体类别
const removedByCategory = {};
const removedByRelevance = {};

data.entities.forEach((entity) => {
  if (!filteredEntities.find((e) => e.id === entity.id)) {
    removedByCategory[entity.category] = (removedByCategory[entity.category] || 0) + 1;
    removedByRelevance[entity.relevance] = (removedByRelevance[entity.relevance] || 0) + 1;
  }
});

console.log('\nRemoved by category:');
Object.entries(removedByCategory)
  .sort((a, b) => b[1] - a[1])
  .forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

console.log('\nRemoved by relevance:');
Object.entries(removedByRelevance)
  .sort((a, b) => b[1] - a[1])
  .forEach(([relevance, count]) => {
    console.log(`  ${relevance}: ${count}`);
  });
