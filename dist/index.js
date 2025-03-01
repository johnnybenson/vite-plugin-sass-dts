var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/index.ts
import prettier2 from "prettier";
import { createFilter } from "vite";

// src/main.ts
import fs2 from "fs";
import { parse } from "postcss";
import { objectify } from "postcss-js";

// src/util.ts
import path from "node:path";
var cssLangs = `\\.(css|pcss|sass|scss)($|\\?)`;
var cssLangReg = new RegExp(cssLangs);
var cssModuleReg = new RegExp(`\\.module${cssLangs}`);
var importCssRE = /@import ('[^']+\.css'|"[^"]+\.css"|[^'")]+\.css)/;
var sameDirRE = /^[./]/;
var isCSSModuleRequest = (request) => cssModuleReg.test(request);
var getRelativePath = (from, to) => {
  let relativePath = path.relative(from || "", to || "") || "./";
  if (path.sep !== "/") {
    relativePath = relativePath.replaceAll(path.sep, "/");
  }
  relativePath = sameDirRE.test(relativePath) ? relativePath : `./${relativePath}`;
  return !relativePath.endsWith("/") ? `${relativePath}/` : relativePath;
};
var toDashCase = (target) => target.replace(/[-_ /~ . ][A-z0-9]/g, (v) => {
  return "-" + v.slice(1);
}).toLowerCase();
var toCamelCase = (target) => target.replace(/^[A-Z]/, (m) => m.toLowerCase()).replace(/[-_ ./~ ]+([A-z0-9])/g, (m, $1) => $1.toUpperCase());
var isSassException = (e) => typeof e === "object" && !!e && "file" in e;
var collectionToObj = (collection) => {
  return collection.reduce((acc, item) => {
    return { ...acc, ...item };
  }, {});
};

// src/options.ts
var getParseCase = (config) => {
  if (!config.css || !config.css.modules || !config.css.modules.localsConvention) {
    return;
  }
  const { localsConvention } = config.css.modules;
  if (localsConvention === "camelCase" || localsConvention === "camelCaseOnly") {
    return toCamelCase;
  } else if (localsConvention === "dashes" || localsConvention === "dashesOnly") {
    return toDashCase;
  }
  return;
};
var getPreprocessorOptions = (config) => {
  let additionalData, includePaths, importer;
  if (!config.css || !config.css.preprocessorOptions || !config.css.preprocessorOptions.scss) {
    return {
      additionalData,
      includePaths,
      importer,
      alias: config.resolve.alias
    };
  }
  return config.css.preprocessorOptions.scss;
};

