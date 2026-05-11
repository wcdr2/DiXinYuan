const fs = require('fs');
const path = require('path');

// 读取现有的sources.json
const sourcesPath = path.join(__dirname, '..', 'datasets', 'config', 'sources.json');
const newSourcesPath = path.join(__dirname, '..', 'guangxi-new-sources.json');

const existingSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const newSources = JSON.parse(fs.readFileSync(newSourcesPath, 'utf8'));

console.log(`现有来源数量: ${existingSources.length}`);
console.log(`新增来源数量: ${newSources.length}`);

// 检查是否有重复的ID
const existingIds = new Set(existingSources.map(s => s.id));
const duplicates = newSources.filter(s => existingIds.has(s.id));

if (duplicates.length > 0) {
  console.log('\n警告：发现重复的来源ID:');
  duplicates.forEach(s => console.log(`  - ${s.id}: ${s.name}`));
  console.log('\n跳过这些重复的来源...');
}

// 只添加不重复的来源
const uniqueNewSources = newSources.filter(s => !existingIds.has(s.id));
console.log(`\n将添加 ${uniqueNewSources.length} 个新来源:`);
uniqueNewSources.forEach(s => console.log(`  - ${s.id}: ${s.name} (${s.type})`));

// 合并
const mergedSources = [...existingSources, ...uniqueNewSources];

// 备份原文件
const backupPath = sourcesPath + '.backup.' + Date.now();
fs.copyFileSync(sourcesPath, backupPath);
console.log(`\n已备份原文件到: ${backupPath}`);

// 写入合并后的文件
fs.writeFileSync(sourcesPath, JSON.stringify(mergedSources, null, 2), 'utf8');
console.log(`\n已更新 sources.json`);
console.log(`总来源数量: ${mergedSources.length}`);
