// @vitest-environment node
// Tests for scripts/check-doc-refs.ts(doc-ref checker)
//
// 驗 pure functions:
//   - extractRefs:@import / markdown link / 純路徑;跳過 fenced code / 外部 / 路由 / 佔位符
//   - checkRefs:doc-dir vs repo-root 解析、../ 逃出 repo 跳過、gitignored / planned 跳過、缺檔報 violation

import { describe, expect, it } from 'vitest';
import { extractRefs, checkRefs, type Ref } from '../scripts/check-doc-refs';

describe('extractRefs', () => {
  it('@import 整行', () => {
    expect(extractRefs('@AGENTS.md\n@GUIDE.md')).toEqual([
      { type: 'import', rawPath: 'AGENTS.md', line: 1 },
      { type: 'import', rawPath: 'GUIDE.md', line: 2 },
    ]);
  });

  it('markdown 本地連結(有副檔名)→ 去 anchor', () => {
    const refs = extractRefs('see [x](docs/SECURITY.md#sec-3) and [y](TODOS.md)');
    expect(refs).toEqual([
      { type: 'link', rawPath: 'docs/SECURITY.md', line: 1 },
      { type: 'link', rawPath: 'TODOS.md', line: 1 },
    ]);
  });

  it('跳過外部連結 / 絕對路由 / 純 anchor / 無副檔名', () => {
    const refs = extractRefs('[a](https://x.com) [b](/privacy) [c](#anchor) [d](mailto:x@y.z) [e](../foo)');
    expect(refs).toEqual([]);
  });

  it('純文字路徑提及', () => {
    const refs = extractRefs('see scripts/check-doc-refs.ts and tests/sample.test.ts here');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'scripts/check-doc-refs.ts', line: 1 },
      { type: 'plain', rawPath: 'tests/sample.test.ts', line: 1 },
    ]);
  });

  it('.tsx 純路徑不被截斷成 .ts(副檔名 alternation longest-match-first)', () => {
    // regression:`ts` 若排在 `tsx` 前會把 foo.tsx 截成 foo.ts → 對真實 .tsx 檔假陽性
    const refs = extractRefs('see stack/nextjs-prisma/components/widget.tsx and docs/example.tsx');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'stack/nextjs-prisma/components/widget.tsx', line: 1 },
      { type: 'plain', rawPath: 'docs/example.tsx', line: 1 },
    ]);
  });

  it('動態 segment `[foo]` 不被截斷(Next.js / SvelteKit / Astro 動態路由通用)', () => {
    // regression:字元類不含 `[` `]` 會在 `[` 處斷、抽出半截路徑或漏驗整條
    const refs = extractRefs('see stack/nextjs-prisma/app/[token]/page.tsx and docs/[locale]/README.md');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'stack/nextjs-prisma/app/[token]/page.tsx', line: 1 },
      { type: 'plain', rawPath: 'docs/[locale]/README.md', line: 1 },
    ]);
  });

  it('glob `**/pattern` 的後半截不被誤收(前字元是 `/` 屬 glob 一部分 → 跳)', () => {
    // regression:SOP 的清單常寫 `**/tests/*.test.ts` 這類 glob,regex 從 `tests/`
    // 起匹配、把 `**/` 留在外面 → 舊版會誤報「repo 根下有個 tests/*.test.ts」而假陽性
    const refs = extractRefs('清單:`**/tests/*.test.ts`、`**/scripts/foo.ts`');
    expect(refs).toEqual([]);
  });

  it('`./` 前綴的相對路徑要被抽出(Codex R1 F1 regression)', () => {
    // regression:前字元檢查會把 `.`/`/` 當「更長 token 的一部分」而 skip,
    // 讓 `./scripts/foo.ts` 這種常見寫法逃過驗證 = fail-open。修法:PLAIN_PATH_RE
    // 前綴加 `(?:\.\/)?`,rawPath 保留 `./`(path.posix.normalize 後續會消掉)。
    const refs = extractRefs('see ./scripts/definitely-missing.ts and ./docs/x.md');
    expect(refs).toEqual([
      { type: 'plain', rawPath: './scripts/definitely-missing.ts', line: 1 },
      { type: 'plain', rawPath: './docs/x.md', line: 1 },
    ]);
  });

  it('跳過 fenced code block 內容', () => {
    const content = '```\nscripts/in-fence.ts\n```\nscripts/out.ts';
    expect(extractRefs(content)).toEqual([{ type: 'plain', rawPath: 'scripts/out.ts', line: 4 }]);
  });

  it('混用 ``` 與 ~~~ 的 fence 不洩漏(同款 marker 才能關)', () => {
    // ~~~ 開 fence,內層 ``` 是內容不該關它 → 中間路徑仍被跳過(只有同款 ~~~ 能關)
    const content = '~~~\ncode\n```\nscripts/leaked.ts\n~~~\nscripts/real.ts';
    expect(extractRefs(content)).toEqual([{ type: 'plain', rawPath: 'scripts/real.ts', line: 6 }]);
  });

  it('跳過佔位符(scripts/xxx.ts / 角括號 / 省略號)', () => {
    expect(extractRefs('scripts/xxx.ts 與 [a](docs/<name>.ts) 與 docs/a...md')).toEqual([]);
  });

  it('md-link 與純路徑指向同一目標 → 不重複', () => {
    expect(extractRefs('[x](docs/a.md) 又提一次 docs/a.md')).toEqual([
      { type: 'link', rawPath: 'docs/a.md', line: 1 },
    ]);
  });
});

