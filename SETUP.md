# 本地安装与配置

本说明适用于当前的 Node / Codex / LinkedIn + Official Careers 版本。

## 1. 本机环境

检查现有工具：

```bash
node --version
npm --version
python3 --version
codex --version
```

最低要求是 Node.js 22.18+ 和 Python 3.10+。两个搜索 CLI 都没有第三方依赖，
因此无需 `npm install`，也无需 Bun。

如果缺少 Node，Ubuntu/WSL 推荐通过你信任的 Node 版本管理器安装当前 LTS。
Codex 的安装和登录按 OpenAI 官方文档完成；Claude Code 或其他代理是可选项。

## 2. Fork and clone

当前机器已完成本地克隆。其他机器可运行：

```bash
gh repo fork MadsLorentzen/ai-job-search --clone
```

注意：public 项目的 GitHub fork 是 public；personal data 的工作实例已 gitignore，
不随提交上传；
通用模板保存在 `.claude/profile-templates/`，用 `npm run profile:init` 初始化缺失文件。私有远程配置见 [section 8](#8-私有远程仓库建议)。

## 3. 验证本地副本

```bash
cd /home/cesko/projects/ai-job-search
npm run profile:init
npm test
npm run jobs:help
npm run careers:help
npm run jobs -- search -q "software engineer" -l "Tokyo, Japan" --dry-run
npm run careers -- search --group target -q "AI Engineer" -l "Tokyo, Japan" --dry-run
```

最后两条只构造请求计划，不访问外部网站。公司官网命令需要 `target` 组已有雇主；
初始为空时会安全失败并提示配置注册表。

## 4. 可选的 PDF 工具

只有生成正式 CV 和求职信时才需要 LaTeX：

```bash
sudo apt update
sudo apt install texlive-luatex texlive-xetex texlive-latex-extra texlive-fonts-extra
```

本机也可使用仓库内的 TeX Live（当前安装在 `.texlive/`，不会写入系统目录）。申请
工作流会通过 `tools/run_tex.sh` 自动优先复用它，无需每次导出 PATH，也不要为每份
申请在 `/tmp` 重装后删除：

```bash
tools/run_tex.sh lualatex --version
tools/run_tex.sh xelatex --version
```

`AI_JOB_SEARCH_TEX_BIN=/path/to/texlive/bin/<platform>` 可显式覆盖工具目录；若仓库内
没有 `.texlive/`，包装器会回退到 PATH 上已有的引擎。它不会自动联网安装依赖。

ATS 文本层检查可任选一个：

```bash
uv venv .venv
uv pip install --python .venv/bin/python pypdf
# 或
sudo apt install poppler-utils
```

未安装这些可选工具时，搜索、档案整理和纯文本草稿仍可使用。

## 5. 初始化候选人资料

把资料放到 `documents/` 对应子目录：

- `documents/cv/`
- `documents/linkedin/`
- `documents/diplomas/`
- `documents/references/`
- `documents/applications/`

然后启动 Codex：

```bash
cd /home/cesko/projects/ai-job-search
codex
```

输入：

```text
使用 $job-search-workflow，读取 documents/ 并初始化我的候选人资料。
```

没有现成资料时，要求它使用访谈模式。修改前应先展示发现的冲突和拟议变更。

> 这些资料可能包含姓名、联系方式、经历与薪资预期。不要将个性化后的文件推送到
> 公开 GitHub fork。建议使用私有仓库，并保留当前 `upstream` 仅用于拉取上游更新。

## 6. 日常使用

启动代理：

```bash
cd /home/cesko/projects/ai-job-search
codex
```

主要入口是 `$job-search-workflow`。示例：

```text
使用 $job-search-workflow，按我的资料搜索东京的 AI engineer 职位，先只展示查询计划，不联网。
```

```text
使用 $job-search-workflow，评估下面这份 LinkedIn 职位正文；不要投递，只生成本地草稿。
```

直接调用两个搜索 CLI 的命令见 [README.md](README.md#搜索-cli)。

公司官网雇主注册表在 `.agents/skills/company-careers/data/companies.json`。只登记已
核验的企业官方招聘页，并保持 `employer_type: "direct"`；猎头、人才中介、RPO 和
匿名客户页面不得加入 `target` 组。

## 7. 外部操作规则

以下动作必须在执行前获得当次明确同意：

- 实时访问 LinkedIn 搜索或详情页
- 提交职位申请
- 发送 LinkedIn 消息、邮件或跟进信
- 上传 CV、求职信或任何个人文件
- 向 Notion、Gmail、GitHub 或其他服务写入数据
- 调用可能收费的 API

仓库自带的 CI 和 upstream-watch 都只接受手动触发；不会因 push、PR 或定时计划
自动消耗 GitHub Actions 配额，也不会自动创建 GitHub issue。

生成本地材料不等于提交申请。只有用户确认真实提交后，才能把追踪状态从
`drafted` 改成 `applied`。

### 停止与恢复

- CLI 搜索完成后自动退出。
- 当前命令：`Ctrl+C` 中止。
- Codex 会话：输入 `exit` 或按 `Ctrl+D`。
- 没有后台 daemon、定时任务或浏览器自动化需要额外停止。
- 下次进入同一目录重新运行 `codex` 即可恢复日常使用。

## 8. 私有远程仓库建议

不要把含个人资料的提交推到公开 fork。可在 GitHub 新建一个空的 private 仓库，
然后把它作为 `origin`，把原项目保留为 `upstream`：

```bash
git remote rename origin upstream
git remote add origin git@github.com:<你的账号>/<你的私有仓库>.git
git push -u origin codex-node-linkedin
```

运行 `git remote -v` 核对目标后再推送。本地副本不要求配置远程即可使用。

## 9. 后续添加其他网站

新增独立站点时，通过自然语言让代理遵循 `.claude/commands/add-portal.md`；常见
ATS 优先扩展 `.agents/skills/company-careers/`，其他站点以 `linkedin-search` 为
模板。使用 Node 原生运行时并先实现 dry-run、解析和离线测试。公司官网投递适配器
必须把“搜索/解析”和“提交/上传”拆开，提交端
默认关闭，并设置明确的逐次确认。

## 本地个人档案

候选人资料及搜索偏好使用被忽略的本地实例。`npm run profile:init` 只复制
缺失文件，不覆盖已填写资料。通用模板在 `.claude/profile-templates/`，
禁止把个人信息填进这个版本化目录。换机时先初始化工作区，再从自己的备份
恢复个人实例；Git 远程只保存功能和空白模板。
