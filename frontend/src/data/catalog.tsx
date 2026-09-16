import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { COMPARISON, PACKAGES, type Package } from './packages'
import { PRODUCTS, type Product } from './products'

/**
 * 상품 구성(패키지 · 비교표 · 표준 제품)을 서버에서 읽는다.
 *
 * 값은 관리자 화면에서 고치고 DB 에 있다. 다만 이 화면은 구성표가 없으면 아무 말도 못 하므로,
 * 번들에 들어 있는 상수로 먼저 그리고 응답이 오면 갈아 끼운다.
 * 잠깐 옛 가격이 보이는 편이 빈 화면보다 낫다.
 */

type Catalog = {
  packages: Package[]
  comparison: { label: string; values: (number | string)[] }[]
  products: Product[]
  findPackage: (code: string | null | undefined) => Package | undefined
  /** 서버 값으로 바뀌었는지. 화면에서 쓸 일은 없고 점검용. */
  live: boolean
}

type ApiPackage = Package & { active?: boolean; sortOrder?: number }
type ApiCatalog = {
  packages: ApiPackage[]
  comparison: { label: string; values: (number | string)[] }[]
  products: (Product & { fromPackage?: string })[]
}

const FALLBACK: Omit<Catalog, 'findPackage'> = {
  packages: PACKAGES,
  comparison: COMPARISON,
  products: PRODUCTS,
  live: false,
}

const CatalogContext = createContext<Catalog | null>(null)

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(FALLBACK)

  useEffect(() => {
    let alive = true
    fetch('/api/catalog', { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: ApiCatalog) => {
        if (!alive || !data?.packages?.length) return
        setState({
          packages: data.packages,
          comparison: (data.comparison ?? []).map((r) => ({ label: r.label, values: r.values ?? [] })),
          products: (data.products ?? []).map((p) => ({ ...p, from: p.fromPackage ?? p.from })),
          live: true,
        })
      })
      .catch(() => {
        // 번들 상수로 그대로 둔다
      })
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<Catalog>(
    () => ({
      ...state,
      findPackage: (code) => (code ? state.packages.find((p) => p.code === code) : undefined),
    }),
    [state],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog(): Catalog {
  const ctx = useContext(CatalogContext)
  if (ctx) return ctx
  // Provider 밖에서 불러도 화면이 깨지지 않게 상수로 답한다.
  return {
    ...FALLBACK,
    findPackage: (code) => (code ? PACKAGES.find((p) => p.code === code) : undefined),
  }
}
