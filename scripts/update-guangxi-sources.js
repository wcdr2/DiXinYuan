const fs = require('fs');
const path = require('path');

// 读取文件
const sourcesPath = path.join(__dirname, '..', 'datasets', 'config', 'sources.json');
const updatedSourcesPath = path.join(__dirname, '..', 'guangxi-sources-updated.json');

const allSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const updatedSources = JSON.parse(fs.readFileSync(updatedSourcesPath, 'utf8'));

console.log(`总来源数量: ${allSources.length}`);
console.log(`更新的广西来源数量: ${updatedSources.length}`);

// 创建更新来源的ID映射
const updatedIds = new Set(updatedSources.map(s => s.id));

// 移除旧的广西来源，添加新的
const filteredSources = allSources.filter(s => !updatedIds.has(s.id));
const mergedSources = [...filteredSources, ...updatedSources];

console.log(`\n移除了 ${allSources.length - filteredSources.length} 个旧的广西来源`);
console.log(`添加了 ${updatedSources.length} 个更新的广西来源`);
console.log(`\n更新后的来源:`);
updatedSources.forEach(s => {
  const status = s.isActive ? '✓ 启用' : '✗ 禁用';
  console.log(`  ${status} - ${s.id}: ${s.name}`);
});

// 备份
const backupPath = sourcesPath + '.backup.' + Date.now();
fs.copyFileSync(sourcesPath, backupPath);
console.log(`\n已备份到: ${backupPath}`);

// 写入
fs.writeFileSync(sourcesPath, JSON.stringify(mergedSources, null, 2), 'utf8');
console.log(`\n已更新 sources.json`);
console.log(`最终来源数量: ${mergedSources.length}`);
