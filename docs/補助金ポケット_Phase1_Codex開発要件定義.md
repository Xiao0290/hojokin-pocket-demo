# 補助金ポケット — Phase 1 MVP Codex 開発要件定義書

> Version: 1.0  
> 用途: 交给 Codex / AI coding agent 直接拆解、开发、测试。  
> 目标读者: Codex、开发者、产品负责人、设计负责人。  
> 重要前提: 本文件描述的是 **Phase 1 MVP =「補助金発見 → 本人の起草支援」**，不是完整士业撮合平台，也不是 jGrants 自动提交系统。  
> UI/UX: 项目已有 `design-system/`，所有界面实现必须优先复用该设计系统，不允许重新发明视觉语言。

---

## 0. Codex 执行总规则

### 0.1 本文件的优先级
Codex 开发时，按以下优先级处理需求：

1. 合规边界与禁止事项，本文件第 2 章。
2. Phase 1 In / Out 范围，本文件第 3 章。
3. API、数据模型、状态机、验收标准。
4. UI/UX 设计系统。
5. 具体实现细节。

只要某个功能、文案、UI 暗示会让用户误以为「平台或 AI 正在代理作成、代理申請、自动提交」，即使其他章节提到，也必须拒绝实现或改为合规表达。

### 0.2 Codex 不允许做的事
- 不要实现 Phase 2 的真实士业撮合、专家聊天、Stripe Connect、eKYC、成功报酬结算。
- 不要实现 jGrants 自动提交、状态同步、受付番号取得。
- 不要展示公司个别採択率预测，例如「あなたの採択率 89%」。
- 不要使用「AIが申請書を作成」「AIが申請」「自動提出」「代理申請できます」等表达。
- 不要自行设计新的 UI 风格。必须先检查 `design-system/`，并复用 token、component、layout primitive。
- 不要把系统做成泛用 SaaS 模板风、金融卡片堆叠风、Dribbble 装饰风。交互可以有实验性，但信息层级必须清楚。

### 0.3 Codex 每个 PR / Issue 的交付要求
每次实现一个功能，必须在 PR 描述或任务输出里写清楚：

```txt
実装内容:
テスト方法:
ローカル起動コマンド:
影響範囲:
未実装/TODO:
スクリーンショット or API response evidence:
```

如果本文件与实际仓库结构不一致，Codex 不要盲目重构整个项目。应先适配现有结构，并在 `docs/implementation-notes.md` 记录偏差。

---

## 1. 产品一句话与北极星

### 1.1 产品一句话
**補助金ポケット** 是面向日本中小企业经营者的移动 App：用户输入公司 URL，系统解析业务内容，推荐可确认的补助金制度，并帮助经营者本人从零开始整理申请准备和事业计划书草稿。

### 1.2 北极星表达
不要说：

```txt
AI が補助金申請を代行します。
```

要说：

```txt
3分で、自社が確認すべき補助金と、次に準備すべき書類がわかる。
```

核心价值不是「替用户申请」，而是：

```txt
少なくとも、見逃さない。
白紙から始めない。
次に何を準備するかがわかる。
```

### 1.3 Phase 1 成功标准
用户完成以下闭环，即视为 MVP 成立：

```txt
公司 URL
  → 公司画像抽取
  → 3〜5 个适合确认的补助金
  → 为什么推荐 / 为什么需要确认
  → 必要书类 checklist
  → AI 下書き草稿
  → 本人编辑
  → docx / PDF 导出
```

---

## 2. 合规边界，P0 需求

### 2.1 产品定位
Phase 1 必须被实现为：

```txt
補助金の発見と、経営者本人による下書き作成を支援する SaaS
```

不是：

```txt
補助金申請代行サービス
行政書士業務の代替サービス
AIによる完成申請書の納品サービス
jGrants自動提出サービス
```

### 2.2 角色边界
| 角色 | Phase 1 中允许做什么 | Phase 1 中不允许暗示什么 |
|---|---|---|
| AI | 解析公开公司网页、生成本人确认用草稿、整理 checklist、提示不足信息 | 代理作成、完成申請書の納品、自动提交 |
| 用户本人 | 输入 URL、确认/编辑公司画像、确认制度、编辑计划书、导出资料 | 无 |
| 平台 | 提供工具、信息整理、提醒、waitlist | 收取书类作成对价、抽成功报酬、承诺採択 |
| 行政書士 | Phase 1 只作为 Coming soon / waitlist 概念出现 | 不做真实撮合、チャット、決済、委任 |

### 2.3 禁止文案与替代表达
必须建立 `legal-copy-guard` 测试，扫描前端文案、后端模板、导出模板、prompt 文件。

| 禁止表达 | 替代表达 |
|---|---|
| AIが申請書を作成します | AIが本人の下書き作成を支援します |
| AIが申請します | 申請手続きは公式サイトでご本人が行ってください |
| 自動提出 | 提出前の準備 |
| 代理申請 | 専門家相談は近日公開 |
| 採択率が上がります | 制度一般の公開実績を表示しています |
| あなたの採択率は89%です | 採択率は会社個別の予測ではありません |
| 成功報酬20%を平台が受け取る | Phase 1 では課金・決済なし |
| 完成版の事業計画書 | 確認・編集が必要な下書き |

### 2.4 必须在 UI 中出现的免责声明
以下文案必须在计划书生成页面、导出确认、docx/PDF 页脚中出现：

```txt
本機能は、申請者ご本人による下書き作成を支援するものです。
最終的な内容確認・作成・提出は、申請者ご本人、または正式に受任した専門家が行ってください。
```

短版用于卡片或 tooltip：

```txt
AI下書きです。提出前に必ず本人確認が必要です。
```

### 2.5 採択率规则
- 允许显示：制度一般的採択率，且必须有来源。
- 不允许显示：针对该公司的採択率预测。
- 没有来源时，不显示採択率数值，只显示：

```txt
公開された採択率データは未確認です
```

### 2.6 jGrants 规则
- Phase 1 只使用 jGrants 公开 GET 数据或本地 fixture。
- 不实现提交 API。
- 不伪造受付番号。
- 不实现 gBizID OIDC 登录。
- 详情页最多显示：

```txt
公式サイトで申請手続きを確認する
```

按钮点击后可以打开外部链接，但按钮文案不能是「提出する」。

---

## 3. Phase 1 范围

