# MyClash 覆写脚本完全指南

> 帮助理解 `dist/mihomoScript.js`（全量版）到底做了什么、代码怎么组织、以及想改东西时改哪里。
> 适用对象：想看懂脚本、想自定义节点/分流/策略、想加功能的人。

---

## 0. 一句话定位

**这是一个"订阅清洗+重组器"**：把一个机场（订阅商）返回的又乱又多的 mihomo 配置，自动整理成一套"干净、按地区分类、可开关"的配置。

```
机场原始配置 (config)  ──►  main(config)  ──►  整齐的新配置 (newConfig)
```

它**不生成节点**（节点来自机场），只负责：过滤掉垃圾节点、给节点补国旗分类、按地区/倍率建策略组、配好 DNS/hosts、给出最终规则。

---

## 1. 数据流总览

脚本从 `main(config)` 进入，像一条流水线，每个环节处理一件事：

```
                    ┌─────────────────────────────────────────────┐
 config ─────► │ ① filterAndNormalizeProxies  过滤/标准化节点   │
                    ├─────────────────────────────────────────────┤
                    │ ② buildCustomizeGroups       处理自建节点      │
                    ├─────────────────────────────────────────────┤
                    │ ③ buildRegionGroups          按地区/倍率归类    │
                    ├─────────────────────────────────────────────┤
                    │ ④ buildFunctionalGroups      建策略组+规则     │
                    ├─────────────────────────────────────────────┤
                    │ ⑤ buildDnsAndHostsConfig     配 DNS/hosts    │
                    └─────────────────────────────────────────────┘
                                          │
                                          ▼
                                    newConfig（输出）
```

**对应到代码入口**（`Script/modules/main.js`）：

```js
function main(config) {
  const filteredProxies = filterAndNormalizeProxies(config);      // ①
  const { customProxies, ... } = buildCustomizeGroups(...);        // ②
  const generatedRegionGroups = buildRegionGroups(...);            // ③
  const { globalGroup, ... } = buildFunctionalGroups(...);         // ④
  const { dns, hosts, ... } = buildDnsAndHostsConfig(...);         // ⑤
  // ... 拼装成 newConfig 返回  
}
```

> 只要记住这 5 个步骤，整个脚本的骨架就通了。下面逐段展开。

---

## 2. 代码目录怎么组织

源码拆在 `Script/modules/`，分两类：

```
Script/modules/
├── static/                  ┌─ 纯配置数据（不含函数逻辑）
│   ├── header.js            │   顶部注释
│   ├── options.js           │   ★ 配置开关 ruleOptionsEnable（最常改）
│   ├── static.js            │   前置规则 / 自建节点 / 排除正则 / QUIC / 直连节点
│   ├── regions.js           │   地区 / 倍率定义（+ 匹配正则）
│   ├── providers.js         │   基础规则集（rule-providers）
│   ├── groups.js            │   策略组基础参数（select/url-test/load-balance）
│   └── service-configs.js   │   ★ 全量版分流策略组清单（AI/Media/Google…）
│
├── nodes.js                 ── ① 节点过滤/标准化/重命名
├── region-groups.js         ── ③ 按地区/倍率建策略组
├── customize.js             ── ② 自建节点处理
├── functional.js            ── ④ 建基础/分流策略组、GLOBAL、汇总规则
├── dns.js                   ── ⑤ DNS 与 hosts
└── main.js                  ── 入口，编排上面所有步骤
```

> **`static/` 是"数据"**（声明了有哪些东西），**根目录下的是"逻辑"**（决定怎么处理这些东西）。看代码时先分清你在看"有什么"还是"怎么处理"。

---

## 3. 逐环节讲解

### ① 节点过滤与标准化 —— `nodes.js`

机场给的节点往往名字很乱。这一步做四件事：

1. **剔除垃圾节点**：类型是 `direct/reject/rematch` 的不要。
2. **过滤信息节点**（`过滤非地区节点` 开启时）：用 `excludeFilter` 正则，凡是名字里带"官网、客服、流量、到期、公益、机场"这类词的节点都删掉。
3. **标准化名字**（`normalizeProxyName`）：
   - 补全地区国旗：`"日本东京01"` → `"🇯🇵 日本东京01"`
   - 折叠多余空格、去重（同名只留第一个）
