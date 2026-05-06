import { type BuildOptions, build, context } from "esbuild";

export const buildOptions: BuildOptions = {
	entryPoints: ["./src/extension.ts"],
	bundle: true,
	outdir: "dist",
	format: "cjs",
	platform: "node",
	external: ["vscode"],
	sourcemap: true,
};

export async function runBuild(watch = false): Promise<void> {
	if (watch) {
		const ctx = await context(buildOptions);
		await ctx.watch();
		console.log("esbuild: watching for changes...");
	} else {
		await build(buildOptions);
	}
}

if (import.meta.main) {
	await runBuild(process.argv.includes("--watch"));
}
