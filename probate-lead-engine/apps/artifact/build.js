const {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { dirname, join, relative, sep } = require("node:path");
const esbuild = require("esbuild");
const postcss = require("postcss");
const tailwindcss = require("@tailwindcss/postcss");

const sourceDir = join(__dirname, "src");
const distDir = join(__dirname, "dist");
const assetsDir = join(distDir, "assets");
const runtimeAssetsDir = join(__dirname, "runtime-assets");
const runtimeFunctionsDir = join(__dirname, "runtime-functions");
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const virtualFeatureModule = "virtual:heirright-features";
const forbiddenRuntimeAsset = /https?:\/\/(?:ka-[fp]\.fontawesome\.com|ka-f\.webawesome\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.bunny\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/i;
const forbiddenPublicOperatorFiles = new Set([
  "api/connections/status",
  "daily-run.json",
  "fresh-lead-batch.json",
  "latest-run.json",
  "qualification-review.json",
  "qualification-review.md",
  "readback-evidence.json",
  "readback-evidence.md",
  "thirty-day-review-script.md",
]);
const forbiddenPublicSeedPatterns = [
  /01-3113-008-0130/i,
  /Annie Hawkins/i,
  /Catherine Etienne/i,
  /Chusa Sylvestre/i,
  /131\s+NW\s+67\s+ST/i,
  /run-[a-z0-9-]*estate-of-annie-hawkins/i,
  /["']estateName["']\s*:\s*["']Estate of Annie Hawkins["']/i,
  /Lucia Alvarez|Walter Green|Carmen Rosales|Harold Milton|Denise Parker|Samuel Baptiste/i,
  /1840\s+NW\s+55|7230\s+NW\s+12|1551\s+SW\s+19|20215\s+NW\s+33|481\s+NW\s+102|930\s+NE\s+138/i,
  /01-3115-021-0440|01-3112-038-0090|01-4110-014-0830|34-1133-027-1180|30-3102-011-0410|06-2129-031-0220/i,
];

function walkRegisterModules(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walkRegisterModules(path);
      return entry.isFile() && entry.name === "register.js" ? [path] : [];
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function featureDiscoveryPlugin(registerModules) {
  return {
    name: "heirright-feature-discovery",
    setup(build) {
      build.onResolve({ filter: /^virtual:heirright-features$/ }, () => ({
        path: virtualFeatureModule,
        namespace: "heirright-features",
      }));
      build.onLoad({ filter: /.*/, namespace: "heirright-features" }, () => ({
        contents: registerModules.length
          ? registerModules.map((path) => `import ${JSON.stringify(path)};`).join("\n")
          : "export {};",
        loader: "js",
        resolveDir: sourceDir,
      }));
    },
  };
}

function localizeWebAwesomeAssetsPlugin() {
  return {
    name: "heirright-local-webawesome-assets",
    setup(build) {
      build.onLoad({ filter: /@awesome\.me[\\/]webawesome[\\/]dist[\\/].*\.js$/ }, (args) => ({
        contents: readFileSync(args.path, "utf8")
          .replaceAll("https://ka-f.fontawesome.com", "/assets/webawesome/icons")
          .replaceAll("https://ka-p.fontawesome.com", "/assets/webawesome/icons"),
        loader: "js",
      }));
    },
  };
}

function copyWebAwesomeRuntime() {
  const packageRoot = dirname(require.resolve("@awesome.me/webawesome/package.json"));
  const target = join(assetsDir, "webawesome");
  mkdirSync(join(target, "components", "icon"), { recursive: true });
  mkdirSync(join(target, "chunks"), { recursive: true });
  copyFileSync(join(packageRoot, "LICENSE.md"), join(target, "LICENSE.md"));
  writeFileSync(join(target, "package.json"), `${JSON.stringify({
    private: true,
    type: "module",
  }, null, 2)}\n`);
  copyFileSync(join(packageRoot, "dist", "components", "icon", "library.system.js"), join(target, "components", "icon", "library.system.js"));
  for (const chunk of ["chunk.XTA2JDH4.js", "chunk.7VGCIHDG.js"]) {
    copyFileSync(join(packageRoot, "dist", "chunks", chunk), join(target, "chunks", chunk));
  }
  writeFileSync(join(target, "manifest.json"), `${JSON.stringify({
    package: "@awesome.me/webawesome",
    version: "3.10.0",
    edition: "Free",
    basePath: "/assets/webawesome",
    runtime: "bundled by esbuild",
    localSystemIconRuntime: [
      "components/icon/library.system.js",
      "chunks/chunk.XTA2JDH4.js",
      "chunks/chunk.7VGCIHDG.js",
    ],
  }, null, 2)}\n`);
}

function copyBrandAssets() {
  copyFileSync(join(sourceDir, "assets", "heirright-mark.png"), join(assetsDir, "heirright-mark.png"));
}

function copyPdfExtractionRuntime() {
  const pdfjsSource = dirname(require.resolve("pdfjs-dist/package.json"));
  const canvasSource = dirname(require.resolve("@napi-rs/canvas/package.json"));
  const pdfjsTarget = join(runtimeAssetsDir, "pdfjs-dist");
  const canvasTarget = join(runtimeAssetsDir, "@napi-rs", "canvas");
  const standardFontsSource = join(pdfjsSource, "standard_fonts");
  const standardFontsTarget = join(pdfjsTarget, "standard_fonts");

  rmSync(runtimeAssetsDir, { recursive: true, force: true });
  mkdirSync(join(pdfjsTarget, "legacy", "build"), { recursive: true });
  mkdirSync(standardFontsTarget, { recursive: true });
  mkdirSync(canvasTarget, { recursive: true });

  for (const file of ["LICENSE", "package.json"]) {
    copyFileSync(join(pdfjsSource, file), join(pdfjsTarget, file));
    copyFileSync(join(canvasSource, file), join(canvasTarget, file));
  }
  for (const file of ["pdf.mjs", "pdf.worker.mjs"]) {
    copyFileSync(join(pdfjsSource, "legacy", "build", file), join(pdfjsTarget, "legacy", "build", file));
  }
  for (const entry of readdirSync(standardFontsSource, { withFileTypes: true })) {
    if (!entry.isFile() || !(/\.(?:pfb|ttf)$/i.test(entry.name) || entry.name.startsWith("LICENSE_"))) continue;
    copyFileSync(join(standardFontsSource, entry.name), join(standardFontsTarget, entry.name));
  }
  copyFileSync(join(canvasSource, "geometry.js"), join(canvasTarget, "geometry.js"));
}

async function buildIdiExtractionFunction() {
  rmSync(runtimeFunctionsDir, { recursive: true, force: true });
  mkdirSync(runtimeFunctionsDir, { recursive: true });
  await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: [join(__dirname, "server", "idi-extract-handler.js")],
    outfile: join(runtimeFunctionsDir, "idi-extract.cjs"),
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node20"],
    sourcemap: false,
    minify: production,
    legalComments: "eof",
    logLevel: "info",
  });
}

async function compileBeuiFoundation() {
  const proofPath = join(sourceDir, "beui-foundation", "compile-proof.tsx");
  const cssPath = join(sourceDir, "styles", "beui-foundation.css");
  const bundle = await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: [proofPath],
    outfile: "beui-foundation.js",
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
    target: ["es2020"],
    jsx: "automatic",
    tsconfig: join(__dirname, "tsconfig.ui.json"),
    treeShaking: false,
    sourcemap: false,
    minify: production,
    legalComments: "eof",
    logLevel: "silent",
  });
  const css = await postcss([tailwindcss()]).process(readFileSync(cssPath, "utf8"), {
    from: cssPath,
  });
  const bundleBytes = bundle.outputFiles.reduce((total, file) => total + file.contents.byteLength, 0);
  if (!bundleBytes || !css.css.includes(".flex")) {
    throw new Error("BeUI compile proof did not produce JavaScript and Tailwind utility output");
  }
  console.log(`beui foundation compiled in memory (${bundleBytes} JS bytes, ${Buffer.byteLength(css.css)} CSS bytes)`);
}

