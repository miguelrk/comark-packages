<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-etiket'
const DESCRIPTION =
  'Comark plugin that turns barcode and QR code directives into inline SVG (or PNG) at parse time with etiket.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-etiket` : 'comark-etiket'),
})

const config = useRuntimeConfig()
const siteUrl = String(
  import.meta.dev
    ? useRequestURL().origin
    : (config.public.siteUrl || useRequestURL().origin),
).replace(/\/$/, '')

useSeoMeta({
  description: DESCRIPTION,
  ogType: 'website',
  ogSiteName: 'comark-etiket',
  ogTitle: 'comark-etiket · Barcode & QR codes for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-etiket: barcode and QR code directives rendered as inline SVG at parse time',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-etiket · Barcode & QR codes for Comark',
  twitterDescription: DESCRIPTION,
  twitterImage: `${siteUrl}/og.png`,
})
</script>

<template>
  <header class="masthead">
    <NuxtLink
      class="brand"
      to="/"
    >
      comark-etiket
    </NuxtLink>
    <nav
      class="tabs"
      aria-label="Pages"
    >
      <NuxtLink
        to="/"
        exact-active-class="active"
      >
        Docs
      </NuxtLink>
      <NuxtLink
        to="/play"
        exact-active-class="active"
      >
        Playground
      </NuxtLink>
    </nav>
    <nav class="links">
      <a :href="GITHUB_URL">GitHub ↗</a>
      <a href="https://etiket.productdevbook.com">etiket ↗</a>
      <a href="https://comark.dev">Comark ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>
