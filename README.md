# comark-packages

Comark plugins and renderers.

## Packages

| Package                                                                              | Kind     | Status  | Description                           |
| ------------------------------------------------------------------------------------ | -------- | ------- | ------------------------------------- |
| [`comark-codemirror`](https://miguelrk.github.io/comark-packages/comark-codemirror/) | editor   | 🟢 done | CodeMirror 6 editor with autocomplete |
| [`comark-etiket`](https://miguelrk.github.io/comark-packages/comark-etiket/)         | plugin   | 🟢 done | Barcode and QR codes via etiket       |
| [`comark-email`](https://miguelrk.github.io/comark-packages/comark-email/)           | renderer | 🟢 done | Email HTML via MJML                   |
| [`comark-pdf`](https://miguelrk.github.io/comark-packages/comark-pdf/)               | renderer | 🟢 done | PDF output via jasy                   |

### Deprecated

| Package                                                                                | Kind   | Status         | Description                        |
| -------------------------------------------------------------------------------------- | ------ | -------------- | ---------------------------------- |
| [`comark-arrow`](https://miguelrk.github.io/comark-packages/comark-arrow/)             | plugin | 🟢 done        | ArrowJS sandboxed widgets          |
| [`comark-flint-chart`](https://miguelrk.github.io/comark-packages/comark-flint-chart/) | plugin | 🟢 done        | Flint charts (Vega-Lite / ECharts) |
| [`comark-kv`](https://miguelrk.github.io/comark-packages/comark-kv/)                   | plugin | 🟡 in-progress | unstorage-backed key-value model   |
| [`comark-vega`](https://miguelrk.github.io/comark-packages/comark-vega/)               | plugin | 🟢 done        | Vega and Vega-Lite charts          |

## Install

```bash
# npm
pnpm add <package>
```

## Development

### Root

- `pnpm install`
- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm generate`

### Package

- `pnpm --dir packages/<package> build`
- `pnpm --dir packages/<package> dev`
- `pnpm --dir packages/<package> play`
- `pnpm --dir packages/<package> docs`
- `pnpm --dir packages/<package> docs:generate`
- `pnpm --dir packages/<package> og:generate`
- `pnpm --dir packages/<package> release`
- `pnpm --dir packages/<package> test`
- `pnpm --dir packages/<package> test:watch`
- `pnpm --dir packages/<package> typecheck`

### Playground

- `pnpm --dir packages/<package>/playground dev`
- `pnpm --dir packages/<package>/playground build`
- `pnpm --dir packages/<package>/playground generate`
- `pnpm --dir packages/<package>/playground preview`
- `pnpm --dir packages/<package>/playground og:generate`
