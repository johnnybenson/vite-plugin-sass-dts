import { Plugin as Plugin$1 } from 'vite';

type PluginOptions = {
    enabledMode?: ('development' | 'production')[];
    global?: {
        generate: boolean;
        outputFilePath: string;
    };
    typeName?: {
        replacement: string | ((fileName: string) => string);
    };
    esmExport?: boolean;
    outputDir?: string;
    sourceDir?: string;
    excludePath?: string | RegExp | Array<string | RegExp>;
    skipPrettier?: boolean;
    prettierFilePath?: string;
    useNamedExport?: boolean;
};

declare function Plugin(option?: PluginOptions): Plugin$1;

export { Plugin as default };