// src/css.ts
import { createRequire } from "node:module";
import { normalizePath } from "vite";
import path2 from "path";
import fs from "fs";
import { pathToFileURL } from "node:url";
var SPLIT_STR = `/* vite-plugin-sass-dts */
`;
var loadedSassPreprocessor;
var _require = import.meta.url ? createRequire(import.meta.url) : __require;
var parseCss = async (file, fileName, config) => {
  const sass = loadSassPreprocessor(config);
  const options = getPreprocessorOptions(config);
  const resolveFn = config.createResolver({
    extensions: [".scss", ".sass", ".pcss", ".css"],
    mainFields: ["sass", "style"],
    tryIndex: true,
    tryPrefix: "_",
    preferRelative: true
  });
  const internalImporter = (url, importer, done) => {
    resolveFn(url, importer).then((resolved) => {
      if (resolved) {
        rebaseUrls(resolved, fileName, config.resolve.alias, "$").then(done).catch(done);
      } else {
        done && done(null);
      }
    });
  };
  const data = await getData(file.toString(), fileName, options.additionalData);
  const finalImporter = [];
  if (options.api !== "modern" && options.api !== "modern-compiler") {
    if (options.importer) {
      Array.isArray(options.importer) ? finalImporter.push(...options.importer) : finalImporter.push(options.importer);
    }
    finalImporter.push(internalImporter);
    const result = await new Promise((resolve, reject) => {
      sass.render(
        {
          ...options,
          data,
          pkgImporter: new sass.NodePackageImporter(),
          file: fileName,
          includePaths: ["node_modules"],
          importer: finalImporter,
          indentedSyntax: fileName.endsWith(".sass")
        },
        (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        }
      );
    });
    const splitted = result.css.toString().split(SPLIT_STR);
    return { localStyle: splitted[1] || "", globalStyle: splitted[0] };
  } else {
    if (options.importers) {
      Array.isArray(options.importers) ? finalImporter.push(...options.importers) : finalImporter.push(options.importers);
    }
    const sassOptions = { ...options };
    sassOptions.url = pathToFileURL(fileName);
    sassOptions.pkgImporter = new sass.NodePackageImporter();
    sassOptions.importers = finalImporter;
    const result = await sass.compileStringAsync(data, sassOptions);
    const splitted = result.css.toString().split(SPLIT_STR);
    return { localStyle: splitted[1] || "", globalStyle: splitted[0] };
  }
};
var getData = (data, filename, additionalData) => {
  if (!additionalData) return `
${SPLIT_STR}${data}`;
  if (typeof additionalData === "function") {
    return additionalData(`
${SPLIT_STR}${data}`, filename);
  }
  return `${additionalData}
${SPLIT_STR}${data}`;
};
var loadSassPreprocessor = (config) => {
  try {
    if (loadedSassPreprocessor) {
      return loadedSassPreprocessor;
    }
    const fallbackPaths = _require.resolve.paths?.("sass-embedded") || [];
    const resolved = _require.resolve("sass-embedded", {
      paths: [config.root, ...fallbackPaths]
    });
    return loadedSassPreprocessor = _require(resolved);
  } catch (e) {
    console.error(e);
    throw new Error(
      `Preprocessor dependency 'sass' not found. Did you install it?`
    );
  }
};
var rebaseUrls = async (file, rootFile, alias, variablePrefix) => {
  file = path2.resolve(file);
  const fileDir = path2.dirname(file);
  const rootDir = path2.dirname(rootFile);
  if (fileDir === rootDir) {
    return { file };
  }
  const content = fs.readFileSync(file, "utf-8");
  const hasImportCss = importCssRE.test(content);
  if (!hasImportCss) {
    return { file };
  }
  let rebased;
  const rebaseFn = (url) => {
    if (url.startsWith("/")) return url;
    if (url.startsWith(variablePrefix)) return url;
    for (const { find } of alias) {
      const matches = typeof find === "string" ? url.startsWith(find) : find.test(url);
      if (matches) {
        return url;
      }
    }
    const absolute = path2.resolve(fileDir, url);
    const relative = path2.relative(rootDir, absolute);
    return normalizePath(relative);
  };
  if (hasImportCss) {
    rebased = await rewriteImportCss(content, rebaseFn);
  }
  return {
    file,
    contents: rebased
  };
};
var rewriteImportCss = (css, replacer) => {
  return asyncReplace(css, importCssRE, async (match) => {
    const [matched, rawUrl] = match;
    return await doImportCSSReplace(rawUrl, matched, replacer);
  });
};
var asyncReplace = async (input, re, replacer) => {
  let match;
  let remaining = input;
  let rewritten = "";
  while (match = re.exec(remaining)) {
    rewritten += remaining.slice(0, match.index);
    rewritten += await replacer(match);
    remaining = remaining.slice(match.index + match[0].length);
  }
  rewritten += remaining;
  return rewritten;
};
var doImportCSSReplace = async (rawUrl, matched, replacer) => {
  let wrap = "";
  const first = rawUrl[0];
  if (first === `"` || first === `'`) {
    wrap = first;
    rawUrl = rawUrl.slice(1, -1);
  }
  if (isExternalUrl(rawUrl) || isDataUrl(rawUrl) || rawUrl.startsWith("#")) {
    return matched;
  }
  return `@import ${wrap}${await replacer(rawUrl)}${wrap}`;
};
var externalRE = /^(https?:)?\/\//;
var isExternalUrl = (url) => externalRE.test(url);
var dataUrlRE = /^\s*data:/i;
var isDataUrl = (url) => dataUrlRE.test(url);

// src/extract.ts
var importRe = new RegExp(/^(@import|@apply)/);
var supportRe = new RegExp(/^(@support)/);
var keySeparatorRe = new RegExp(/(?=[\s.:[\]><+,()])/g);
var extractClassNameKeys = (obj, toParseCase, parentKey) => {
  return Object.entries(obj).reduce(
    (curr, [key, value]) => {
      if (importRe.test(key)) return curr;
      const splitKeys = key.split(keySeparatorRe);
      if (!supportRe.test(key)) {
        for (const splitKey of splitKeys) {
          if (parentKey === ":export" || splitKey.startsWith(".")) {
            if (toParseCase) {
              curr.set(toParseCase(splitKey.replace(".", "").trim()), true);
            } else {
              curr.set(splitKey.replace(".", "").trim(), true);
            }
          }
        }
      }
      if (typeof value === "object" && Object.keys(value).length > 0) {
        const valueToExtract = Array.isArray(value) ? collectionToObj(value) : value;
        const map = extractClassNameKeys(valueToExtract, toParseCase, key);
        for (const key2 of map.keys()) {
          if (toParseCase) {
            curr.set(toParseCase(key2), true);
          } else {
            curr.set(key2, true);
          }
        }
      }
      return curr;
    },
    /* @__PURE__ */ new Map()
  );
};

