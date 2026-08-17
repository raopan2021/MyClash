// --- 主入口 ---

/**
 * 主入口：覆写机场订阅配置，生成完整 mihomo 配置
 */
function main(config) {
  const newConfig = {};

  // 节点过滤、重命名及验证（仅订阅节点）
  const filteredProxies = filterAndNormalizeProxies(config);

  // 处理自定义节点（标准化、解决重名、构建“自建节点”策略组）
  const { customProxies, customProxyNames, customGroup } = buildCustomizeGroups(filteredProxies);

  // 构建地区组和倍率组
  const generatedRegionGroups = buildRegionGroups(filteredProxies, customProxies);

  // 低倍率节点组置顶：在 proxy-groups 中排在最前面，便于快速切换
  const lowRateGroupNames = [lowRateRegionName, `${lowRateRegionName}-自动选择`];
  const lowRateGroups = generatedRegionGroups.filter((g) => lowRateGroupNames.includes(g.name));
  const restRegionGroups = generatedRegionGroups.filter((g) => !lowRateGroupNames.includes(g.name));

  // 构建基础策略组和分流策略组（含“自建节点”策略组与“链式中转”策略组）
  const { globalGroup, functionalGroups, functionalRules, finalRuleProviders, chainGroup } = buildFunctionalGroups(
    filteredProxies,
    generatedRegionGroups,
    { customProxyNames, customGroup },
  );

  // dns和hosts相关处理（仅订阅节点参与 hosts 改写，返回已应用 hosts 映射的节点列表）
  const { dns, hosts, proxies: mappedProxies } = buildDnsAndHostsConfig(config, filteredProxies);

  newConfig['dns'] = dns;
  newConfig['hosts'] = hosts;
  newConfig['mixed-port'] = 7890;
  newConfig['allow-lan'] = true;
  newConfig['ipv6'] = true;
  newConfig['mode'] = 'rule';
  newConfig['log-level'] = 'info';
  newConfig['bind-address'] = '*';
  newConfig['unified-delay'] = true;
  newConfig['tcp-concurrent'] = true;
  newConfig['keep-alive-interval'] = 60;
  newConfig['find-process-mode'] = 'strict';

  newConfig['external-controller'] = '127.0.0.1:9090';
  newConfig['external-ui'] = 'ui';
  newConfig['external-ui-url'] = 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip';

  newConfig['profile'] = {
    'store-selected': true,
    'store-fake-ip': true,
  };

  newConfig['ntp'] = {
    enable: true,
    'write-to-system': false,
    server: 'ntp.aliyun.com',
    port: 123,
    interval: 60,
  };

  newConfig['tun'] = {
    enable: true,
    stack: 'system',
    'auto-route': true,
    'strict-route': true,
    'auto-redirect': true,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53', 'tcp://any:53'],
  };

  newConfig['proxies'] = [...customProxies, ...mappedProxies, ...directProxies];
  newConfig['proxy-groups'] = [
    ...lowRateGroups,
    globalGroup,
    ...functionalGroups,
    ...(chainGroup ? [chainGroup] : []),
    ...restRegionGroups,
  ];
  newConfig['rule-providers'] = finalRuleProviders;

  newConfig['rules'] = [
    ...prefixRules,
    ...(ruleOptionsEnable.屏蔽国外QUIC ? blockForeignQuic : []),
    ...functionalRules,

    // 兜底规则
    'RULE-SET,gfw,默认代理',
    'RULE-SET,geolocation-cn,直连',
    'RULE-SET,cn_ip,直连',
    'RULE-SET,private_ip,直连',
    'MATCH,漏网之鱼',
  ];

  return newConfig;
}
