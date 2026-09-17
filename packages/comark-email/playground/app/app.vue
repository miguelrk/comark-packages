<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-packages/tree/main/packages/comark-email'
const DESCRIPTION = 'Comark plugin for email in markdown.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-email` : 'comark-email'),
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
  ogSiteName: 'comark-email',
  ogTitle: 'comark-email · Email renderer for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-email: email support for Comark',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-email · Email renderer for Comark',
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
      comark-email
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
