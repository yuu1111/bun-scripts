# Bun Scripts - Visual Studio Code 拡張機能

> **Fork元**: [w0o0o/bun-scripts](https://github.com/w0o0o/bun-scripts)

## 概要

**Bun Scripts** は、エクスプローラーパネルに「Bun Scripts」ビューを追加する VS Code 拡張機能です。`package.json` に定義された `scripts` を一覧表示し、クリックするとターミナルで `bun run <script>` を実行します (NPM Scripts ビューと同様の UX)。

## 機能

- `package.json` の `scripts` をエクスプローラーに表示
- スクリプトをクリックして `bun run <script>` を実行
- monorepo (`workspaces`) 対応 — ルートと各パッケージのスクリプトを階層表示
- ツリービューに Expand All / Collapse All ボタン
- `package.json` の保存・変更を検知して自動リフレッシュ

## 必要条件

- Visual Studio Code `^1.118.0`
- [Bun](https://bun.sh/) (スクリプト実行用)

## 使い方

1. `package.json` を含むプロジェクトを VS Code で開く
2. エクスプローラーパネルに「BUN SCRIPTS」ビューが表示される
3. スクリプト名をクリックすると、新しいターミナルで `bun run <script>` が実行される

monorepo の場合はワークスペースルートとサブパッケージが折りたたみ可能なノードとして表示され、それぞれのディレクトリで実行される。

## 開発

```bash
bun install              # 依存関係をインストール
bun run build            # esbuild でバンドル (dist/extension.js)
bun run watch            # esbuild watch モード
bun run typecheck        # tsc -noEmit (型チェックのみ)
bun run lint             # biome check
bun run format           # biome check --write --unsafe
bun run deploy           # build + vsce package + code --install-extension
```

VS Code で本リポジトリを開き、`F5` (Run Extension) で Extension Host を起動するとデバッグできる。

## ディレクトリ構成

```
src/
  extension.ts                    # activate エントリポイント、コマンド登録
  bunScriptsTreeDataProvider.ts   # TreeDataProvider 実装、workspaces 解決
scripts/
  build.ts                        # esbuild バンドルスクリプト (--watch 対応)
  deploy.ts                       # vsce package + code --install-extension
dist/                             # esbuild の出力先
```

## 技術スタック

- TypeScript (`@yuu1111/tsconfig` を extends)
- esbuild (CJS, Node, `vscode` external)
- Biome (`@yuu1111/biome-config` を extends) — Linter / Formatter
