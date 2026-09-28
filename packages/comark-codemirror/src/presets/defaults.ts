/**
 * comark's default plugins, registered unless `registerDefaultPlugins: false`.
 */
import type { EditorPlugin } from '../types.ts'
import alert from '../plugins/alert.ts'
import attributes from '../plugins/attributes.ts'
import components from '../plugins/components.ts'
import frontmatter from '../plugins/frontmatter.ts'
import html from '../plugins/html.ts'
import taskList from '../plugins/task-list.ts'

export const defaultPlugins = (): EditorPlugin[] => [alert(), attributes(), components(), frontmatter(), html(), taskList()]
