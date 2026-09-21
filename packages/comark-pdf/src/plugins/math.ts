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
      OutputJax: new SVG({ fontCache: 'none' }),
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
    const html = convert(tex, display)
    const start = html.indexOf('<svg')
    const end = html.lastIndexOf('</svg>')
    if (start < 0 || end < 0) return null
    return html.slice(start, end + '</svg>'.length)
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
    try {
      const drawn = Svg(sanitizeSvgLengths(svg), { height: isInline ? 12 : 36 })
      return isInline ? drawn : Box({ bg: '#f6f8fa', padding: 10, radius: 4 }, [drawn])
    }
    catch {
      // jasy Svg rejects some MathJax markup. The source stays readable.
    }
  }
  return isInline ? sourceText(content) : sourceBox(content)
}
