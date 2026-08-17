// ---构建自定义节点组---

/**
 * 处理自定义节点：标准化名称、与订阅节点重名时添加“自建-”前缀、内部去重，
 * 并构建“自建节点”策略组。
 * 自定义节点不参与订阅节点过滤，也不参与 hosts 改写及 DNS 域名处理。
 */
function buildCustomizeGroups(filteredProxies, customizeList = customizeProxies) {
  const chainEnabled = ruleOptionsEnable.链式代理;

  // 未配置自定义节点时直接返回空结果
  if (!customizeList.length) {
    if (chainEnabled) {
      throw new Error('启用失败，请在脚本中添加自定义节点后尝试');
    }
    return { customProxies: [], customProxyNames: [], customGroup: null };
  }

  // 订阅节点标准化后的名称集合，用于重名判断
  const usedNames = new Set(filteredProxies.map((p) => p.name));

  // 重名时使用的前缀
  const customPrefix = '自建-';

  // 标准化自定义节点并解决重名冲突（与订阅节点重名或自定义节点间重名）
  const customProxies = [];
  for (const proxy of customizeList) {
    const normalized = normalizeProxyName(proxy);

    let name = normalized.name;

    // 重名时添加前缀并重新标准化（国旗自动回到最前），直至名称唯一；
    // 标准化会重建“国旗 + 空格 + 名称”格式，这里去掉前缀后多余的空格
    while (usedNames.has(name)) {
      name = normalizeProxyName({ name: `${customPrefix}${name}` }).name.replace(`${customPrefix} `, customPrefix);
    }
    usedNames.add(name);

    let customProxy = name === normalized.name ? normalized : { ...normalized, name };
    // 链式代理启用时强制添加/覆盖 dialer-proxy，使自定义节点经“链式中转”策略组中转
    if (chainEnabled && customProxy['dialer-proxy'] !== dialerProxyName) {
      customProxy = { ...customProxy, 'dialer-proxy': dialerProxyName };
    }
    customProxies.push(customProxy);
  }

  // 自建节点/链式落地 策略组
  const customGroup = {
    ...selectBaseOption,
    name: chainEnabled ? '链式落地' : '自建节点',
    proxies: customProxies.map((p) => p.name),
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png',
  };

  return {
    customProxies,
    customProxyNames: customProxies.map((p) => p.name),
    customGroup,
  };
}
