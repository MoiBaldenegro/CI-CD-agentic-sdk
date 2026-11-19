# Aurora DS — Design system de la Plataforma Aurora

Documentación web del sistema de diseño de uno de nuestros productos, construida con **Astro 7**. Incluye fundamentos, componentes y patrones de producto con tokens en CSS y tema claro/oscuro.

## Estructura

```text
/
├── public/
│   ├── favicon.svg
│   └── tokens.json          # Export de tokens para diseño y tooling
├── src/
│   ├── components/          # Button, Badge, Card, Input, Alert, Demo…
│   ├── layouts/
│   │   └── Base.astro       # Shell: sidebar, topbar, TOC, tema, búsqueda
│   ├── pages/
│   │   ├── index.astro      # Visión general del sistema
│   │   ├── fundamentos/     # Colores, tipografía, espaciado y layout
│   │   ├── componentes/     # Botones, formularios, tarjetas, feedback
│   │   ├── patrones.astro   # Dashboard, ajustes, tabla, onboarding
│   │   └── recursos.astro   # Instalación, tokens, versionado, changelog
│   └── styles/
│       ├── tokens.css       # Primitivos + semánticos (light/dark)
│       └── global.css       # Reset, utilidades y bloques de ejemplo
└── package.json
```

## Comandos

| Comando                | Acción                                    |
| :--------------------- | :---------------------------------------- |
| `pnpm install`         | Instala dependencias                      |
| `pnpm dev`             | Servidor de desarrollo en `localhost:4321` |
| `pnpm build`           | Genera el sitio estático en `./dist/`     |
| `pnpm preview`         | Sirve el build localmente                 |
| `pnpm astro check`     | Valida tipos y componentes `.astro`       |

## Flujo de tokens

1. Los **primitivos** (`--ds-violet-600`, `--ds-gray-100`…) fijan valores crudos.
2. Los **semánticos** (`--ds-color-primary`, `--ds-color-surface`…) expresan intención y se adaptan en `[data-theme="dark"]`.
3. Los **componentes** consumen solo la capa semántica. Nunca valores hex directos.

`public/tokens.json` mantiene la misma información en formato JSON para Figma, Style Dictionary o scripts.

## Accesibilidad

- Pares de contraste revisados para AA en ambos temas.
- Foco visible con `:focus-visible` en todos los controles.
- Navegación por teclado en sidebar, búsqueda y editor.
- `prefers-reduced-motion` respetado en el CSS global.
