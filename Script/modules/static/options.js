// 适配 Bettbox 自定义配置参数
const Compatible_With_Bettbox = { ruleOptionsEnable: true };

/**
 * 自定义配置选项
 * true = 启用
 * false = 禁用
 */
const ruleOptionsEnable = {
  // 基础策略组
  手动选择: true, // 是否启用手动选择策略组
  自动选择: true, // 是否启用自动选择策略组
  负载均衡: true, // 是否启用负载均衡策略组

  // 以下为分流策略配置
  AI: true, // 国外AI服务
  Media: true, // 国外视频平台
  FCM: true, // GoogleFCM服务
  Google: true, // Google服务
  Microsoft: true, // Microsoft服务
  Apple: true, // Apple服务
  Telegram: true, // Telegram通讯软件
  Steam: true, // Steam游戏平台
  TikTok: true, // TikTok视频平台
  Twitter: true, // Twitter社交平台
  Emby: true, // Emby媒体服务
  PikPak: true, // PikPak网盘服务
  Spotify: true, // Spotify音乐服务
  Crypto: true, // 加密货币相关服务
  EHentai: true, // E-Hentai网站
  AdBlock: true, // 广告拦截

  // 以下为非分流策略配置
  生成地区自动选择组: true, // 是否生成地区自动选择策略组
  隐藏地区手动选择组: false, // 是否隐藏地区手动选择策略组
  生成倍率组: true, // 是否生成低倍率/高倍率策略组
  分流组添加所有节点: false, // 是否为分流策略组添加所有节点
  过滤高倍率节点: false, // 是否过滤高倍率节点
  过滤非地区节点: true, // 是否过滤非地区节点
  屏蔽国外QUIC: true, // 是否屏蔽国外QUIC流量
  代理IPV4优先: false, // 是否将订阅节点统一为 IPv4 优先（与“代理IPV6优先”同时开启时不生效）
  代理IPV6优先: false, // 是否将订阅节点统一为 IPv6 优先（与“代理IPV4优先”同时开启时不生效）
  链式代理: false, // 是否启用链式代理（自定义节点作为落地节点，经“链式中转”策略组中转）
};
