import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * @description ワークスペースフォルダまたはスクリプトを表すツリーアイテム
 * @property cwd - スクリプト実行時の作業ディレクトリ (スクリプトアイテムのみ) @optional
 * @property workspacePath - パッケージディレクトリの絶対パス (フォルダアイテムのみ) @optional
 */
class BunScriptTreeItem extends vscode.TreeItem {
	cwd?: string;
	workspacePath?: string;
}

/**
 * @description package.json を読み取ってパースする
 * @param pkgDir - package.json が存在するディレクトリの絶対パス
 * @returns パースされたオブジェクト、失敗時は undefined
 */
function readPackageJson(pkgDir: string): Record<string, unknown> | undefined {
	try {
		const raw = fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8");
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}

/**
 * @description package.json から workspaces パターン配列を抽出する
 * @param pkg - パースされた package.json オブジェクト
 * @returns workspaces パターン配列、存在しない場合は undefined
 */
function extractWorkspaces(pkg: Record<string, unknown>): string[] | undefined {
	const ws = pkg.workspaces;
	if (Array.isArray(ws)) return ws;
	// Yarn 互換: { packages: [...] } 形式
	if (
		ws &&
		typeof ws === "object" &&
		Array.isArray((ws as Record<string, unknown>).packages)
	) {
		return (ws as Record<string, unknown>).packages as string[];
	}
	return undefined;
}

/**
 * @description workspaces のグロブパターンをディレクトリ一覧に展開する
 * @param rootPath - ワークスペースルートの絶対パス
 * @param patterns - workspaces フィールドのパターン配列
 * @returns パッケージディレクトリのパスとパース済み package.json のペア配列
 */
function resolveWorkspaceGlobs(
	rootPath: string,
	patterns: string[],
): { dir: string; pkg: Record<string, unknown> }[] {
	const dirs: string[] = [];

	for (const pattern of patterns) {
		if (pattern.endsWith("/*")) {
			const parent = path.join(rootPath, pattern.slice(0, -2));
			try {
				const entries = fs.readdirSync(parent, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory()) {
						dirs.push(path.join(parent, entry.name));
					}
				}
			} catch {}
		} else {
			const dir = path.join(rootPath, pattern);
			if (fs.existsSync(dir)) {
				dirs.push(dir);
			}
		}
	}

	const results: { dir: string; pkg: Record<string, unknown> }[] = [];
	for (const dir of dirs) {
		const pkg = readPackageJson(dir);
		if (pkg) results.push({ dir, pkg });
	}
	return results;
}

/**
 * @description スクリプトアイテムの配列を生成する
 * @param scripts - スクリプト名とコマンドのマップ
 * @param cwd - スクリプト実行時の作業ディレクトリ
 * @returns スクリプトツリーアイテムの配列
 */
function createScriptItems(
	scripts: Record<string, string>,
	cwd: string,
): BunScriptTreeItem[] {
	return Object.entries(scripts).map(([name]) => {
		const item = new BunScriptTreeItem(
			name,
			vscode.TreeItemCollapsibleState.None,
		);
		item.tooltip = `bun run ${name}`;
		item.cwd = cwd;
		item.command = {
			command: "extension.runBunScript",
			title: "Run Bun Script",
			tooltip: "Run Bun Script",
			arguments: [name, cwd],
		};
		return item;
	});
}

/**
 * @description Bun Scripts ツリービューのデータプロバイダー
 */
export class BunScriptsTreeDataProvider
	implements vscode.TreeDataProvider<BunScriptTreeItem>
{
	private _onDidChangeTreeData = new vscode.EventEmitter<
		BunScriptTreeItem | undefined
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	/**
	 * @description ツリーデータの変更を通知してビューを更新する
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * @description ツリーアイテムのビュー表現を返す
	 * @param element - ツリーアイテム
	 * @returns そのままのツリーアイテム
	 */
	getTreeItem(element: BunScriptTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * @description ツリーアイテムの親要素を返す (reveal に必要)
	 * @param element - 子要素
	 * @returns 親要素。ルートレベルの場合は undefined
	 */
	getParent(_element: BunScriptTreeItem): BunScriptTreeItem | undefined {
		return undefined;
	}

	/**
	 * @description ツリーの子要素を返す
	 * @param element - 親要素。undefined の場合はルートレベル
	 * @returns 子ツリーアイテムの配列
	 */
	async getChildren(
		element?: BunScriptTreeItem,
	): Promise<BunScriptTreeItem[]> {
		if (element?.workspacePath) {
			const pkg = readPackageJson(element.workspacePath);
			const scripts = pkg?.scripts as Record<string, string> | undefined;
			if (!scripts) return [];
			return createScriptItems(scripts, element.workspacePath);
		}

		const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!rootPath) return [];

		const rootPkg = readPackageJson(rootPath);
		const workspaces = rootPkg ? extractWorkspaces(rootPkg) : undefined;

		if (rootPkg && workspaces) {
			const items: BunScriptTreeItem[] = [];

			const rootName = (rootPkg.name as string | undefined) ?? "(root)";
			const rootItem = new BunScriptTreeItem(
				rootName,
				vscode.TreeItemCollapsibleState.Collapsed,
			);
			rootItem.workspacePath = rootPath;
			rootItem.tooltip = rootName;
			items.push(rootItem);

			const wsPkgs = resolveWorkspaceGlobs(rootPath, workspaces);
			for (const { dir, pkg } of wsPkgs) {
				const label = path.relative(rootPath, dir).replace(/\\/g, "/");
				const item = new BunScriptTreeItem(
					label,
					vscode.TreeItemCollapsibleState.Collapsed,
				);
				item.workspacePath = dir;
				item.tooltip = (pkg.name as string | undefined) ?? label;
				items.push(item);
			}

			return items;
		}

		const uris = await vscode.workspace.findFiles(
			"**/package.json",
			"**/node_modules/**",
		);
		const dirs = uris
			.map((u) => path.dirname(u.fsPath))
			.sort((a, b) => a.length - b.length);

		// ルート package.json のみが存在する場合は従来どおり scripts を直接展開
		if (rootPkg && dirs.length === 1 && dirs[0] === rootPath) {
			const scripts = rootPkg.scripts as Record<string, string> | undefined;
			if (!scripts) return [];
			return createScriptItems(scripts, rootPath);
		}

		const items: BunScriptTreeItem[] = [];
		for (const dir of dirs) {
			const pkg = readPackageJson(dir);
			if (!pkg) continue;
			const scripts = pkg.scripts as Record<string, string> | undefined;
			if (!scripts || Object.keys(scripts).length === 0) continue;
			const label =
				dir === rootPath
					? ((pkg.name as string | undefined) ?? "(root)")
					: (path.relative(rootPath, dir).replace(/\\/g, "/") || ".");
			const item = new BunScriptTreeItem(
				label,
				vscode.TreeItemCollapsibleState.Collapsed,
			);
			item.workspacePath = dir;
			item.tooltip = (pkg.name as string | undefined) ?? label;
			items.push(item);
		}

		return items;
	}
}
