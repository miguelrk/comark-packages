<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-packages/tree/main/packages/comark-flint'
const DESCRIPTION =
  'Comark plugin for Flint charts — AST component nodes with a shipped Vue renderer, plus optional parse-time SVG/img for static docs.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-flint` : 'comark-flint'),
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
  ogSiteName: 'comark-flint',
  ogTitle: 'comark-flint · Flint charts for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-flint: a Flint fenced block on the left, the compiled chart Comark renders on the right',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-flint · Flint charts for Comark',
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
      comark-flint
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
      <a href="https://github.com/microsoft/flint-chart">flint-chart ↗</a>
      <a href="https://comark.dev">Comark ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>
