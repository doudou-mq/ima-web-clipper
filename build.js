#!/usr/bin/env node

/**
 * IMA Web Clipper 构建脚本
 * 用于打包插件文件
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  sourceDir: __dirname,
  outputDir: path.join(__dirname, 'dist'),
  outputFile: 'ima-web-clipper.zip',
  excludePatterns: [
    '**/node_modules/**',
    '**/.git/**',
    '**/.DS_Store',
    '**/dist/**',
    '**/build.js',
    '**/generate-icons.js',
    '**/*.log'
  ]
};

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始构建 IMA Web Clipper...\n');
  
  try {
    // 1. 清理输出目录
    console.log('1. 清理输出目录...');
    if (fs.existsSync(config.outputDir)) {
      fs.rmSync(config.outputDir, { recursive: true });
    }
    fs.mkdirSync(config.outputDir, { recursive: true });
    
    // 2. 复制文件
    console.log('2. 复制文件...');
    copyDirectory(config.sourceDir, config.outputDir);
    
    // 3. 清理不需要的文件
    console.log('3. 清理不需要的文件...');
    cleanDirectory(config.outputDir);
    
    // 4. 打包
    console.log('4. 打包插件...');
    const zipPath = path.join(config.sourceDir, config.outputFile);
    createZip(config.outputDir, zipPath);
    
    // 5. 输出结果
    console.log('\n✅ 构建完成！');
    console.log(`📦 插件包: ${zipPath}`);
    console.log(`📁 输出目录: ${config.outputDir}`);
    
    const stats = fs.statSync(zipPath);
    console.log(`📊 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('\n❌ 构建失败:', error.message);
    process.exit(1);
  }
}

/**
 * 复制目录
 */
function copyDirectory(source, target) {
  const files = fs.readdirSync(source);
  
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    // 检查是否在排除列表中
    if (shouldExclude(sourcePath)) {
      continue;
    }
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * 清理目录
 */
function cleanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    // 删除构建脚本本身
    if (file === 'build.js' || file === 'generate-icons.js') {
      fs.unlinkSync(filePath);
      continue;
    }
    
    // 删除 package.json（如果需要）
    if (file === 'package.json') {
      // 可以保留或删除，这里选择保留但清理 devDependencies
      const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      delete packageJson.devDependencies;
      delete packageJson.scripts;
      fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2));
    }
    
    // 递归清理子目录
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      cleanDirectory(filePath);
    }
  }
}

/**
 * 创建 ZIP 文件
 */
function createZip(sourceDir, zipPath) {
  const cwd = process.cwd();
  
  try {
    process.chdir(sourceDir);
    
    // 构建排除参数
    const excludeArgs = config.excludePatterns.flatMap(pattern => ['-x', pattern]);
    
    // 执行 zip 命令
    execSync(`zip -r "${zipPath}" . ${excludeArgs.join(' ')}`, {
      stdio: 'inherit'
    });
    
  } finally {
    process.chdir(cwd);
  }
}

/**
 * 检查文件是否应该被排除
 */
function shouldExclude(filePath) {
  const relativePath = path.relative(config.sourceDir, filePath);
  
  for (const pattern of config.excludePatterns) {
    const normalizedPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
    const regex = new RegExp(`^${normalizedPattern}$`);
    
    if (regex.test(relativePath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 运行构建
 */
if (require.main === module) {
  main().catch(error => {
    console.error('构建过程出错:', error);
    process.exit(1);
  });
}

module.exports = {
  config,
  copyDirectory,
  cleanDirectory,
  createZip
};