### 3.1 In Scope
| 编号 | 模块 | 必须实现 |
|---|---|---|
| F01 | 登录 | Email / Google / LINE 的接口预留；本地开发可 mock auth |
| F02 | URL 诊断 | 输入公司 URL，创建 diagnosis job，SSE 展示进度 |
| F03 | 公司画像 | 抽取公司名、所在地、行业、业务摘要、可能投资方向、引用来源 |
| F04 | 补助金制度 master | jGrants read-only ETL + 手工 seed fixture |
| F05 | 匹配引擎 | pgvector / text 粗筛 + JSONLogic hard rule + soft score 排序 |
| F06 | 诊断结果列表 | 显示 3〜5 个推荐制度、上限、补助率、截止、残日数、适合理由、来源 |
| F07 | 补助金详情 | 要件、必要书类、流程 checklist、来源、last_seen_at |
| F08 | AI 事业计划书起草支援 | 按章节流式生成、本人编辑、状态标记、保存版本 |
| F09 | 导出 | docx / PDF 导出，带免责声明页脚 |
| F10 | 通知 | 截止提醒、诊断完成提醒；本地可 mock push / email |
| F11 | 我的页 | 诊断履历、保存制度、公司画像编辑、通知设置 |
| F12 | 专家咨询 waitlist | 仅记录意向，不撮合、不收费、不聊天 |
| F13 | 审计日志 | 记录浏览、生成、编辑、导出、waitlist 等关键动作 |

### 3.2 Out of Scope
| 功能 | 原因 |
|---|---|
| 士业真实撮合 | Phase 2，且需要法务确认 |
| 专家聊天 | Phase 2 |
| Stripe / eKYC / 成功报酬 | Phase 2，且有合规风险 |
| jGrants 自动提交 | 没有公开提交 API，且合规高风险 |
| gBizID 登录 | Phase 1 不接 |
| 自治体长尾全量爬取 | 数据运营成本过高，MVP 只做 jGrants + fixture |
| 会社個別採択率预测 | 景表法/误认风险 |
| 「自办 vs 专家 68%/89%」真实转化页 | Phase 1 只做 Coming soon waitlist |

---

## 4. 用户、场景与任务

### 4.1 用户画像 A：叩き上げ社長
- 年龄偏高。
- 公司有官网，但不擅长补助金检索。
- 手机主要用 LINE。
- 最大痛点：不知道自己能申请什么，不知道第一步做什么。

设计要求：
- 文案要短。
- 主要按钮清楚。
- 不要让用户先填写大量表单。
- URL 诊断是入口。

### 4.2 用户画像 B：成长型经营者
- 对数字工具接受度高。
- 想快速知道可用制度、截止、上限、准备物。
- 愿意自己先做草稿，再找专家确认。

设计要求：
- 结果页要信息密度足够。
- 必须有来源、last_seen_at、checklist。
- 计划书编辑体验要顺畅。

### 4.3 Phase 2 预备用户：行政書士
Phase 1 不做专家端，但数据结构要为 Phase 2 留扩展空间。

未来专家最想要的是：

```txt
公司业务已整理
制度已初筛
本人已有草稿
必要资料 checklist 已生成
```

因此 Phase 1 要把诊断、计划书、编辑历史、导出历史都结构化保存。

---

## 5. UI/UX 与设计系统要求

### 5.1 总原则
项目已有 `design-system/`。Codex 必须：

1. 先读取 `design-system/`、现有 demo、已有组件。
2. 复用既有 token：color、spacing、radius、shadow、typography、motion。
3. 复用既有基础组件：Button、Input、Card、Badge、Progress、BottomTab、Sheet、Toast、Modal。
4. 没有组件时，先在 `packages/ui` 或设计系统指定目录扩展，不要在页面里写一次性样式。
5. 所有 UI 文案默认日语。
6. 本文件不覆盖设计系统，只规定产品信息架构和交互需求。

### 5.2 视觉方向
已知方向：

```txt
不要普通 SaaS 模板感。
不要泛金融卡片堆叠。
不要 Dribbble 式装饰而无信息层级。
可以有「AI first」「信息流动」「制度地图」「口袋里的资金线索」的视觉隐喻。
但必须保持移动端可用、清楚、可读、可信。
```

### 5.3 移动端交互要求
- 目标设备：iPhone 竖屏优先，Android 次之。
- 触控目标：最小 44px。
- 输入框字号：iOS 不小于 16px，避免自动缩放。
- 底部安全区：必须适配 safe-area。
- 长文本：计划书页面必须支持章节折叠、保存状态、滚动恢复。
- SSE 进度：不要只显示 spinner，要显示当前步骤和已完成步骤。

### 5.4 Tab 信息架构
底部 4 个 Tab：

| Tab | 日语 label | Phase 1 状态 |
|---|---|---|
| Diagnose | 診断 | 主入口，完整实现 |
| Applications | 申請準備 | 展示保存的诊断、草稿、checklist，不做提交 |
| Messages | メッセージ | Coming soon，占位页 + 专家咨询 waitlist |
| My | マイ | 履历、公司画像、通知设置 |

注意：`申請準備` 不能叫 `申請`，避免误导为可提交。

### 5.5 状态设计
每个核心页面必须实现：

```txt
loading
empty
success
partial_success
error
retry
offline_or_timeout
```

尤其 URL 诊断要支持：
- 抓取失败。
- robots 禁止。
- URL 无法解析。
- 提取信息不足。
- 匹配不到制度。
- LLM 超时。

---

## 6. 推荐仓库结构

如果仓库还没有明确结构，建议使用：

```txt
subsidy-pocket/
  apps/
    mobile/                 # Expo / React Native
    api/                    # NestJS BFF
  workers/
    diagnosis-worker/       # URL fetch + extraction + matching
    etl-jgrants/            # read-only ETL
    notification-worker/    # reminder jobs
  packages/
    shared/                 # DTO, zod schemas, types
    ui/                     # design-system adapter / shared UI
    rules/                  # JSONLogic eligibility rules
    prompts/                # prompt templates, schemas
    legal-copy-guard/       # forbidden copy scanner
  infra/
    docker-compose.yml
    db/
      migrations/
      seeds/
  docs/
    product/
    legal/
    implementation-notes.md
```

如果既有仓库已经不同，不要强行迁移；只需要把同类模块对应到现有目录。

