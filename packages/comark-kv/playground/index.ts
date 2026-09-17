import { parseMarkdown } from 'comark'
import kv, { isSingleDriverSchema } from '../src/index.ts'
import { createKvModel } from '../src/model/index.ts'

/**
 * Todo desk — one document, three drivers:
 * config (browser→memory in CLI) · draft (memory) · todos (http shortcut)
 */
const content = `---
title: Todo desk
kv:
  config:
    driver: memory
    mount: user-config
    default:
      name: Ada
      dark: false
  draft:
    driver: memory
    mount: compose
    default:
      todo: ""
      completed: false
  todos: https://jsonplaceholder.typicode.com/todos?_limit=5&_sort=id&_order=desc
---

# Todo desk
`

const tree = await parseMarkdown(content, { plugins: [kv()] })
console.log('meta.kv:', tree.meta.kv)
console.log('isSingleDriverSchema:', isSingleDriverSchema(tree.meta.kv!))

if (tree.meta.kv) {
  const { model, ready, dispose, storages } = await createKvModel(tree.meta.kv)
  await ready
  console.log('kv.config.name:', model.get('kv.config.name'))
  console.log('kv.config.dark:', model.get('kv.config.dark'))
  console.log('kv.draft.todo:', model.get('kv.draft.todo'))
  const todos = model.get('kv.todos')
  console.log('kv.todos:', Array.isArray(todos) ? `array(${todos.length})` : todos)
  if (Array.isArray(todos) && todos[0]) {
    console.log('kv.todos.0.title:', model.get('kv.todos.0.title'))
  }
  console.log('storages:', Object.keys(storages))
  dispose()
}
