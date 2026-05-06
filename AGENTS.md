# プロジェクト概要

VS Code 拡張機能。エクスプローラーパネルに「Bun Scripts」ビューを追加し、`package.json` の scripts を一覧表示・クリックで `bun run <script>` 実行する。[w0o0o/bun-scripts](https://github.com/w0o0o/bun-scripts) の Fork。

# コマンド

```bash
bun run build     # esbuild でバンドル (dist/extension.js)
bun run watch     # esbuild watch モード
bun run typecheck # tsc -noEmit (型チェックのみ)
bun run lint      # biome check
bun run format    # biome check --write --unsafe
```

パッケージング: `vsce package` で .vsix 生成。デバッグは VS Code の「Run Extension」(F5) で Extension Host 起動。

# アーキテクチャ

- `src/extension.ts` — `activate()` エントリポイント。TreeView 作成、`extension.runBunScript` / `bunScripts.expandAll` / `bunScripts.collapseAll` コマンド登録、`package.json` の FileSystemWatcher + onDidSave でツリー自動リフレッシュ
- `src/bunScriptsTreeDataProvider.ts` — `BunScriptsTreeDataProvider` (TreeDataProvider 実装)。ルート `package.json` を同期的に読み、`workspaces` があれば monorepo として各パッケージを折りたたみノードで展開。無い場合は `findFiles` で配下の `package.json` を探索し、scripts エントリを `BunScriptTreeItem` に変換
- バンドラは esbuild (CJS, Node, vscode external)。TypeScript の型チェックは tsc -noEmit で別途実行
- Linter/Formatter は Biome (`@yuu1111/biome-config` を extends)
- tsconfig は `@yuu1111/tsconfig/base.json` を extends