### 6.1 本地开发依赖
本地 MVP 最小依赖：

```txt
PostgreSQL + pgvector
Redis
MinIO or local file storage
NestJS API
Expo mobile
Mock LLM adapter
Mock jGrants fixture
```

生产目标可以是 AWS，但第一阶段必须先本地可运行。

---

## 7. 技术栈与实现约束

### 7.1 前端
- Expo / React Native。
- TypeScript strict。
- 推荐 Expo Router。
- 表单校验使用 zod 或项目既有方案。
- 网络请求封装为 `apiClient`，统一处理 auth、error、retry。
- SSE 客户端要封装为 hook，例如 `useDiagnosisEvents(id)`。

### 7.2 后端
- NestJS。
- TypeScript strict。
- REST + SSE。
- 认证可接 Supabase Auth / Auth0 / Cognito；本地开发允许 mock Bearer。
- 后端模块建议：

```txt
AuthModule
UsersModule
CompaniesModule
DiagnosesModule
SubsidiesModule
BusinessPlansModule
NotificationsModule
LeadsModule
AuditLogsModule
FilesModule
AiModule
QueueModule
IngestionModule
```

### 7.3 DB / ORM
- PostgreSQL。
- pgvector。
- UUID primary key。
- 金额 bigint，单位 JPY。
- 时间 timestamptz。
- 如果项目没有 ORM，建议使用 Prisma；如已有 TypeORM/Drizzle，不要混用第二套 ORM。
- pgvector index 可先延后，MVP 数据量小时可以线性查询或 text fallback。

### 7.4 LLM
- 生产目标：Amazon Bedrock Claude。
- 本地必须有 mock adapter，保证无 API key 也能跑 e2e。
- 所有 LLM 输出必须经过 zod schema 校验。
- 不明信息必须输出 `null` 或 `unknowns`，不能猜测。

### 7.5 数据源
- jGrants 公开 API 只读导入。
- 手工 seed 20〜50 个常见制度。
- 每条制度必须保存 source_url、content_hash、last_seen_at。
- 没有来源的数据不能在 UI 中伪装成最新。

---

## 8. 数据模型

> 下面是产品级数据模型。实现可使用 Prisma schema 或 SQL migration，但字段含义必须保留。

### 8.1 User
```ts
type User = {
  id: string;
  email: string;
  authProvider: 'email' | 'google' | 'line' | 'mock';
  displayName?: string | null;
  role: 'owner' | 'admin'; // Phase2 再扩展 expert
  createdAt: string;
};
```

### 8.2 Company
```ts
type Company = {
  id: string;
  userId: string;
  name?: string | null;
  url: string;
  jsicCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  employeesRange?: '1-5' | '6-20' | '21-50' | '51-100' | '101-300' | '301+' | 'unknown' | null;
  capitalRange?: string | null;
  businessPhase?: 'founding' | 'growth' | 'succession' | 'restructuring' | 'unknown' | null;
  profile: CompanyProfile;
  sourceCitations: SourceCitation[];
  analyzedAt?: string | null;
  createdAt: string;
};
```

### 8.3 CompanyProfile
```ts
type CompanyProfile = {
  companyName: string | null;
  prefecture: string | null;
  city: string | null;
  industryKeywords: string[];
  jsicCode: string | null;
  employeesRange: string | null;
  capitalRange: string | null;
  businessSummary: string;
  productsOrServices: string[];
  targetCustomers: string[];
  investmentIntent: Array<'販路開拓' | 'IT導入' | '設備投資' | '省力化' | '事業承継' | '海外展開' | '人材育成' | '研究開発'>;
  confidence: number; // 0〜1
  unknowns: string[];
  citations: SourceCitation[];
};

type SourceCitation = {
  url: string;
  title?: string | null;
  quote?: string | null;
  fetchedAt?: string;
};
```

### 8.4 SubsidyProgram / SubsidyRound
```ts
type SubsidyProgram = {
  id: string;
  name: string;
  issuer: string | null;
  issuerType: 'national' | 'prefecture' | 'city' | 'mhlw' | 'foundation' | 'other';
  overview: string | null;
  jsicTargets: string[];
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubsidyRound = {
  id: string;
  programId: string;
  roundLabel: string | null;
  status: 'upcoming' | 'open' | 'closed' | 'unknown';
  acceptStart: string | null;
  acceptEnd: string | null;
  maxLimit: number | null;
  subsidyRate: string | null;
  budget: number | null;
  adoptionRate: number | null;
  adoptionRateSource: string | null;
  jgrantsId: string | null;
  contentHash: string | null;
  lastSeenAt: string;
};
```

### 8.5 EligibilityRule
```ts
type EligibilityRule = {
  id: string;
  roundId: string;
  kind: 'hard' | 'soft';
  label: string;
  rule: JsonLogicRule;
};
```

JSONLogic example:

```json
{
  "and": [
    { "in": [{ "var": "company.prefecture" }, ["東京都", "大阪府", "京都府"]] },
    { "in": [{ "var": "round.status" }, ["open", "upcoming"]] }
  ]
}
```

### 8.6 Diagnosis
```ts
type Diagnosis = {
  id: string;
  userId: string;
  companyId: string;
  inputUrl: string;
  status: 'pending' | 'scraping' | 'extracting' | 'matching' | 'done' | 'failed';
  error?: string | null;
  matchCount?: number | null;
  totalLimit?: number | null;
  saved: boolean;
  startedAt: string;
  completedAt?: string | null;
};
```

### 8.7 DiagnosisMatch
```ts
type DiagnosisMatch = {
  id: string;
  diagnosisId: string;
  roundId: string;
  eligible: boolean;
  matchScore: number; // 0〜100，适合度，不是採択率
  reasons: MatchReason[];
  warnings: string[];
  rank: number;
};

type MatchReason = {
  type: 'fit' | 'risk' | 'unknown' | 'source';
  label: string;
  description: string;
  sourceUrl?: string | null;
};
```

### 8.8 BusinessPlan
```ts
type BusinessPlan = {
  id: string;
  userId: string;
  companyId: string;
  roundId: string;
  status: 'generating' | 'draft' | 'edited' | 'exported' | 'failed';
  model: string | null;
  targetChars: number;
  createdAt: string;
  updatedAt: string;
  sections: BusinessPlanSection[];
};

type BusinessPlanSection = {
  id: string;
  planId: string;
  chapterNo: number;
  heading: string;
  body: string;
  charCount: number;
  status: 'ai_draft' | 'needs_confirmation' | 'edited' | 'confirmed';
  sources: SourceCitation[];
  revision: number;
  updatedAt: string;
};
```

