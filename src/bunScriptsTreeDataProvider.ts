import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

class BunScriptTreeItem extends vscode.TreeItem {
	constructor(
		label: string,
		collapsibleState: vscode.TreeItemCollapsibleState,
		script: string,
	) {
		super(label, collapsibleState);
		this.tooltip = `bun run ${script}`;
	}
}

export class BunScriptsTreeDataProvider
	implements vscode.TreeDataProvider<BunScriptTreeItem>
{
	private _onDidChangeTreeData = new vscode.EventEmitter<
		BunScriptTreeItem | undefined
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: BunScriptTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(_element?: BunScriptTreeItem): BunScriptTreeItem[] {
		const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!rootPath) {
			return [];
		}

		const pkgPath = path.join(rootPath, "package.json");
		let scripts: Record<string, string> | undefined;
		try {
			const raw = fs.readFileSync(pkgPath, "utf-8");
			scripts = JSON.parse(raw).scripts;
		} catch {
			return [];
		}
		if (!scripts) {
			return [];
		}

		const items: BunScriptTreeItem[] = [];

		for (const [name, command] of Object.entries(scripts)) {
			const item = new BunScriptTreeItem(
				name,
				vscode.TreeItemCollapsibleState.None,
				command,
			);
			item.command = {
				command: "extension.runBunScript",
				title: "Run Bun Script",
				tooltip: "Run Bun Script",
				arguments: [name],
			};
			item.iconPath = {
				light: vscode.Uri.file(`${__dirname}/bun.svg`),
				dark: vscode.Uri.file(`${__dirname}/bun.svg`),
			};
			items.push(item);
		}

		return items;
	}
}
