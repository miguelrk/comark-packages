---
seo:
  title: comark-etiket — barcodes and QR codes for Comark
  description: A Comark plugin for etiket barcodes and QR codes. Directives become inline SVG or PNG at parse time — no framework component required.
---

::u-page-hero
---
orientation: horizontal
---
#title
Barcodes and QR codes [at parse time]{.text-primary}

#description
A [Comark](https://comark.dev) plugin for [etiket](https://github.com/productdevbook/etiket) barcodes and QR codes. Directives become inline SVG (or PNG) in the AST — renderer-agnostic output with no special Vue component.

#links
  :::u-button
  ---
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  size: xl
  to: /play
  variant: subtle
  icon: i-lucide-square-play
  ---
  Open the playground
  :::

#default
  ![comark-etiket — barcode and QR codes for Comark](/og.png){.rounded-lg.border.border-default}
::

::u-page-section
#title
What you can do

#features
  :::u-page-feature
  ---
  icon: i-lucide-qr-code
  title: Render QR and 2D symbologies
  description: "qrcode, microqr, rmqr, datamatrix, pdf417, aztec, maxicode, and more — styling via attrs like dot-type and ec-level."
  to: /guide/directives
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-barcode
  title: Encode 1D barcodes and postal
  description: "EAN, Code 128, GS1-128, RM4SCC, KIX, AusPost, and every type etiket supports."
  to: /guide/directives
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-wifi
  title: Use QR helper directives
  description: "WiFi, email, SMS, geo, vCard, Swiss QR Bill, GS1 Digital Link — payload built from attrs."
  to: /guide/qr-helpers
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layout-grid
  title: Generate batch sheets
  description: "barcode-sheet and qr-sheet from child lines or a values= JSON array."
  to: /guide/batch-sheets
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-image
  title: Choose output mode
  description: "Inline svg (default), img with SVG data URI, or png — set per directive or in frontmatter."
  to: /guide/output-modes
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-braces
  title: Bind at render time
  description: "Runtime :value bindings stay in the AST; renderEtiketSvg resolves them in your renderer."
  to: /guide/binding
  ---
  :::
::
