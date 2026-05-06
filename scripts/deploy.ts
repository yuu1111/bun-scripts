import { execSync } from "node:child_process";
import { readdirSync, unlinkSync } from "node:fs";
import { runBuild } from "./build";

function cleanVsix(): void {
	for (const f of readdirSync(".")) {
		if (f.endsWith(".vsix")) unlinkSync(f);
	}
}

function packageVsix(): void {
	execSync("bunx @vscode/vsce package --no-dependencies", {
		stdio: ["pipe", "inherit", "inherit"],
		input: "y\n",
	});
}

function findVsix(): string {
	const vsix = readdirSync(".").find((f) => f.startsWith("bun-scripts-") && f.endsWith(".vsix"));
	if (!vsix) throw new Error("packaged vsix not found");
	return vsix;
}

function installVsix(vsix: string): void {
	execSync(`code --install-extension ${vsix} --force`, { stdio: "inherit" });
}

cleanVsix();
await runBuild();
packageVsix();
installVsix(findVsix());
