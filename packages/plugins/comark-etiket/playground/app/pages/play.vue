<script setup lang="ts">
import etiket from 'comark-etiket'

useHead({ title: 'Playground' })

const markdown = ref(`# Etiket Barcode & QR Plugin

Codes are generated at parse time — no runtime component needed.

## QR Code (styled with dot-type)

::qrcode{value="https://comark.dev" dot-type="dots" ec-level="H"}
::

## QR Code as PNG img

::qrcode{value="https://github.com/comarkdown/comark" output="png"}
::

## EAN-13 Barcode

::barcode{value="4006381333931" type="ean13" show-text="true"}
::

## WiFi QR Helper

::qr-wifi{ssid="GuestNetwork" password="Welcome123"}
::

## vCard QR Helper

::qr-vcard{first-name="Ada" last-name="Lovelace" email="ada@example.com" url="https://en.wikipedia.org/wiki/Ada_Lovelace"}
::
`)

const debouncedMarkdown = ref(markdown.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(markdown, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debouncedMarkdown.value = value), 120)
})

const plugins = [etiket()]
</script>

<template>
  <main class="workbench">
    <section class="inputs">
      <label class="field">
        <span class="label">Markdown <small>etiket directives · rendered at parse time</small></span>
        <textarea v-model="markdown" rows="32" spellcheck="false" />
      </label>
    </section>

    <section class="output">
      <div class="toolbar" role="group" aria-label="Output">
        <span class="status">preview</span>
      </div>
      <div class="document prose">
        <Markdown :value="debouncedMarkdown" :plugins="plugins" />
      </div>
    </section>
  </main>
</template>
