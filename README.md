# comark-packages

Comark plugins and renderers. [Playgrounds](https://miguelrk.github.io/comark-packages/).

## Packages

| Package | Kind | Description |
| --- | --- | --- |
| [`comark-arrow`](https://miguelrk.github.io/comark-packages/comark-arrow/) | plugin | ArrowJS sandboxed widgets |
| [`comark-etiket`](https://miguelrk.github.io/comark-packages/comark-etiket/) | plugin | Barcode and QR codes via etiket |
| [`comark-fetch`](https://miguelrk.github.io/comark-packages/comark-fetch/) | plugin | Frontmatter fetch into meta |
| [`comark-flint`](https://miguelrk.github.io/comark-packages/comark-flint/) | plugin | Flint charts (Vega-Lite / ECharts) |
| [`comark-kv`](https://miguelrk.github.io/comark-packages/comark-kv/) | plugin | unstorage-backed key-value model |
| [`comark-vega`](https://miguelrk.github.io/comark-packages/comark-vega/) | plugin | Vega and Vega-Lite charts |
| [`comark-email`](https://miguelrk.github.io/comark-packages/comark-email/) | renderer | Email HTML via MJML |
| [`comark-pdf`](https://miguelrk.github.io/comark-packages/comark-pdf/) | renderer | PDF output via jasy |

## Development

- `pnpm install`
- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm generate`
- `pnpm --dir packages/<package> build`
- `pnpm --dir packages/<package> dev`
- `pnpm --dir packages/<package> play`
- `pnpm --dir packages/<package> play:nuxt`
- `pnpm --dir packages/<package> og:generate`
- `pnpm --dir packages/<package> release`
- `pnpm --dir packages/<package> test`
- `pnpm --dir packages/<package> test:watch`
- `pnpm --dir packages/<package> typecheck`
- `pnpm --dir packages/<package>/playground dev`
- `pnpm --dir packages/<package>/playground build`
- `pnpm --dir packages/<package>/playground generate`
- `pnpm --dir packages/<package>/playground preview`
- `pnpm --dir packages/<package>/playground og:generate`