4. **可选**：统一 IPv4/IPv6 优先、过滤高倍率节点。

> 想改"哪些词算垃圾信息"，改 `static/static.js` 里的 `excludeFilter`。

### ② 自建节点 —— `customize.js`

- 你可以在 `static/static.js` 的 `customizeProxies = []` 里手写自己的节点（vmess 等）。
- 如果跟订阅节点重名，自动加 `自建-` 前缀。
- 开启 `链式代理` 时，自建节点会变成"落地节点"，经"链式中转"策略组通过订阅节点中转。

### ③ 按地区/倍率归类 —— `region-groups.js`

把节点按名字里的关键词分到对应的策略组里：

- **地区**（`static/regions.js` 的 `regionDefinitions`）：香港 🇭🇰、日本 🇯🇵、美国 🇺🇸、新加坡 🇸🇬、台湾省 🇹🇼
- **倍率**（`rateRegionDefinitions`）：低倍率（≤0.5）、高倍率（≥2）
- 哪个地区都不匹配的节点 → 进"其他节点"组。

> 地区是靠**正则**匹配的。想加一个"韩国"地区，在 `regions.js` 加一条 `{ name, flag, regex, icon }` 即可（见第 5 节示例）。

### ④ 构建策略组与规则 —— `functional.js`

这是最核心的一步，把所有东西拼装成最终能用的策略组和规则：

- 生成基础策略组：`默认代理`、`手动选择`、`自动选择`、`负载均衡`
- 生成各**分流策略组**：`AI`、`Media`、`Google`、`Telegram`、`Steam`、`AdBlock` …（清单在 `static/service-configs.js`）
- 生成 `漏网之鱼`（兜底）、`直连`、`GLOBAL`
- 汇总所有规则（`RULE-SET` 等）和规则集（`rule-providers`）

> 想"新增/删除一个分流策略组"，改 `static/service-configs.js`（见第 5 节示例）。

### ⑤ DNS 与 hosts —— `dns.js`

**这是脚本最精华的部分**，专门解决机场"私有 DNS / hosts 导致节点解析不了、延迟虚高"的问题：

- 把机场 `hosts` 里对节点域名的映射，**直接改写进节点 `server`**（支持链式映射）。
- 收集节点域名，生成专门的 DNS 策略，并保留 `fake-ip-filter`（节点域名走真实 IP，避免 fake-ip 连不上）。
- 过滤掉公共 DNS，保留私有 DNS。
- 内置小优化：屏蔽 B 站 PCDN（`mcdn.bilivideo` → 0.0.0.0）、修复谷歌商店下载。

> 一般**不需要动**。只有你的机场解析有特殊问题时才需要看这里。

---

## 4. 三个必须懂的核心概念

### 4.1 规则集（rule-set / rule-providers）

mihomo 用"规则集"批量匹配域名/IP，而不是一条条手写规则。脚本通过 HTTP 从 GitHub 拉取 `.mrs` 文件：

```yaml
rule-providers:
  telegram:                 # 规则集名字
    type: http
    behavior: domain        # 按域名匹配
    url: https://.../telegram.mrs   # 从这拉取
    path: ./ruleset/telegram.mrs
```

然后一条规则引用它：

```
RULE-SET,telegram,Telegram    # 命中 telegram 规则集的 → 走 Telegram 策略组
```

**好处**：按需加载、内存占用低（这就是 README 里说的告别臃肿 geodata）。

### 4.2 策略组的三种类型

| 类型 | 干什么 | 用在 |
|---|---|---|
| `select` | 手动选择节点 | 手动选择、各分流组 |
| `url-test` | 自动选延迟最低的节点 | 自动选择、xx-自动选择 |
| `load-balance` | 负载均衡（sticky-sessions） | 负载均衡 |

参数（`static/groups.js` 的 `groupBaseOption`）：每 600s 测一次延迟，超时 3s，连续失败 3 次切换。

### 4.3 节点匹配正则

脚本靠"正则"识别节点属于哪个地区。以香港为例：