// src/write.ts
import { writeFile } from "node:fs";
import { dirname, basename, isAbsolute } from "node:path";
import prettier from "prettier";
import path3 from "path";
import { mkdir } from "node:fs/promises";
var { format } = prettier;
var writeToFile = async (prettierOptions, fileName, classNameKeys, options) => {
  const typeName = getTypeName(path3.basename(fileName), options);
  let exportTypes = "";
  let namedExports = "";
  const exportStyle = options?.esmExport ? "export default classNames;" : "export = classNames;";
  for (const classNameKey of classNameKeys.keys()) {
    exportTypes = `${exportTypes}
${formatExportType(classNameKey, typeName)}`;
    namedExports = `${namedExports}
export const ${classNameKey}: '${typeName ?? classNameKey}';`;
  }
  let outputFileString = "";
  if (options?.global?.outputFilePath) {
    const relativePath = getRelativePath(
      dirname(fileName),
      dirname(options.global.outputFilePath)
    );
    const exportTypeFileName = formatExportTypeFileName(
      options.global.outputFilePath
    );
    outputFileString = `import globalClassNames from '${relativePath}${exportTypeFileName}'
`;
    outputFileString = `declare const classNames: typeof globalClassNames & {${exportTypes}
};
${exportStyle}`;
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}
${namedExports}

`;
    }
  } else {
    outputFileString = `declare const classNames: {${exportTypes}
};
${exportStyle}`;
    if (options?.useNamedExport) {
      outputFileString = `${outputFileString}

${namedExports}`;
    }
  }
  let output = outputFileString;
  if (options?.skipPrettier) {
    output = await format(
      outputFileString,
      prettierOptions
    );
  }
  const writePath = formatWriteFilePath(fileName, options);
  await ensureDirectoryExists(writePath);
  writeFile(writePath, `${output}`, (err) => {
    if (err) {
      console.log(err);
      throw err;
    }
  });
};
var getTypeName = (fileName, options) => {
  if (options && options.typeName && options.typeName.replacement) {
    if (typeof options.typeName.replacement === "function") {
      return options.typeName.replacement(fileName);
    } else {
      return options.typeName.replacement;
    }
  }
  return void 0;
};
var formatExportType = (key, type = `'${key}'`) => `  readonly '${key}': ${type};`;
var formatWriteFilePath = (file, options) => {
  let path4 = file;
  const src = options?.sourceDir;
  const dist = options?.outputDir;
  if (src && !isAbsolute(src)) {
    throw new Error("vite-plugin-sass-dts sourceDir must be an absolute path");
  }
  if (dist && !isAbsolute(dist)) {
    throw new Error("vite-plugin-sass-dts outputDir must be an absolute path");
  }
  if (src && dist) {
    path4 = path4.replace(src, dist);
  }
  return formatWriteFileName(path4);
};
var formatWriteFileName = (file) => `${file}${file.endsWith("d.ts") ? "" : ".d.ts"}`;
var formatExportTypeFileName = (file) => basename(file.replace(".ts", ""));
var ensureDirectoryExists = async (file) => {
  await mkdir(dirname(file), { recursive: true });
};

// src/main.ts
var main = (fileName, config, option) => {
  try {
    fs2.readFile(fileName, async (err, file) => {
      if (err) {
        console.error(err);
      } else {
        try {
          const css = fileName.endsWith(".css") ? { localStyle: file.toString() } : await parseCss(file, fileName, config);
          const toParseCase = getParseCase(config);
          const classNameKeys = extractClassNameKeys(
            objectify(parse(css.localStyle)),
            toParseCase
          );
          writeToFile(config.prettierOptions, fileName, classNameKeys, option);
          if (!!css.globalStyle && option.global?.generate) {
            const globalClassNameKeys = extractClassNameKeys(
              objectify(parse(css.globalStyle)),
              toParseCase
            );
            writeToFile(
              config.prettierOptions,
              option.global.outputFilePath,
              globalClassNameKeys,
              { esmExport: option.esmExport }
            );
          }
        } catch (e) {
          if (isSassException(e)) {
            if (e.name !== fileName) {
              console.error("e :>> ", e);
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("e :>> ", e);
  }
};

// src/index.ts
var { resolveConfig } = prettier2;
function Plugin(option = {}) {
  let cacheConfig;
  let filter;
  const enabledMode = option.enabledMode || ["development"];
  return {
    name: "vite-plugin-sass-dts",
    async configResolved(config) {
      filter = createFilter(void 0, option.excludePath);
      const prettierOptions = await resolveConfig(option.prettierFilePath || config.root) || {};
      cacheConfig = {
        ...config,
        prettierOptions: { ...prettierOptions, filepath: "*.d.ts" }
      };
    },
    handleHotUpdate(context) {
      if (!isCSSModuleRequest(context.file) || !filter(context.file)) return;
      main(context.file, cacheConfig, option);
      return;
    },
    transform(code, id) {
      const fileName = id.replace(/(?:\?|&)(used|direct|inline|vue).*/, "");
      if (!enabledMode.includes(cacheConfig.env.MODE) || !isCSSModuleRequest(fileName) || !filter(id)) {
        return void 0;
      }
      return new Promise(
        (resolve) => resolve(main(fileName, cacheConfig, option))
      );
    },
    watchChange(id) {
      if (isCSSModuleRequest(id) && filter(id)) {
        this.addWatchFile(id);
      }
    }
  };
}
export {
  Plugin as default
};