function assertLocalRuntimeAssets() {
  for (const relativePath of ["index.html", "assets/app.js", "assets/app.css"]) {
    const source = readFileSync(join(distDir, relativePath), "utf8");
    if (forbiddenRuntimeAsset.test(source)) {
      throw new Error(`${relativePath} references a forbidden runtime CDN asset`);
    }
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(path) : entry.isFile() ? [path] : [];
  });
}

function assertNoPublicOperatorData() {
  for (const path of walkFiles(distDir)) {
    const publicPath = relative(distDir, path).split(sep).join("/");
    if (forbiddenPublicOperatorFiles.has(publicPath)) {
      throw new Error(`${publicPath} contains operator data and must be served through an authenticated API route`);
    }
    if (!/\.(?:css|html|js|json|map|md|txt)$/i.test(path)) continue;
    const source = readFileSync(path, "utf8");
    if (forbiddenPublicSeedPatterns.some((pattern) => pattern.test(source))) {
      throw new Error(`${publicPath} contains a forbidden estate seed and cannot be published as a static asset`);
    }
  }
}

async function buildArtifact() {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(assetsDir, { recursive: true });
  copyPdfExtractionRuntime();
  await buildIdiExtractionFunction();

  const registerModules = walkRegisterModules(join(sourceDir, "features"));
  await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: [join(sourceDir, "entry.js")],
    outfile: join(assetsDir, "app.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    tsconfig: join(__dirname, "tsconfig.ui.json"),
    sourcemap: production ? false : "external",
    minify: production,
    legalComments: "eof",
    charset: "utf8",
    plugins: [localizeWebAwesomeAssetsPlugin(), featureDiscoveryPlugin(registerModules)],
    logLevel: "info",
  });
  await compileBeuiFoundation();

  copyFileSync(join(sourceDir, "index.html"), join(distDir, "index.html"));
  copyBrandAssets();
  copyWebAwesomeRuntime();
  writeFileSync(join(assetsDir, "feature-manifest.json"), `${JSON.stringify({
    features: registerModules.map((path) => relative(sourceDir, path).split(sep).join("/")),
  }, null, 2)}\n`);
  assertLocalRuntimeAssets();
  assertNoPublicOperatorData();
  console.log(`artifact built: dist/index.html (${registerModules.length} feature module${registerModules.length === 1 ? "" : "s"})`);
}

buildArtifact().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
