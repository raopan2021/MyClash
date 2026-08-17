// ---构建基础策略组和分流策略组---

/**
 * 构建基础/分流策略组、GLOBAL 组与规则集，并汇总分流规则
 */
function buildFunctionalGroups(filteredProxies, generatedRegionGroups, customizeInfo) {
  const blockForeignQuicEnabled = ruleOptionsEnable.屏蔽国外QUIC;
  const addAllNodesToServiceGroupsEnabled = ruleOptionsEnable.分流组添加所有节点;
  const chainEnabled = ruleOptionsEnable.链式代理;
  const hideManualSelectGroupEnabled = ruleOptionsEnable.隐藏地区手动选择组;

  const functionalGroups = [];
  const functionalRules = [];
  const finalRuleProviders = { ...baseRuleProviders };

  // cn_additional 规则集仅服务于 “屏蔽国外QUIC” 规则，关闭该选项时无需生成
  if (!blockForeignQuicEnabled) {
    delete finalRuleProviders.cn_additional;
  }

  // 自定义节点信息（未配置自定义节点时为空）
  const { customProxyNames = [], customGroup = null } = customizeInfo || {};

  // 筛选后的节点名称列表（不含自定义节点）
  const filteredProxyNames = filteredProxies.map((p) => p.name);

  // 获取所有节点名称（自定义节点优先，便于在基础策略组中查看）
  const allProxiesNames = [...customProxyNames, ...filteredProxyNames];

  // 筛选类型为 select 的地区策略组
  const groupNamesOfSelect = generatedRegionGroups.filter((g) => g.type === 'select').map((g) => g.name);

  // 获取基础策略组名称
  const baseGroupNames = baseGroups.filter((g) => ruleOptionsEnable[g.name]).map((g) => g.name);

  // 自建节点策略组名称（未配置自定义节点时为空数组）
  const customGroupNames = customGroup ? [customGroup.name] : [];

  functionalGroups.push({
    ...selectBaseOption,
    name: '默认代理',
    proxies: [...groupNamesOfSelect, ...baseGroupNames, ...customGroupNames],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png',
  });

  // 分流规则与规则集收集（AdBlock 规则优先，避免广告域名被其他分流规则抢先匹配）
  const orderedServiceConfigs = [
    ...serviceConfigs.filter((svc) => svc.name === 'AdBlock'),
    ...serviceConfigs.filter((svc) => svc.name !== 'AdBlock'),
  ];
  for (const svc of orderedServiceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    functionalRules.push(...(svc.rules || []));
    Object.assign(finalRuleProviders, svc.providers || {});
  }

  // 构建分流策略组（保持 serviceConfigs 原有顺序）
  for (const svc of serviceConfigs) {
    if (!ruleOptionsEnable[svc.name]) continue;

    // 添加分流策略组对应的节点列表
    let groupProxies = [];
    if (svc.includeAll) {
      groupProxies = [...allProxiesNames];
    } else if (svc.reject) {
      groupProxies = ['REJECT', 'REJECT-DROP', 'PASS'];
    } else {
      groupProxies = !addAllNodesToServiceGroupsEnabled
        ? ['默认代理', ...customGroupNames, ...baseGroupNames, ...groupNamesOfSelect, ...(svc.direct ? ['直连'] : [])]
        : [
            '默认代理',
            ...customGroupNames,
            ...baseGroupNames,
            ...groupNamesOfSelect,
            ...allProxiesNames,
            ...(svc.direct ? ['直连'] : []),
          ];
    }

    functionalGroups.push({
      ...svc.baseOption,
      name: svc.name,
      icon: svc.icon,
      proxies: groupProxies,
      ...(svc.defaultSelected !== undefined && {
        'default-selected': svc.defaultSelected,
      }),
    });
  }

  // 添加其他策略组
  functionalGroups.push(
    {
      ...selectBaseOption,
      name: '漏网之鱼',
      proxies: ['默认代理', '直连', ...groupNamesOfSelect],
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Stack.png',
    },
    {
      ...selectBaseOption,
      name: '直连',
      proxies: [...directProxies.map((p) => p.name)],
      url: 'https://connectivitycheck.platform.hicloud.com/generate_204',
      icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China_Map.png',
      hidden: hideManualSelectGroupEnabled,
    },
  );

  // 添加自建节点策略组（未配置自定义节点时跳过）
  if (customGroup) {
    functionalGroups.push(customGroup);
  }

  // 链式代理：构建“链式中转”策略组（自定义节点作为落地节点时的中转选择）
  // 直接放入所有订阅节点（不含自定义节点），不放入策略组，避免与落地节点的 dialer-proxy 形成回环
  const chainGroup =
    chainEnabled && customGroup
      ? {
          ...selectBaseOption,
          name: dialerProxyName,
          proxies: filteredProxyNames,
          icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png',
        }
      : null;

  // 构建 GLOBAL 全局策略组
  const globalGroup = {
    ...selectBaseOption,
    name: 'GLOBAL',
    proxies: [
      ...functionalGroups.map((g) => g.name),
      ...(chainGroup ? [chainGroup.name] : []),
      ...generatedRegionGroups.map((g) => g.name),
    ],
    icon: 'https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png',
  };

  return { globalGroup, functionalGroups, functionalRules, finalRuleProviders, chainGroup };
}