### 8.9 AuditLog
```ts
type AuditLog = {
  id: string;
  userId: string | null;
  companyId?: string | null;
  action:
    | 'diagnosis.created'
    | 'diagnosis.completed'
    | 'subsidy.viewed'
    | 'plan.created'
    | 'plan.section.edited'
    | 'plan.exported'
    | 'lead.expert_waitlist'
    | 'notification.scheduled';
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

---

## 9. API 需求

### 9.1 通用约定
- 所有 API 前缀：`/v1`。
- 需要认证的 API 使用 Bearer token。
- 返回时间使用 ISO 8601。
- 金额单位 JPY，整数。
- 错误格式统一：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容を確認してください",
    "details": {}
  }
}
```

### 9.2 Error Code
| code | 使用场景 |
|---|---|
| UNAUTHORIZED | 未登录 |
| FORBIDDEN | 无权访问资源 |
| VALIDATION_ERROR | URL、字段校验失败 |
| URL_NOT_ACCESSIBLE | URL 访问失败 |
| ROBOTS_DISALLOWED | robots 禁止 |
| EXTRACTION_FAILED | 正文抽取失败 |
| MATCHING_FAILED | 匹配失败 |
| LLM_TIMEOUT | LLM 超时 |
| NOT_FOUND | 资源不存在 |
| EXPORT_FAILED | 导出失败 |

### 9.3 POST /v1/diagnoses
创建诊断。

Request:
```json
{
  "url": "https://example.co.jp"
}
```

Validation:
- 必须是 http/https。
- 禁止 localhost、127.0.0.1、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16、metadata IP，防 SSRF。
- URL 长度 <= 2048。
- 同一用户 1 分钟最多 3 次。

Response:
```json
{
  "diagnosisId": "uuid",
  "companyId": "uuid",
  "status": "scraping"
}
```

### 9.4 GET /v1/diagnoses/{id}
Response:
```json
{
  "id": "uuid",
  "status": "matching",
  "inputUrl": "https://example.co.jp",
  "matchCount": null,
  "totalLimit": null,
  "company": {
    "id": "uuid",
    "name": "株式会社サンプル",
    "prefecture": "大阪府",
    "businessSummary": "..."
  },
  "startedAt": "2026-06-20T00:00:00+09:00",
  "completedAt": null
}
```

### 9.5 GET /v1/diagnoses/{id}/events
SSE。Content-Type: `text/event-stream`。

Event examples:

```txt
event: diagnosis.status
data: {"status":"scraping","label":"会社サイトを確認しています"}

event: diagnosis.progress
data: {"step":"extracting","progress":45,"message":"事業内容を整理しています"}

event: diagnosis.done
data: {"diagnosisId":"uuid","matchCount":4,"totalLimit":12500000}

event: diagnosis.error
data: {"code":"URL_NOT_ACCESSIBLE","message":"会社サイトを確認できませんでした"}
```

前端必须在断线时 fallback 到 `GET /v1/diagnoses/{id}` polling。

### 9.6 GET /v1/diagnoses/{id}/matches
Response:
```json
{
  "diagnosisId": "uuid",
  "company": {
    "name": "株式会社サンプル",
    "prefecture": "大阪府",
    "businessSummary": "...",
    "unknowns": ["従業員数", "資本金"]
  },
  "summary": {
    "matchCount": 4,
    "totalLimit": 12500000,
    "lastUpdatedAt": "2026-06-20T00:00:00+09:00"
  },
  "matches": [
    {
      "matchId": "uuid",
      "roundId": "uuid",
      "rank": 1,
      "programName": "小規模事業者持続化補助金",
      "roundLabel": "一般型",
      "issuer": "中小企業庁",
      "maxLimit": 2000000,
      "subsidyRate": "2/3",
      "acceptEnd": "2026-07-31T23:59:59+09:00",
      "daysLeft": 41,
      "matchScore": 86,
      "adoptionRate": null,
      "adoptionRateSource": null,
      "adoptionRateLabel": "公開された採択率データは未確認です",
      "reasons": [
        {
          "type": "fit",
          "label": "販路開拓に該当する可能性",
          "description": "会社サイトにEC販売と新規集客の記載があります。"
        }
      ],
      "warnings": ["従業員数の確認が必要です"],
      "lastSeenAt": "2026-06-20T00:00:00+09:00"
    }
  ]
}
```

### 9.7 GET /v1/subsidies/rounds/{id}
Response:
```json
{
  "roundId": "uuid",
  "program": {
    "id": "uuid",
    "name": "小規模事業者持続化補助金",
    "issuer": "中小企業庁",
    "issuerType": "national",
    "overview": "...",
    "sourceUrl": "https://..."
  },
  "roundLabel": "一般型",
  "status": "open",
  "acceptStart": "2026-06-01T00:00:00+09:00",
  "acceptEnd": "2026-07-31T23:59:59+09:00",
  "daysLeft": 41,
  "maxLimit": 2000000,
  "subsidyRate": "2/3",
  "adoptionRate": null,
  "adoptionRateSource": null,
  "lastSeenAt": "2026-06-20T00:00:00+09:00",
  "requirements": [
    {
      "kind": "hard",
      "label": "対象地域",
      "result": "needs_confirmation",
      "description": "所在地の確認が必要です。"
    }
  ],
  "requiredDocuments": [
    {
      "label": "事業計画書",
      "aiDraftable": true,
      "checked": false
    },
    {
      "label": "直近の決算書",
      "aiDraftable": false,
      "checked": false
    }
  ],
  "steps": [
    "公募要領を確認",
    "必要書類を準備",
    "事業計画書の下書きを作成",
    "公式サイトで申請手続きを確認"
  ]
}
```

### 9.8 POST /v1/business-plans
Request:
```json
{
  "companyId": "uuid",
  "roundId": "uuid",
  "targetChars": 4200
}
```

Response:
```json
{
  "planId": "uuid",
  "status": "generating"
}
```

### 9.9 GET /v1/business-plans/{id}/events
SSE events:

