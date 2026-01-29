declare module "csv-parse/sync" {
  export function parse(
    input: string | Buffer,
    options?: Record<string, unknown>
  ): Record<string, string>[];
}
