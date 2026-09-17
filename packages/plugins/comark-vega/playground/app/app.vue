<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-vega'
const DESCRIPTION =
  'Comark plugin for Vega and Vega-Lite charts — AST component nodes with a shipped Vue renderer, plus optional parse-time SVG/img for static docs.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-vega` : 'comark-vega'),
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
  ogSiteName: 'comark-vega',
  ogTitle: 'comark-vega · Vega charts for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-vega: a Vega-Lite fenced block on the left, the chart Comark renders on the right',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-vega · Vega charts for Comark',
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
      comark-vega
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
      <a href="https://vega.github.io/vega-lite/">Vega-Lite ↗</a>
      <a href="https://comark.dev">Comark ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>