describe('checkRefs', () => {
  const existsIn = (set: Set<string>) => (p: string) => set.has(p);

  it('import 相對 doc 目錄存在 → 無 violation', () => {
    const refs: Ref[] = [{ type: 'import', rawPath: 'AGENTS.md', line: 1 }];
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set(['AGENTS.md'])))).toEqual([]);
  });

  it('link 缺檔 → violation', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'docs/gone.md', line: 5 }];
    expect(checkRefs(refs, 'TODOS.md', existsIn(new Set()))).toEqual([
      { doc: 'TODOS.md', line: 5, type: 'link', rawPath: 'docs/gone.md' },
    ]);
  });

  it('link 寫 repo-root-relative(從 .claude/memory)→ 存在不報', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'scripts/check-doc-refs.ts', line: 1 }];
    expect(
      checkRefs(refs, '.claude/memory/LESSONS.md', existsIn(new Set(['scripts/check-doc-refs.ts'])))
    ).toEqual([]);
  });

  it('link 寫 doc-dir-relative(從 docs/)→ 存在不報', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'ADOPTION.md', line: 1 }];
    expect(checkRefs(refs, 'docs/README.md', existsIn(new Set(['docs/ADOPTION.md'])))).toEqual([]);
  });

  it('plain:doc 目錄 或 repo root 擇一存在即可', () => {
    const refs: Ref[] = [{ type: 'plain', rawPath: 'docs/x.md', line: 1 }];
    expect(checkRefs(refs, 'TODOS.md', existsIn(new Set(['docs/x.md'])))).toEqual([]);
  });

  it('../ 逃出 repo root → 跳過(非 violation)', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: '../outside.html', line: 1 }];
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()))).toEqual([]);
  });

  it('gitignored 路徑(.env* / settings.local.json)→ 跳過,避免硬 gate 在 CI 假陽性', () => {
    // regression:本機有、CI checkout 無的 gitignored 檔(CLAUDE.md 禁區清單會提到)
    const refs: Ref[] = [{ type: 'plain', rawPath: '.claude/settings.local.json', line: 264 }];
    const isIgnored = (p: string) => p === '.claude/settings.local.json';
    // 即使 fileExists 回 false(模擬 CI),isIgnored 命中 → 不報 violation
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()), isIgnored)).toEqual([]);
    // 預設 isIgnored(不傳)→ 仍會報(確認跳過是 isIgnored 造成,非預設行為)
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()))).toEqual([
      { doc: 'CLAUDE.md', line: 264, type: 'plain', rawPath: '.claude/settings.local.json' },
    ]);
  });

  it('planned 路徑(模板尚在建置的檔)→ 跳過;檔案存在後 isPlanned 不再命中則正常驗', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'docs/ADOPTION.md', line: 7 }];
    const isPlanned = (p: string) => p === 'docs/ADOPTION.md';
    // 檔案不存在 + planned 命中 → 不報
    expect(checkRefs(refs, 'README.md', existsIn(new Set()), () => false, isPlanned)).toEqual([]);
    // 預設 isPlanned(不傳)→ 仍會報(確認跳過是 isPlanned 造成,非預設行為)
    expect(checkRefs(refs, 'README.md', existsIn(new Set()))).toEqual([
      { doc: 'README.md', line: 7, type: 'link', rawPath: 'docs/ADOPTION.md' },
    ]);
  });
});
