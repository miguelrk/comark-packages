<script setup lang="ts">
const GITHUB_URL = 'https://github.com/miguelrk/comark-kv'
const DESCRIPTION =
  'Comark plugin for unstorage-backed key-value state with two-way kv.* model binding.'

useHead({
  titleTemplate: (title) => (title ? `${title} · comark-kv` : 'comark-kv'),
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
  ogSiteName: 'comark-kv',
  ogTitle: 'comark-kv · KV for Comark',
  ogDescription: DESCRIPTION,
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'comark-kv: unstorage-backed kv.* model binding for Comark',
  twitterCard: 'summary_large_image',
  twitterTitle: 'comark-kv · KV for Comark',
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
      comark-kv
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
      <a href="https://unstorage.unjs.io">unstorage ↗</a>
      <a href="https://comark.dev">Comark ↗</a>
    </nav>
  </header>

  <NuxtPage />
</template>