```txt
event: plan.section.started
data: {"chapterNo":1,"heading":"事業概要"}

event: plan.section.delta
data: {"chapterNo":1,"delta":"当社は..."}

event: plan.section.completed
data: {"chapterNo":1,"status":"ai_draft","charCount":720}

event: plan.completed
data: {"planId":"uuid","status":"draft"}
```

### 9.10 PATCH /v1/business-plans/{id}/sections/{chapterNo}
Request:
```json
{
  "body": "編集後の本文...",
  "status": "edited"
}
```

Response:
```json
{
  "chapterNo": 1,
  "status": "edited",
  "revision": 2,
  "updatedAt": "2026-06-20T00:00:00+09:00"
}
```

### 9.11 POST /v1/business-plans/{id}/export
Request:
```json
{
  "format": "docx"
}
```

Response:
```json
{
  "fileUrl": "https://signed-url.example",
  "expiresAt": "2026-06-20T01:00:00+09:00",
  "disclaimerIncluded": true
}
```

必须：
- 导出前检查所有 section 状态。
- 如果存在 `needs_confirmation`，展示确认 modal，但仍允许导出。
- 导出的页脚必须包含免责声明。

### 9.12 POST /v1/leads/expert
仅记录意向。

Request:
```json
{
  "diagnosisId": "uuid",
  "roundId": "uuid",
  "message": "専門家相談が始まったら知らせてください"
}
```

Response:
```json
{
  "ok": true,
  "status": "waitlisted"
}
```

UI 文案：

```txt
専門家相談は近日公開予定です。開始時にお知らせします。
```

---

## 10. 诊断流程需求

### 10.1 状态机
```txt
pending
  → scraping
  → extracting
  → matching
  → done

任意状态 → failed
```

### 10.2 Step 1: URL 抓取
要求：
- 使用 Playwright 或 fetch + Readability，视站点复杂度决定。
- 遵守 robots.txt。
- 明确 User-Agent，例如：`SubsidyPocketBot/0.1 (+contact)`。
- 最多抓取 5 个页面：首页、会社概要、事業内容、サービス、導入事例/実績。
- 每个页面超时 8 秒。
- 总超时 15 秒以内进入 fallback。
- 保存原始文本到 storage，保存引用 URL。

禁止：
- 第三方批量爬取。
- 抓取登录后页面。
- 绕过 robots。
- 访问内网地址。

### 10.3 Step 2: 正文抽取
输出 markdown 或纯文本：

```ts
type ExtractedPage = {
  url: string;
  title: string | null;
  text: string;
  fetchedAt: string;
  statusCode: number;
};
```

如果所有页面正文总长度 < 300 字，则进入 `partial_success`：允许继续，但公司画像 confidence 较低。

### 10.4 Step 3: 公司画像结构化
LLM Prompt 必须包含以下规则：

```txt
あなたは日本の中小企業情報を整理するアシスタントです。
与えられたWebページ本文だけを根拠に、会社プロフィールをJSONで抽出してください。
推測は禁止です。不明な項目は null にし、unknowns に入れてください。
各判断には可能な範囲で citations を付けてください。
補助金の採択可能性や法的助言は出さないでください。
```

Schema 必须匹配 `CompanyProfile`。

### 10.5 Step 4: 制度候选粗筛
MVP 可按阶段实现：

Phase A:
```txt
Postgres full-text / keyword match
```

Phase B:
```txt
pgvector embedding similarity
```

粗筛目标：取 20〜50 个候选。

### 10.6 Step 5: Hard Rule 判定
Hard rule 包括但不限于：
- status = open / upcoming。
- 截止未过。
- 地域条件。
- 業種条件。
- 従業員規模。
- 法人 / 個人事業主条件。

规则：
- hard 不通过的制度不进入推荐 top 3〜5。
- 但可以记录在内部 debug，不展示给用户。
- 如果字段 unknown，结果为 `needs_confirmation`，不能当作 pass，也不能当作 fail；根据制度风险决定是否展示 warning。

### 10.7 Step 6: Soft Score
Soft score 是适合度，不是採択率。

建议权重：

```txt
业务相关性 35
投资意图相关性 25
地域/规模确定性 15
截止余裕 10
资料准备度 10
来源可信度 5
```

输出 `matchScore: 0〜100`。

### 10.8 推荐结果数量
- 默认展示 3〜5 个。
- 如果只有 1〜2 个合格，也可以展示，但要提示：

```txt
確認できた制度は少なめです。会社情報を補足すると候補が増える可能性があります。
```

- 如果 0 个：展示空状态，引导补充公司画像，而不是夸大推荐。

---

## 11. 事业计划书起草支援需求

### 11.1 定位
计划书功能叫：

```txt
事業計画書の下書き
```

不要叫：

```txt
申請書作成
完成版作成
AI代理作成
```

### 11.2 章节模板
MVP 默认章节：

```txt
1. 事業概要
2. 現状の課題
3. 補助事業の内容
4. 実施体制・スケジュール
5. 期待される効果
6. 収支計画・費用内訳
7. 確認が必要な項目
```

不同制度可通过 YAML 模板覆盖：

```yaml
program_key: jizokuka_general
name: 小規模事業者持続化補助金 一般型
sections:
  - chapter_no: 1
    heading: 事業概要
    target_chars: 600
    required_inputs:
      - company.businessSummary
  - chapter_no: 2
    heading: 販路開拓の課題
    target_chars: 700
    required_inputs:
      - company.targetCustomers
      - company.investmentIntent
```

### 11.3 生成规则
LLM Prompt 必须包含：

```txt
これは申請者本人の下書き作成支援です。
完成版・提出用書類として断定しないでください。
入力情報と制度情報だけを根拠にしてください。
不明な数値・固有名・実績は作らず、要確認として明示してください。
各章に status を付けてください: ai_draft / needs_confirmation。
```

### 11.4 Section 状态
| status | 含义 | UI 表示 |
|---|---|---|
| ai_draft | AI 草稿，用户未编辑 | AI下書き |
| needs_confirmation | 有不明或假设，需要本人确认 | 要確認 |
| edited | 用户已编辑 | 本人編集済み |
| confirmed | 用户明确确认 | 確認済み |

### 11.5 计划书编辑器
必须支持：
- 章节列表。
- 点击章节进入编辑。
- 自动保存或保存按钮。
- 显示字数。
- 显示状态 badge。
- 显示来源 / 要确认项。
- 导出前提示未确认项目。