```js
/🇭🇰|香港|(?<![A-Za-z])HKG?(?![A-Za-z])|hong\s*kong/i
```

含义：
- 带 🇭🇰 旗子、或名字含"香港"
- 或独立的 `HKG`/`HK`（用 `(?<!...)(?!...)` 保证不是其他英文单词的一部分）
- 或 `hong kong`

> 正则匹配到的地区，会同时决定：**进哪个地区组** + **补哪个国旗**。

---

## 5. 常见修改场景（照着改就行）

### 场景 A：我只想开/关某个分流组

改 `static/options.js` 里的 `ruleOptionsEnable`：

```js
Telegram: true,   // 改成 false 就不分流 Telegram 了
AdBlock: false,   // 关闭广告拦截
```

### 场景 B：想加一个"韩国"地区组

改 `static/regions.js`，加一条（复制现有条目改）:

```js
{
  name: '韩国',
  flag: '🇰🇷',
  regex: /🇰🇷|韩国|(?<![A-Za-z])KOR?(?![A-Za-z])|korea/i,
  icon: 'https://.../South_Korea.png',
},
```

### 场景 C：想加一个"GitHub"分流策略组

改 `static/service-configs.js`，在数组里加一项：

```js
{
  name: 'GitHub',
  baseOption: selectBaseOption,
  providers: {
    github: {
      ...ruleProviderCommonDomain,
      url: 'https://.../github.mrs',
      path: './ruleset/github.mrs',
      'path-in-bundle': 'geo/geosite/github.mrs',
    },
  },
  icon: 'https://.../GitHub.png',
  rules: ['RULE-SET,github,GitHub'],
},
```

（`functional.js` 会自动把 `serviceConfigs` 里的每一项生成策略组 + 汇总规则，无需改逻辑。）

### 场景 D：想自己加个节点

改 `static/static.js` 的 `customizeProxies`（参考文件里的注释示例）。

### 场景 E：修改构建产物后要重新生成

改完 `Script/modules/` 下任何文件后：

```bash
npm run build        # 重新生成 dist/mihomoScript.js
```

提交时 pre-commit 钩子会自动帮你构建并 stage `dist/`，不用手动担心产物。

---

## 6. 配置开关速查表（`static/options.js`）

| 开关 | 默认 | 作用 |
|---|---|---|
| `手动选择` / `自动选择` / `负载均衡` | true | 基础策略组 |
| `AI` `Media` `Google` `Telegram`… | true | 各分流策略组开关 |
| `AdBlock` | true | 广告拦截 |
| `生成地区自动选择组` | true | 每个地区额外生成 url-test 自动选择组 |
| `隐藏地区手动选择组` | false | 隐藏手动 select 地区组 |
| `生成倍率组` | true | 生成低/高倍率节点组 |
| `分流组添加所有节点` | false | 分流组是否塞入所有具体节点 |
| `过滤高倍率节点` | false | 过滤掉倍率 ≥2 的节点 |
| `过滤非地区节点` | true | 过滤信息节点（官网/客服等） |
| `屏蔽国外QUIC` | true | 阻断国外 UDP:443 QUIC 流量 |
| `代理IPV4优先`/`代理IPV6优先` | false | 统一节点 IP 版本（同开不生效） |
| `链式代理` | false | 自建节点做落地节点中转 |

---

## 7. 构建与测试

```bash
npm run build        # 构建产物 → dist/mihomoScript.js
npm test             # 跑测试（vm 沙箱加载产物，162 项）
```

- 测试直接加载 `dist/mihomoScript.js`，不修改源码。
- 修改源码后 commit，pre-commit 钩子会自动 `npm run build && git add dist/`。

---

## 8. 小结（30 秒版）

- 脚本 = 一条**5 步流水线**：过滤节点 → 处理自建 → 按地区归类 → 建策略组 → 配 DNS。
- **静态数据**在 `static/`（开关、地区、分流组、规则集），**处理逻辑**在根级模块。
- 90% 的日常修改（开关分流、加地区、加分流组、加自建节点）**只改 `static/` 下的文件**，不用碰逻辑。
- 改完跑 `npm run build`，产物自动进 `dist/`，raw 链接即可用。
