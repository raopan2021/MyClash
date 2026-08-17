'use strict';

/**
 * MyClash 覆写脚本构建器
 *
 * 把 Script/modules/ 下按职责拆分的源模块，按依赖顺序拼接，
 * 生成一个自包含的单文件 dist/mihomoScript.js（无 import/export，
 * 模块间通过顶层 const/function 共享），供：
 *  - 代理客户端通过 raw.githubusercontent 链接一键导入
 *  - Test/ 下的自动化测试（vm 沙箱 + ES2020 + QuickJS）直接加载
 *
 * 用法：
 *   npm run build          （或  node Script/build.js）
 *
 * 注意：修改任何 modules/ 下的文件后，需重新运行本脚本，
 * 并把生成的 dist/mihomoScript.js 一并提交（保证 raw 链接可用）。
 * 本地已在 commit 前通过 simple-git-hooks 自动执行本构建并 stage dist/。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const MODULES_DIR = path.join(ROOT, 'modules');
const OUTPUT = path.join(ROOT, '../dist/mihomoScript.js');

/**
 * 模块拼接顺序（依赖在前）。
 * 模块之间通过顶层 const/function 互相引用，拼接后处于同一全局作用域。
 */
const MODULE_ORDER = [
  // 静态配置
  'options.js', // ruleOptionsEnable（配置开关）
  'static.js', // prefixRules / customizeProxies / excludeFilter / blockForeignQuic / directProxies
  'regions.js', // regionDefinitions / rateRegionDefinitions / allRegionDefinitions
  'providers.js', // baseRuleProviders
  'groups.js', // select/url-test/load-balance 基础配置 + baseGroups
  'service-configs.js', // serviceConfigs（全量版分流策略组）

  // 逻辑
  'nodes.js', // 节点过滤/标准化/重命名
  'region-groups.js', // 地区/倍率策略组构建
  'customize.js', // 自定义节点
  'functional.js', // 基础/分流策略组、GLOBAL、规则集
  'dns.js', // DNS 与 hosts

  // 入口
  'main.js',
];

/** 读取模块文件，剔除首尾多余空行 */
function readModule(file) {
  const abs = path.join(MODULES_DIR, file);
  return fs.readFileSync(abs, 'utf8').replace(/^\n+|\n+$/g, '');
}

/** 生成单文件脚本内容 */
function build() {
  // 顶部注释提取为独立模块 _header.js（避免在 build.js 里硬编码，便于统一维护）
  const header = readModule('_header.js');

  const parts = MODULE_ORDER.map((file, index) => {
    const title = file.replace(/\.js$/, '').replace(/^_/, '');
    const sep = `\n\n// ===================== ${title} =====================\n\n`;
    return `${sep}${readModule(file)}`;
  });

  return header + parts.join('\n') + '\n';
}

// 校验：生成的产物必须包含 main 函数（入口），否则视为构建失败
function verify(code) {
  if (!/function\s+main\s*\(/.test(code)) {
    throw new Error('构建失败：生成的脚本中未找到 main 函数入口');
  }
  if (!/const\s+ruleOptionsEnable\s*=/.test(code)) {
    throw new Error('构建失败：生成的脚本中未找到 ruleOptionsEnable 配置');
  }
}

try {
  const code = build();
  verify(code);
  fs.writeFileSync(OUTPUT, code, 'utf8');
  console.log(`已生成 ${path.relative(ROOT, OUTPUT)} (${code.split('\n').length} 行)`);
} catch (err) {
  console.error(`构建失败: ${err.message}`);
  process.exit(1);
}
