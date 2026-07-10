import { describe, it, expect } from 'vitest'
import { makeProject, messages } from '../../../_testkit'
import check from './012'

const C = 'frontend/src/$components'
const H = 'frontend/src/$hooks'
const P = 'frontend/src/pages'

describe('FE012 — index.tsx hygiene', () => {
  it('passes for a clean component index', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]: 'export default function Card() {\n  return null\n}\n',
    })
    expect(check(root)).toEqual([])
  })

  it('warns on type declarations in a component index', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]:
        'interface CardProps { title: string }\ntype Variant = "a" | "b"\nexport default function Card(props: CardProps) {\n  return null\n}\n',
    })
    expect(messages(check(root))).toContain(
      'index.tsx declares type(s) CardProps, Variant — move them to types.tsx in the same directory',
    )
  })

  it('warns on extra components in a component index', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]:
        'function CardHeader() {\n  return null\n}\nexport default function Card() {\n  return null\n}\n',
    })
    expect(messages(check(root))).toContain(
      'index.tsx declares extra component(s) CardHeader — move each into its own directory under $components/',
    )
  })

  it('warns on helper functions in a page index', () => {
    const root = makeProject({
      [`${P}/index.tsx`]:
        "export function buildRows() {\n  return []\n}\nconst toLabel = (x: string) => x\nexport default function HomePage() {\n  return null\n}\n",
    })
    expect(messages(check(root))).toContain(
      'index.tsx declares helper function(s) buildRows, toLabel — move them to functions.tsx in the same directory',
    )
  })

  it('warns on hooks declared in a page index', () => {
    const root = makeProject({
      [`${P}/index.tsx`]:
        'function useThing() {\n  return 1\n}\nexport default function HomePage() {\n  return null\n}\n',
    })
    expect(messages(check(root))).toContain(
      'index.tsx declares hook(s) useThing — move each into its own directory under $hooks/',
    )
  })

  it('allows the hook itself but flags components in a hook index', () => {
    const root = makeProject({
      [`${H}/useThing/index.tsx`]:
        'function Spinner() {\n  return null\n}\nexport default function useThing() {\n  return 1\n}\n',
    })
    const msgs = messages(check(root))
    expect(msgs).toContain(
      'index.tsx declares component(s) Spinner — a hook should not define components; move them to a $components/ scope',
    )
    expect(msgs).toHaveLength(1)
  })

  it('warns on extra hooks in a hook index', () => {
    const root = makeProject({
      [`${H}/useThing/index.tsx`]:
        'function useOther() {\n  return 2\n}\nexport default function useThing() {\n  return 1\n}\n',
    })
    expect(messages(check(root))).toContain(
      'index.tsx declares extra hook(s) useOther — give each hook its own directory under a $hooks/',
    )
  })

  it('ignores nested (indented) declarations', () => {
    const root = makeProject({
      [`${C}/Card/index.tsx`]:
        'export default function Card() {\n  const onClick = () => {}\n  function helper() {}\n  return null\n}\n',
    })
    expect(check(root)).toEqual([])
  })
})
