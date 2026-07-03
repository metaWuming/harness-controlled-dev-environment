---
title: ADOPTION — 導入 checklist
type: guide
---

# 導入 Checklist(Use this template 之後做這些)

> 按順序走完,每項都很小。全部做完,你的 repo 第一天就有完整防護欄。

## 1. 基本識別

- [ ] `LICENSE`:確認 MIT 條款的著作權人改成你(或依需要換 license)
- [ ] `README.md`:改寫成你的專案說明(本模板的 README 是模板自述,不是你的專案自述)
- [ ] `package.json`:`name` / `description` 改成你的專案
- [ ] `CLAUDE.md`:全文搜尋「Owner」→ 換成你的名字(或保留通用稱呼);
      Part 2「輸出格式」的語言依你的偏好調整

## 2. CLAUDE.md Part 4(技術上下文)

- [ ] §4.1 技術堆疊:填你的框架 / 語言 / DB / 部署平台
- [ ] §4.2 Design System:填設計 token 來源(純後端專案直接刪本節)
- [ ] §4.3 Health Stack:對齊你實際的品質閘門指令
- [ ] §4.4 部署資訊:staging / production
- [ ] §4.5 禁區清單:列出 AI 不可擅動的檔案(schema、策略文件、destructive scripts…)
- [ ] §4.6 Git 規範:填分支策略與合併策略

## 3. 安全敏感域路徑表(Step 4.5 安全關的前置)

- [ ] `scripts/cso-trigger.config.ts`:把你專案的安全敏感路徑填進五域
      (金流 / 個資 / 權限·IDOR·資產轉移 / audit-trail / 橫切保守項)+ 前台敏感進入點
- [ ] 填完後到 `tests/` 對應測試檔,把「路徑表完整性鎖」測試(註解掉的範本)啟用——
      它斷言每條 pattern 對得到 repo 真實檔案,防路徑表隨重構漂移
- [ ] 之後**每次新增安全敏感模組,同步更新路徑表**(machine 判定是下限不是上限)

## 4. 本機 git hooks

- [ ] `npm run setup-hooks`(設 `core.hooksPath`,一次即可,clone 的每個人都要跑)
- [ ] 檢查 `scripts/git-hooks/pre-commit` 的保護分支清單(預設 main/develop)符合你的分支策略
- [ ] 有「PR-only 的策略文件」→ 填進 pre-commit 的 `PROTECTED_DOCS`
- [ ] (建議)本機裝 gitleaks(`brew install gitleaks`),pre-push 會自動用;沒裝會提示放行

## 5. destructive 腳本守衛

- [ ] `scripts/lib/destructive-guard.ts` 頂部常數:`FLAG_ENV` / `CONFIRM_TOKEN` 改成你的專案名
      (例:`MYAPP_DESTRUCTIVE_OK` / `--confirm=MYAPP-PROD`)
- [ ] 之後所有 wipe / cleanup 類腳本都 require 這個 guard

## 6. CI

- [ ] `.github/workflows/ci.yml`:分支清單對齊你的策略;
      GitHub repo 設 branch protection(主線要求 CI pass)
- [ ] 用 Next.js+Prisma → 照 `stack/nextjs-prisma/README.md` 把 L2 層裝上
      (ESLint AST 規則 + migration 守衛 + CI 片段)
- [ ] `Source-term scan` step:本模板用它防「來源專案識別詞」殘留。
      你不需要 → 刪 step + `scripts/deny-terms.txt` + `scripts/check-no-source-terms.sh`;
      你也從自家私有專案抽模板 → 把 deny-terms.txt 換成你家的識別詞
- [ ] `.gitleaks.toml`:保持空 allowlist;掃到誤報才按「值」精準放行(見檔內原則)

## 7. 記憶層啟用

- [ ] `.claude/memory/progress.md`:第一個 sprint 收尾時寫第一條 entry(格式照檔內模板)
- [ ] `.claude/memory/LESSONS.md`:第一次踩雷時開始累積
- [ ] `TODOS.md`:把你的 backlog 填進 P1/P2/P3 分級(完成宣稱要引用 PR 號,CI 會驗)

## 8. 週健檢(可選但建議)

- [ ] `npm run health:weekly` 跑一次確認輸出正常(報告在 `.claude/memory/health-history/`)
- [ ] 按需擴充 collector(檔內有 TODO 標記點):DB 指標、deadcode、錯誤監控……
- [ ] 排進你的週例行(手動跑或 cron)

## 9. 外部工具(全部 optional)

本 harness 的 SOP 引用幾個外部工具,**沒有它們流程照樣走**(降級路徑見
[`DEGRADATION.md`](DEGRADATION.md)):

- **Codex CLI**(跨模型 review)— 自行取得;沒有就用 Claude Code 內建 `/code-review`
- **gstack**(/cso、/review 等 skill 套件)— 外部依賴,本模板不包含、不教學;
  沒有就用內建 `security-review` / `/code-review`
- **gbrain**(語意記憶檢索)— 沒有就純 git 核實
