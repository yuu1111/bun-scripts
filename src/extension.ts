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

	context.subscriptions.push(runBunScript);
}