### 11.6 导出
格式：
- docx。
- PDF。

导出内容：
- 标题。
- 制度名。
- 公司名。
- 生成日期。
- 各章节正文。
- 要确认项目列表。
- 页脚免责声明。

页脚：

```txt
本書はAIによる下書き素案であり、最終的な内容確認・作成・提出は申請者ご本人（または正式に受任した専門家）が行ってください。
```

---

## 12. 画面规格

### 12.1 Login Screen
Route: `/(auth)/login`

目的：用户进入 App。

UI：
- Logo / product name。
- 主文案：

```txt
自社に合う補助金を、まずは3分で確認。
```

- 登录按钮：

```txt
メールで始める
Googleで続ける
LINEで続ける
```

MVP 本地开发：可以提供 `開発用ログイン`。

验收：登录后进入 `診断` Tab。

### 12.2 Diagnosis Home
Route: `/(tabs)/diagnose/index`

目的：输入公司 URL，开始诊断。

UI 必须包含：
- URL 输入框。
- 开始按钮：`診断を始める`。
- 最近诊断履历。
- 简短说明：

```txt
会社サイトの公開情報をもとに、補助金候補と準備項目を整理します。
```

- 同意说明：

```txt
入力されたURLの公開ページを確認します。ログインが必要なページや第三者サイトの一括取得は行いません。
```

Validation：
- 空 URL：`会社URLを入力してください`。
- 非 URL：`URLの形式を確認してください`。
- 内网 URL：`このURLは診断に利用できません`。

### 12.3 Diagnosis Progress
Route: `/diagnoses/[id]/progress`

目的：展示诊断过程，降低等待焦虑。

步骤：

```txt
1. 会社サイトを確認
2. 事業内容を整理
3. 補助金制度と照合
```

每步状态：pending / active / done / error。

SSE 断线：显示 `接続を確認しています...`，并用 polling。

完成后自动跳转 `/diagnoses/[id]/results`，也可显示按钮：`結果を見る`。

### 12.4 Diagnosis Results
Route: `/diagnoses/[id]/results`

目的：展示 top 3〜5 制度。

Header：
- 公司名或 URL。
- `確認できた候補: N件`。
- `補助上限合計: ¥X`，如果无法计算则不显示。

Company profile card：
- 业务摘要。
- 所在地。
- 行业关键词。
- unknowns。
- 编辑按钮：`会社情報を補足する`。

Match card：
- 制度名。
- issuing organization。
- 上限金额。
- 补助率。
- 截止与剩余天数。
- 适合度 badge：`適合度 86`。
- 採択率：只有有 source 才显示。
- 理由 1〜3 条。
- warning。
- CTA：`詳細を見る`。

禁止：显示 `あなたの採択率`。

空状态：

```txt
条件に合う候補を確認できませんでした。
会社情報を補足すると、候補が見つかる可能性があります。
```

### 12.5 Subsidy Detail
Route: `/subsidies/[roundId]`

目的：帮助用户判断是否继续准备。

Sections：
1. Summary：上限、补助率、截止、状态。
2. Why fit：推荐理由。
3. Requirements：hard / soft / needs confirmation。
4. Required documents checklist。
5. Preparation steps。
6. Source：source_url、last_seen_at。
7. CTA：`下書きを作成する`。
8. Secondary CTA：`専門家相談の開始通知を受け取る`。

按钮禁止叫：`申請する`。

### 12.6 Business Plan Generating
Route: `/business-plans/[planId]/generating`

目的：流式生成章节。

UI：
- 章节生成列表。
- 当前章节流式文本 preview。
- 免责声明短版。

失败：
- `もう一度作成する`。
- 保留已生成章节。

### 12.7 Business Plan Editor
Route: `/business-plans/[planId]`

目的：本人编辑计划书草稿。

UI：
- 顶部：制度名、公司名、状态。
- 免责声明短版。
- 章节列表。
- 编辑区域。
- status badge。
- 保存按钮。
- 确认按钮：`この章を確認済みにする`。
- 导出按钮：`docxで出力` / `PDFで出力`。

导出前 modal：

```txt
未確認の項目があります
この下書きには、本人確認が必要な項目が含まれています。内容を確認したうえで出力してください。
```

### 12.8 Applications Preparation Tab
Route: `/(tabs)/applications/index`

Label: `申請準備`

目的：不是提交，而是准备管理。

内容：
- 保存的诊断。
- 生成过的计划书。
- 截止提醒。
- 未完成 checklist。

空状态：

```txt
まだ準備中の補助金はありません。
診断から候補を確認しましょう。
```

### 12.9 Messages Tab
Route: `/(tabs)/messages/index`

Phase 1 只做占位。

文案：

```txt
専門家相談は近日公開予定です
補助金候補と下書きが整った状態で、専門家に相談できる機能を準備中です。
```

CTA：`開始時に通知を受け取る`。

调用 `POST /v1/leads/expert`。

### 12.10 My Page
Route: `/(tabs)/my/index`

功能：
- 用户信息。
- 公司画像。
- 诊断履历。
- 通知设置。
- 数据与隐私。
- 退出登录。

### 12.11 Company Profile Editor
Route: `/companies/[companyId]/edit`

目的：用户补充 unknowns，提高匹配质量。

字段：
- 会社名。
- 所在地。
- 従業員数 range。
- 資本金 range。
- 事業内容。
- 投資予定。

保存后可重新诊断。

---

## 13. 通知需求

### 13.1 通知类型
| type | 触发 | 文案 |
|---|---|---|
| diagnosis_done | 诊断完成 | 診断結果が表示できるようになりました |
| deadline_30d | 截止 30 天前 | 締切まで30日です。準備項目を確認しましょう |
| deadline_7d | 截止 7 天前 | 締切まで7日です。必要書類を確認してください |
| plan_draft_ready | 草稿生成完成 | 下書きが作成されました。内容を確認してください |
| expert_waitlist | 专家咨询开放时 | 専門家相談機能が利用できるようになりました |

### 13.2 通知设置
用户可以选择：
- push on/off。
- email on/off。
- deadline reminder on/off。

本地开发可以只写入 DB，不真实发送。

---

## 14. ETL / 制度数据需求

### 14.1 数据导入目标
MVP 必须能跑：

