/**
 * 图标生成脚本
 * 生成基本的插件图标
 */

const fs = require('fs');
const path = require('path');

// 简单的 SVG 图标模板
const iconTemplate = (size, color = '#1a73e8') => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size/8}" fill="${color}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size/3}" 
        fill="white" text-anchor="middle" dy=".3em" font-weight="bold">
    IMA
  </text>
</svg>
`;

// 需要生成的图标尺寸
const iconSizes = [
  { name: 'icon16.png', size: 16 },
  { name: 'icon48.png', size: 48 },
  { name: 'icon128.png', size: 128 }
];

console.log('生成 IMA Web Clipper 图标...');

// 创建 icons 目录（如果不存在）
const iconsDir = __dirname;
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 生成图标
iconSizes.forEach(({ name, size }) => {
  const svgContent = iconTemplate(size);
  const filePath = path.join(iconsDir, name);
  
  // 注意：这里只是生成 SVG，实际需要转换为 PNG
  // 为了简化，我们直接保存为 SVG，实际使用时需要转换为 PNG
  fs.writeFileSync(filePath.replace('.png', '.svg'), svgContent);
  console.log(`生成: ${name.replace('.png', '.svg')}`);
});

console.log('\n注意：生成的图标是 SVG 格式，需要转换为 PNG 格式才能在浏览器插件中使用。');
console.log('可以使用在线工具或图像编辑软件进行转换。');
console.log('\n推荐的 PNG 图标：');
console.log('- 16x16: 工具栏图标');
console.log('- 48x48: 扩展管理页面图标');
console.log('- 128x128: 应用商店图标');