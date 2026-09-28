/**
 * Math: `$inline$` and `$$ display $$` LaTeX. Completes KaTeX commands with
 * their symbol after `\` inside math.
 */
import type { Item } from '../types.ts'
import { definePlugin } from '../plugins.ts'

/** Common KaTeX commands: `[command, glyph, template?]`. */
export const LATEX: readonly (readonly [string, string, string?])[] = [
  ['frac', '½', '\\frac{$1}{$2}'], ['sqrt', '√', '\\sqrt{$1}'], ['sum', '∑', '\\sum_{$1}^{$2}'], ['prod', '∏', '\\prod_{$1}^{$2}'], ['int', '∫', '\\int_{$1}^{$2}'],
  ['lim', 'lim', '\\lim_{$1 \\to $2}'], ['infty', '∞'], ['partial', '∂'], ['nabla', '∇'], ['cdot', '·'], ['times', '×'], ['div', '÷'], ['pm', '±'], ['mp', '∓'],
  ['leq', '≤'], ['geq', '≥'], ['neq', '≠'], ['approx', '≈'], ['equiv', '≡'], ['sim', '∼'], ['propto', '∝'], ['in', '∈'], ['notin', '∉'], ['subset', '⊂'],
  ['subseteq', '⊆'], ['cup', '∪'], ['cap', '∩'], ['emptyset', '∅'], ['forall', '∀'], ['exists', '∃'], ['neg', '¬'], ['land', '∧'], ['lor', '∨'],
  ['to', '→'], ['rightarrow', '→'], ['leftarrow', '←'], ['Rightarrow', '⇒'], ['Leftrightarrow', '⇔'], ['mapsto', '↦'], ['ldots', '…'], ['cdots', '⋯'],
  ['alpha', 'α'], ['beta', 'β'], ['gamma', 'γ'], ['delta', 'δ'], ['epsilon', 'ε'], ['zeta', 'ζ'], ['eta', 'η'], ['theta', 'θ'], ['lambda', 'λ'], ['mu', 'μ'],
  ['pi', 'π'], ['rho', 'ρ'], ['sigma', 'σ'], ['tau', 'τ'], ['phi', 'φ'], ['chi', 'χ'], ['psi', 'ψ'], ['omega', 'ω'], ['Gamma', 'Γ'], ['Delta', 'Δ'],
  ['Theta', 'Θ'], ['Lambda', 'Λ'], ['Pi', 'Π'], ['Sigma', 'Σ'], ['Phi', 'Φ'], ['Omega', 'Ω'], ['mathbb', 'ℝ', '\\mathbb{$1}'], ['mathbf', '𝐁', '\\mathbf{$1}'],
  ['mathrm', 'R', '\\mathrm{$1}'], ['text', 'T', '\\text{$1}'], ['hat', 'â', '\\hat{$1}'], ['bar', 'ā', '\\bar{$1}'], ['vec', '→', '\\vec{$1}'], ['overline', '‾', '\\overline{$1}'],
  ['left', '(', '\\left($1\\right)'], ['begin', '⊞', '\\begin{${1:matrix}}\n$2\n\\end{${1:matrix}}'], ['binom', '()', '\\binom{$1}{$2}'], ['log', 'log'], ['ln', 'ln'],
  ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['exp', 'exp'], ['max', 'max'], ['min', 'min'],
]

export default definePlugin(() => ({
  name: 'math',
  fences: ['math', 'latex'],
  completions: [{
    kinds: ['math'],
    provide: () => LATEX.map(([cmd, glyph, template]): Item => ({ label: `\\${cmd}`, insert: template ?? `\\${cmd}`, glyph, type: 'math' })),
  }],
  snippets: [
    { label: 'Math block', insert: '$$\n$0\n$$', detail: '$$', section: 'Math', type: 'math' },
    { label: 'math', insert: '$$0$', context: 'inline', detail: '$x$', type: 'math' },
  ],
  llms: 'Math: inline `$x^2$`, display `$$` on their own lines around LaTeX (KaTeX).',
}))