```txt
npm run etl:jgrants
```

执行结果：
- 获取 read-only list/detail 或使用 fixture。
- 写入 subsidy_programs。
- 写入 subsidy_rounds。
- 写入 source_records。
- 写入 ingestion_runs。
- content_hash 未变化时不重复更新。

### 14.2 手工 seed
必须提供 `infra/db/seeds/subsidies.seed.ts` 或等价 fixture。

至少包含 5 个制度样例：
- 小規模事業者持続化補助金。
- ものづくり補助金。
- IT導入補助金。
- 事業承継・M&A補助金。
- 中小企業省力化投資補助金。

这些 seed 仅用于开发和测试，UI 要显示 `last_seen_at`，不要伪装成实时数据。

### 14.3 Provenance
每条制度必须可追踪：

```txt
source
external_id
source_url
content_hash
raw_ref
fetched_at
last_seen_at
```

UI detail 页必须展示：

```txt
最終確認: YYYY/MM/DD
出典: 公式ページ
```

---

## 15. 文件导出需求

### 15.1 docx
推荐库：
- Node: `docx`。
- 或 service 内使用模板引擎。

必须包含：
- 标题。
- 制度名。
- 公司名。
- 章节。
- 要确认事项。
- 免责声明页脚。

### 15.2 PDF
可选实现：
- Playwright HTML to PDF。
- 或 docx 转 PDF。

MVP 接受 Playwright HTML to PDF。

PDF 样式必须：
- 不拥挤。
- 标题清楚。
- 页脚免责声明每页出现。
- 使用设计系统里的 typography token 或导出专用简洁样式。

---

## 16. 安全与隐私

### 16.1 SSRF 防护
URL 诊断必须防：
- localhost。
- private IP。
- link-local。
- cloud metadata。
- file://。
- ftp://。

### 16.2 访问控制
- 用户只能访问自己的 company / diagnosis / plan。
- 所有 `{id}` 查询必须校验 user_id。
- Phase 2 前不要创建 expert 可访问用户数据的逻辑。

### 16.3 数据保存
- S3 / MinIO 保存导出文件。
- 签名 URL 短有效期，建议 15 分钟。
- Audit log append-only。

### 16.4 机密信息
- `.env.example` 可以提交。
- `.env` 不提交。
- 不在日志里输出 token、完整 prompt、用户敏感输入。

### 16.5 robots 与抓取同意
URL 诊断前必须有同意 checkbox 或说明：

```txt
会社サイトの公開ページを確認することに同意します。
```

如果设计系统不适合 checkbox，可用说明 + 开始按钮，但必须有明确提示。

---

## 17. Analytics / KPI

### 17.1 Event names
前端和后端都应记录关键事件：

```txt
auth.login
home.url_submitted
diagnosis.started
diagnosis.completed
diagnosis.failed
matches.viewed
subsidy.detail_viewed
company_profile.edited
business_plan.started
business_plan.completed
business_plan.section_edited
business_plan.exported
notification.setting_changed
expert_waitlist.submitted
```

### 17.2 MVP KPI
- URL 投入 → 结果显示完成率。
- 结果页 → 详情页点击率。
- 详情页 → 下書き生成率。
- 下書き生成 → 本人编辑率。
- docx/PDF 导出率。
- 专家咨询 waitlist 点击率。
- 7 日 / 30 日再访问。

---

## 18. 测试要求

### 18.1 Unit Tests
必须覆盖：
- URL validation / SSRF block。
- daysLeft 计算。
- JSONLogic hard rule。
- matchScore 排序。
- adoptionRate 无 source 时不显示。
- section status transitions。
- forbidden copy scanner。

### 18.2 Integration Tests
必须覆盖：
- `POST /v1/diagnoses` 创建 job。
- diagnosis worker mock 完整跑完。
- `GET /matches` 只返回 eligible true。
- `POST /business-plans` 生成 mock sections。
- `PATCH section` revision +1。
- `POST export` 生成文件并包含免责声明。

### 18.3 E2E Tests
建议使用 Playwright 或 Detox：

```txt
登录
→ 输入 URL
→ 诊断进度
→ 结果列表
→ 详情
→ 生成下書き
→ 编辑章节
→ 导出
```

### 18.4 Legal Copy Test
实现脚本：

```txt
npm run test:legal-copy
```

扫描目录：

```txt
apps/mobile
apps/api
workers
packages/prompts
packages/ui
docs/templates
```

禁止词初始列表：

```txt
AIが申請書を作成
AIが申請
自動提出
代理申請できます
採択率が上がります
あなたの採択率
89%
68%
+21pt
完成版の事業計画書
```

注意：有些词可能出现在本需求文档的禁止列表中，测试脚本应允许 `docs/` 中的 whitelist，或只扫描产品代码。

### 18.5 Performance Acceptance
- URL 诊断：本地 mock 5 秒内，生产目标 15 秒内给 3〜5 个候选。
- 首屏：移动端 2 秒内显示可交互 UI。
- 计划书：section streaming 首个 chunk 3 秒内出现，mock 模式 1 秒内。

---

## 19. 环境变量

`.env.example` 必须包含：

```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/subsidy_pocket
REDIS_URL=redis://localhost:6379
STORAGE_DRIVER=local # local|minio|s3
S3_BUCKET=subsidy-pocket-dev
S3_REGION=ap-northeast-1
MINIO_ENDPOINT=http://localhost:9000
AUTH_MODE=mock # mock|supabase|auth0|cognito
LLM_PROVIDER=mock # mock|bedrock
BEDROCK_REGION=ap-northeast-1
JGRANTS_MODE=fixture # fixture|api
JGRANTS_BASE_URL=
PUBLIC_APP_ENV=development
```

---

## 20. Milestone / Issue 拆解

### Milestone 0: 项目启动与边界固定
Issue 001: Bootstrap repo / inspect existing structure  
DoD:
- 能运行 package manager install。
- 确认 apps/mobile、apps/api 或适配现有目录。
- 创建 `docs/implementation-notes.md`。

Issue 002: Add legal guardrail docs and copy scanner  
DoD:
- `packages/legal-copy-guard` 或脚本存在。
- `npm run test:legal-copy` 可运行。
- 扫描前端与 prompt。

