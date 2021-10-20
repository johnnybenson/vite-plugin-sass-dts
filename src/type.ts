export type AdditionalData =
  | string
  | ((source: string, filename: string) => string | Promise<string>);

export type PluginOption = {
  allGenerate: boolean;
  global?: { generate: boolean; outFile: string };
};

export type CSS = { localStyle: string; globalStyle?: string };
