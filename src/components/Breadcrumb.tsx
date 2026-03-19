import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  path?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  const allItems = [{ label: '首页', path: '/' }, ...items]

  return (
    <nav style={{ marginBottom: 24, fontSize: 14, color: 'var(--muted-foreground)' }}>
      {allItems.map((item, index) => (
        <span key={index}>
          {index > 0 && <span style={{ margin: '0 8px' }}>/</span>}
          {item.path ? (
            <Link to={item.path} style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