Issue 003: Wire design-system adapter  
DoD:
- Codex 已读取 `design-system/`。
- 基础组件统一从设计系统导入。
- 没有设计系统时记录 TODO，不写散乱样式。

### Milestone 1: 基础设施
Issue 004: Docker Compose local infra  
DoD:
- Postgres + pgvector。
- Redis。
- MinIO or local storage。
- 一条命令启动。

Issue 005: DB migrations  
DoD:
- users / companies / subsidy_programs / subsidy_rounds / eligibility_rules / required_documents / diagnoses / diagnosis_matches / business_plans / sections / notifications / audit_logs / ingestion_runs / source_records。
- seed 可运行。

Issue 006: API skeleton  
DoD:
- NestJS health check。
- Mock auth guard。
- Error format middleware。

### Milestone 2: 制度数据
Issue 007: Subsidy seed fixtures  
DoD:
- 至少 5 个开发制度。
- 每个有 source_url / last_seen_at。
- 有 hard / soft rules。

Issue 008: jGrants ETL adapter  
DoD:
- fixture mode。
- api mode 接口预留。
- ingestion_runs / source_records 写入。
- content_hash 去重。

### Milestone 3: 诊断后端
Issue 009: URL validation and scraping service  
DoD:
- SSRF 防护测试通过。
- robots 检查。
- 抽取最多 5 页。

Issue 010: Company extraction mock + schema  
DoD:
- Mock LLM 返回 CompanyProfile。
- zod 校验。
- unknowns 不为空时 UI 能展示。

Issue 011: Matching engine  
DoD:
- hard rule。
- soft score。
- only eligible top 3〜5。
- golden tests。

Issue 012: Diagnosis API + SSE  
DoD:
- POST diagnoses。
- GET status。
- GET events。
- GET matches。

### Milestone 4: 移动端诊断体验
Issue 013: Auth and tab shell  
DoD:
- Login。
- Bottom tabs: 診断 / 申請準備 / メッセージ / マイ。
- safe-area。

Issue 014: Diagnosis home  
DoD:
- URL input。
- validation。
- recent diagnoses。
- consent text。

Issue 015: Diagnosis progress  
DoD:
- SSE 进度。
- polling fallback。
- error / retry。

Issue 016: Diagnosis result list  
DoD:
- top matches。
- company profile。
- reasons / warnings。
- no individual adoption rate。

Issue 017: Subsidy detail  
DoD:
- requirements。
- checklist。
- source / last_seen_at。
- CTA to draft。

### Milestone 5: 计划书
Issue 018: Business plan API  
DoD:
- POST plan。
- GET plan。
- GET events。
- PATCH section。

Issue 019: Plan generation mock / Bedrock adapter  
DoD:
- mock streaming。
- schema validation。
- section statuses。

Issue 020: Plan editor UI  
DoD:
- sections。
- edit。
- save。
- confirm。
- status badge。

Issue 021: Export docx/PDF  
DoD:
- docx export。
- PDF export。
- signed URL / local file URL。
- disclaimer footer test。

### Milestone 6: 我的页、通知、waitlist
Issue 022: Applications preparation tab  
DoD:
- saved diagnoses。
- plans。
- deadlines。

Issue 023: My page and company editor  
DoD:
- profile display。
- edit fields。
- rerun diagnosis CTA。

Issue 024: Notification settings and scheduler  
DoD:
- settings API。
- scheduled notification records。
- mock sender。

Issue 025: Expert waitlist placeholder  
DoD:
- messages tab placeholder。
- POST leads/expert。
- no chat, no payment。

### Milestone 7: QA / Beta ready
Issue 026: E2E happy path  
DoD:
- login → diagnosis → result → detail → plan → edit → export。

Issue 027: Edge cases  
DoD:
- invalid URL。
- robots disallowed。
- no matches。
- LLM timeout。
- export failed。

Issue 028: Beta logging dashboard basic  
DoD:
- KPI events visible in DB or simple admin endpoint。

---

## 21. 验收标准

### 21.1 Product Acceptance
- 用户能在移动端输入 URL 并启动诊断。
- 诊断过程有明确 3-step 进度。
- 诊断完成后显示 3〜5 个候选，或合理空状态。
- 每个候选显示理由、warning、截止、上限、补助率、来源。
- 详情页显示要件和必要书类。
- 用户能生成计划书下書き。
- 用户能编辑章节并保存。
- 用户能导出 docx / PDF。
- 导出文件包含免责声明。
- 专家相关功能仅 waitlist。

### 21.2 Compliance Acceptance
- 产品代码没有禁止文案。
- UI 不出现公司个别採択率预测。
- UI 不出现 `提出する` 作为平台功能按钮。
- 计划书所有入口都标注下書き支援。
- docx/PDF 有免责声明。
- jGrants 相关只读，无提交逻辑。

### 21.3 Technical Acceptance
- `npm install` / `pnpm install` 成功。
- `docker compose up` 成功。
- DB migration 成功。
- seed 成功。
- API tests 通过。
- mobile app 能连接本地 API。
- mock LLM 下全流程可运行。

---

## 22. 本地运行目标命令

具体命令可根据仓库包管理器调整，但最终 README 必须提供等价命令：

```bash
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev:api
pnpm dev:mobile
pnpm test
pnpm test:legal-copy
```

---

## 23. README 必须包含

Codex 最终要更新或创建 README：

```txt
项目简介
Phase 1 范围
不能做的事
本地启动方法
环境变量
测试方法
Mock LLM / fixture mode 说明
目录结构
主要 API
设计系统使用方式
```

---

## 24. 未来 Phase 2 预留，但不实现

代码层面可预留接口或 enum，但不要实现业务逻辑：

```ts
type FutureRole = 'expert';
type FutureEngagementStatus = 'requested' | 'accepted' | 'in_review' | 'submitted' | 'adopted' | 'rejected';
interface SubmissionAdapter {
  // Do not implement in Phase 1.
}
```

数据库可以预留 role 字段，但不要创建完整 payments / chat / engagement 流程，除非明确后续 issue 要求。

---

## 25. 最重要的实现原则

```txt
先做可跑通的纵向切片，不要做大而全。
先用 mock LLM + seed 数据跑通，再接真实 Bedrock / jGrants。
先保证合规边界，再追求转化率。
先复用设计系统，再补组件。
每个结果必须有来源，每个草稿必须可编辑，每个导出必须有免责声明。
```

