export interface PdfMountHandle {
  revoke(): void
}

export const mount = (target: Element, bytes: Uint8Array): PdfMountHandle => {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.src = url
  iframe.title = 'PDF preview'
  iframe.style.cssText = 'width:100%;height:100%;border:none;display:block'

  target.innerHTML = ''
  target.appendChild(iframe)

  return {
    revoke() {
      URL.revokeObjectURL(url)
    },
  }
}
