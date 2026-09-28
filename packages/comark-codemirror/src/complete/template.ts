/**
 * Insert templates use TextMate-style stops (`$0`, `$1`, `${1:text}`) with
 * literal braces, because Comark is full of `{…}`. CodeMirror's `snippet()`
 * treats every brace as a field, so templates are converted here.
 */

/** Convert a template to CodeMirror snippet syntax (literal braces escaped, `$n` → `${n}`). */
export function toSnippet(template: string): string {
  let out = ''
  let hasStop = false
  for (let i = 0; i < template.length; i++) {
    const c = template[i]!
    if (c === '$' && template[i + 1] === '{') {
      const close = template.indexOf('}', i + 2)
      const body = close < 0 ? '' : template.slice(i + 2, close)
      if (close >= 0 && /^\d+(?::[^{}]*)?$/.test(body)) {
        out += `\${${body}}`
        hasStop = true
        i = close
        continue
      }
    }
    if (c === '$' && /\d/.test(template[i + 1] ?? '')) {
      let j = i + 1
      while (/\d/.test(template[j] ?? '')) j++
      out += `\${${template.slice(i + 1, j)}}`
      hasStop = true
      i = j - 1
      continue
    }
    if (c === '{' || c === '}') out += `\\${c}`
    else out += c
  }
  return hasStop ? out : `${out}\${0}`
}

/** The text a template inserts (stops removed, placeholder text kept). */
export function templateText(template: string): string {
  return template.replace(/\$\{\d+(?::([^{}]*))?\}/g, (_, t: string | undefined) => t ?? '').replace(/\$\d+/g, '')
}
