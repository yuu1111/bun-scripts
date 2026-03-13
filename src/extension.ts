import * as vscode from "vscode";
import { BunScriptsTreeDataProvider } from "./bunScriptsTreeDataProvider";

export function activate(context: vscode.ExtensionContext): void {
	const bunScriptsTreeDataProvider = new BunScriptsTreeDataProvider();

	vscode.window.registerTreeDataProvider(
		"bunScripts",
		bunScriptsTreeDataProvider,
	);

	const runBunScript = vscode.commands.registerCommand(
		"extension.runBunScript",
		(script: string) => {
			vscode.window.showInformationMessage(`Running Bun Script: ${script}`);

			const terminal = vscode.window.createTerminal();
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

	context.subscriptions.push(runBunScript, watcher, onSave);
}
