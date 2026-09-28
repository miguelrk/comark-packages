---
seo:
  title: comark-email — Email renderer for Comark
  description: Convert Markdown to responsive, MJML-compiled HTML for email clients. Node-only server rendering.
---

::u-page-hero
---
orientation: horizontal
---
#title
Convert Comark to [email HTML]{.text-primary}

#description
Email renderer for [Comark](https://comark.dev). Turn Markdown into responsive, MJML-compiled HTML — subject, preview text, plain-text fallback and layout components included.

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
  ::og-image{alt="comark-email — Email renderer for Comark"}
  ::
::

::u-page-section
#title
What you can do

#features
  :::u-page-feature
  ---
  icon: i-lucide-mail
  title: Render to HTML
  description: One call returns `html`, `text`, `subject` and `previewText` ready for your email provider.
  to: /getting-started/usage
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-layout-template
  title: MJML layout
  description: Email components map to native MJML tags — buttons, columns and dividers with MJML attributes.
  to: /guide/components
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-settings-2
  title: Frontmatter config
  description: Subject, preview text, brand color and theme merge from frontmatter and renderer options.
  to: /guide/frontmatter
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-languages
  title: Locale files
  description: Hosts pick one markdown file per locale. Bind only the locale key each file owns.
  to: /guide/locale-files
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-puzzle
  title: Comark plugins
  description: Pass plugins and components from `comark` or `@comark/html`. Unknown components wrap in `mj-raw`.
  to: /guide/plugins
  ---
  :::

  :::u-page-feature
  ---
  icon: i-lucide-book-open
  title: Subpath exports
  description: `comark-email/render` and `comark-email/config` for lower-level MJML and config helpers.
  to: /reference/exports
  ---
  :::
::
