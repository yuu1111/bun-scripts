import * as vscode from "vscode";
import { BunScriptsTreeDataProvider } from "./bunScriptsTreeDataProvider";

/**
 * @description 拡張機能のエントリーポイント
 * @param context - 拡張機能コンテキスト
 */
export function activate(context: vscode.ExtensionContext): void {
	const bunScriptsTreeDataProvider = new BunScriptsTreeDataProvider();

	const treeView = vscode.window.createTreeView("bunScripts", {
		treeDataProvider: bunScriptsTreeDataProvider,
	});

	const expandAll = vscode.commands.registerCommand(
		"bunScripts.expandAll",
		() => {
			for (const item of bunScriptsTreeDataProvider.getChildren()) {
				treeView.reveal(item, { expand: 2 });
			}
		},
	);

	const collapseAll = vscode.commands.registerCommand(
		"bunScripts.collapseAll",
		() =>
			vscode.commands.executeCommand(
				"workbench.actions.treeView.bunScripts.collapseAll",
			),
	);

	const runBunScript = vscode.commands.registerCommand(
		"extension.runBunScript",
		(script: string, cwd?: string) => {
			vscode.window.showInformationMessage(`Running Bun Script: ${script}`);

			const terminal = vscode.window.createTerminal(
				cwd ? { name: `Bun: ${script}`, cwd } : { name: `Bun: ${script}` },
			);
			terminal.show();
			terminal.sendText(`bun run ${script}`);
		},
	);

	const watcher = vscode.workspace.createFileSystemWatcher("**/package.json");
	watcher.onDidChange(() => bunScriptsTreeDataProvider.refresh());
	watcher.onDidCreate(() => bunScriptsTreeDataProvider.refresh());
	watcher.onDidDelete(() => bunScriptsTreeDataProvider.refresh());

	const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
		if (doc.fileName.endsWith("package.json")) {
			bunScriptsTreeDataProvider.refresh();
		}
	});

	context.subscriptions.push(
		treeView,
		expandAll,
		collapseAll,
		runBunScript,
		watcher,
		onSave,
	);
}
