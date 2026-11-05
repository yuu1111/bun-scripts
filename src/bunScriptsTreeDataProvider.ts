import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

/**
 * ワークスペースフォルダまたはスクリプトを表すツリーアイテム。
 */
class BunScriptTreeItem extends vscode.TreeItem {
	cwd?: string;
	workspacePath?: string;
}

/**
 * package.json を読み取ってパースする。
 *
 * @param pkgDir - package.json が存在するディレクトリの絶対パス
 * @returns パースされたオブジェクト。失敗時は `undefined`
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
 * package.json から workspaces パターン配列を抽出する。
 *
 * @param pkg - パースされた package.json オブジェクト
 * @returns workspaces パターン配列。存在しない場合は `undefined`
 */
function extractWorkspaces(pkg: Record<string, unknown>): string[] | undefined {
	const ws = pkg.workspaces;
	if (Array.isArray(ws)) {
		return ws;
	}
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
 * ディレクトリ直下のサブディレクトリを列挙する。
 *
 * @param parent - 走査するディレクトリの絶対パス
 * @returns サブディレクトリの絶対パス配列。読み取れない場合は空配列
 */
function listSubdirectories(parent: string): string[] {
	try {
		return fs
			.readdirSync(parent, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(parent, entry.name));
	} catch {
		return [];
	}
}

/**
 * workspaces のパターン 1 件を実在するディレクトリに展開する。
 *
 * @param rootPath - ワークスペースルートの絶対パス
 * @param pattern - workspaces フィールドのパターン
 * @returns 該当ディレクトリの絶対パス配列
 */
function expandWorkspacePattern(rootPath: string, pattern: string): string[] {
	if (pattern.endsWith("/*")) {
		return listSubdirectories(path.join(rootPath, pattern.slice(0, -2)));
	}
	const dir = path.resolve(rootPath, pattern);
	return fs.existsSync(dir) ? [dir] : [];
}

/**
 * workspaces のグロブパターンをディレクトリ一覧に展開する。
 *
 * @param rootPath - ワークスペースルートの絶対パス
 * @param patterns - workspaces フィールドのパターン配列
 * @returns パッケージディレクトリのパスとパース済み package.json のペア配列
 */
function resolveWorkspaceGlobs(
	rootPath: string,
	patterns: string[],
): { dir: string; pkg: Record<string, unknown> }[] {
	const dirs = new Set(
		patterns.flatMap((pattern) => expandWorkspacePattern(rootPath, pattern)),
	);

	const results: { dir: string; pkg: Record<string, unknown> }[] = [];
	dirs.delete(path.resolve(rootPath));
	for (const dir of dirs) {
		const pkg = readPackageJson(dir);
		if (pkg) {
			results.push({ dir, pkg });
		}
	}
	return results;
}

/**
 * パッケージディレクトリを表すフォルダアイテムを生成する。
 *
 * @param dir - パッケージディレクトリの絶対パス
 * @param rootPath - ワークスペースルートの絶対パス
 * @param pkg - パース済み package.json
 * @returns `Collapsed` 状態のフォルダアイテム
 */
function createFolderItem(
	dir: string,
	rootPath: string,
	pkg: Record<string, unknown>,
): BunScriptTreeItem {
	const name = pkg.name as string | undefined;
	const label =
		dir === rootPath
			? (name ?? "(root)")
			: path.relative(rootPath, dir).replace(/\\/g, "/");
	const item = new BunScriptTreeItem(
		label,
		vscode.TreeItemCollapsibleState.Collapsed,
	);
	item.workspacePath = dir;
	item.tooltip = name ?? label;
	return item;
}

/**
 * スクリプトアイテムの配列を生成する。
 *
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
 * package.json の scripts フィールドを取り出す。
 *
 * @param pkg - パース済み package.json
 * @returns スクリプト名とコマンドのマップ。存在しない場合は `undefined`
 */
function readScripts(
	pkg: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
	return pkg?.scripts as Record<string, string> | undefined;
}

/**
 * workspaces 定義を持つ monorepo のルート要素を生成する。
 *
 * @param rootPath - ワークスペースルートの絶対パス
 * @param rootPkg - ルートのパース済み package.json
 * @param workspaces - workspaces フィールドのパターン配列
 * @returns ルートと各パッケージのフォルダアイテム配列
 */
function createWorkspaceRootItems(
	rootPath: string,
	rootPkg: Record<string, unknown>,
	workspaces: string[],
): BunScriptTreeItem[] {
	const items = [createFolderItem(rootPath, rootPath, rootPkg)];
	for (const { dir, pkg } of resolveWorkspaceGlobs(rootPath, workspaces)) {
		items.push(createFolderItem(dir, rootPath, pkg));
	}
	return items;
}

/**
 * workspaces 定義が無い場合に、配下の package.json からルート要素を生成する。
 *
 * @param rootPath - ワークスペースルートの絶対パス
 * @param rootPkg - ルートのパース済み package.json。存在しない場合は `undefined`
 * @returns スクリプトアイテムまたはフォルダアイテムの配列
 */
async function createDiscoveredRootItems(
	rootPath: string,
	rootPkg: Record<string, unknown> | undefined,
): Promise<BunScriptTreeItem[]> {
	const uris = await vscode.workspace.findFiles(
		"**/package.json",
		"**/node_modules/**",
	);
	const dirs = uris
		.map((u) => path.dirname(u.fsPath))
		.sort((a, b) => a.length - b.length);

	// 単一パッケージは従来どおりフォルダ階層なしで scripts を直接表示
	if (rootPkg && dirs.length === 1 && dirs[0] === rootPath) {
		const scripts = readScripts(rootPkg);
		return scripts ? createScriptItems(scripts, rootPath) : [];
	}

	const items: BunScriptTreeItem[] = [];
	for (const dir of dirs) {
		const pkg = dir === rootPath && rootPkg ? rootPkg : readPackageJson(dir);
		const scripts = readScripts(pkg);
		if (pkg && scripts && Object.keys(scripts).length > 0) {
			items.push(createFolderItem(dir, rootPath, pkg));
		}
	}
	return items;
}

/**
 * Bun Scripts ツリービューのデータプロバイダー。
 */
export class BunScriptsTreeDataProvider
	implements vscode.TreeDataProvider<BunScriptTreeItem>
{
	private _onDidChangeTreeData = new vscode.EventEmitter<
		BunScriptTreeItem | undefined
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	/**
	 * ツリーデータの変更を通知してビューを更新する。
	 */
	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	/**
	 * ツリーアイテムのビュー表現を返す。
	 *
	 * @param element - ツリーアイテム
	 * @returns そのままのツリーアイテム
	 */
	getTreeItem(element: BunScriptTreeItem): vscode.TreeItem {
		return element;
	}

	/**
	 * ツリーアイテムの親要素を返す。
	 *
	 * @remarks
	 * {@link vscode.TreeView.reveal} の呼び出しに必要。
	 *
	 * @param _element - 子要素
	 * @returns 親要素。ルートレベルの場合は `undefined`
	 */
	getParent(_element: BunScriptTreeItem): BunScriptTreeItem | undefined {
		return undefined;
	}

	/**
	 * ツリーの子要素を返す。
	 *
	 * @param element - 親要素。`undefined` の場合はルートレベル
	 * @returns 子ツリーアイテムの配列
	 */
	async getChildren(element?: BunScriptTreeItem): Promise<BunScriptTreeItem[]> {
		if (element?.workspacePath) {
			const scripts = readScripts(readPackageJson(element.workspacePath));
			return scripts ? createScriptItems(scripts, element.workspacePath) : [];
		}

		const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!rootPath) {
			return [];
		}

		const rootPkg = readPackageJson(rootPath);
		const workspaces = rootPkg ? extractWorkspaces(rootPkg) : undefined;
		if (rootPkg && workspaces) {
			return createWorkspaceRootItems(rootPath, rootPkg, workspaces);
		}
		return createDiscoveredRootItems(rootPath, rootPkg);
	}
}
