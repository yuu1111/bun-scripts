import { type BuildOptions, build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const options: BuildOptions = {
	entryPoints: ["./src/extension.ts"],
	bundle: true,
	outdir: "dist",
	format: "cjs",
	platform: "node",
	external: ["vscode"],
	sourcemap: true,
};

if (watch) {
	const ctx = await context(options);
	await ctx.watch();
	console.log("esbuild: watching for changes...");
} else {
	await build(options);
}
