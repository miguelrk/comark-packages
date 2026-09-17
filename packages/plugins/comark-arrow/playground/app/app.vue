<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-arrow'
const DESCRIPTION =
  'Comark plugin for ArrowJS sandboxed widgets — agent-authored UI with no upfront registration.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-arrow` : 'comark-arrow'),
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
  ogSiteName: 'comark-arrow',
  ogTitle: 'comark-arrow · ArrowJS sandboxes for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-arrow: a fenced Arrow block becomes a live sandboxed widget',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-arrow · ArrowJS sandboxes for Comark',
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
      comark-arrow
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
      <a href="https://comark.dev">Comark ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>
