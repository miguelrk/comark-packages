import type { ElementNode } from 'comark'
import type { JasyComponentFn } from '../jasy.ts'
import { Box, Svg, Text } from '@jasy/pdf'
import { sanitizeSvgLengths } from '../jasy.ts'

export * from 'comark/plugins/math'
export { default } from 'comark/plugins/math'

const sourceText = (content: string) =>
  Text(content, { font: 'Courier', size: 11 })

const sourceBox = (content: string) =>
  Box(
    { bg: '#f6f8fa', padding: 10, radius: 4 },
    [sourceText(content)],
  )

type TexToSvg = (tex: string, display: boolean) => string

let texToSvg: TexToSvg | null | undefined

const loadTexToSvg = async (): Promise<TexToSvg | null> => {
  if (texToSvg !== undefined) return texToSvg
  try {
    const [
      { mathjax },
      { TeX },
      { SVG },
      { liteAdaptor },
      { RegisterHTMLHandler },
      { AllPackages },
    ] = await Promise.all([
      import('mathjax-full/js/mathjax.js'),
      import('mathjax-full/js/input/tex.js'),
      import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'),
      import('mathjax-full/js/handlers/html.js'),
      import('mathjax-full/js/input/tex/AllPackages.js'),
    ])
    const adaptor = liteAdaptor()
    RegisterHTMLHandler(adaptor)
    const html = mathjax.document('', {
      InputJax: new TeX({ packages: AllPackages }),
      OutputJax: new SVG({ fontCache: 'local' }),
    })
    texToSvg = (tex: string, display: boolean) =>
      adaptor.outerHTML(html.convert(tex, { display }))
    return texToSvg
  }
  catch {
    texToSvg = null
    return null
  }
}

const latexToSvg = async (tex: string, display: boolean): Promise<string | null> => {
  if (!tex.trim()) return null
  const convert = await loadTexToSvg()
  if (!convert) return null
  try {
    const svg = convert(tex, display)
    return svg.includes('<svg') ? svg : null
  }
  catch {
    return null
  }
}

export const Math: JasyComponentFn = async ([, attrs]: ElementNode) => {
  const content = String(attrs.content ?? '')
  const isInline = String(attrs.class ?? '').includes('inline')
  const svg = await latexToSvg(content, !isInline)
  if (svg) {
    const drawn = Svg(sanitizeSvgLengths(svg), isInline ? { height: 11 } : {})
    return isInline ? drawn : Box({ bg: '#f6f8fa', padding: 10, radius: 4 }, [drawn])
  }
  return isInline ? sourceText(content) : sourceBox(content)
}
