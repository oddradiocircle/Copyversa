# Cómo contribuir

Gracias por ayudar a mejorar CopyVersa. Esta guía explica cómo reportar problemas, proponer cambios y publicar versiones.

## Reportar un problema

Abre un [issue](https://github.com/oddradiocircle/Copyversa/issues/new/choose) con la plantilla de error. Indica el navegador, la forma de instalación y el formato que usabas.

**No compartas datos confidenciales.** Si el problema ocurre en un sistema con información reservada (expedientes, datos personales, sistemas internos), describe la estructura de la página o crea un ejemplo con datos ficticios.

## Preparar el entorno

Necesitas Node.js 22 o superior.

```bash
npm install
npx playwright install chromium   # solo para las pruebas de extremo a extremo
npm run dev                        # recompila dist/ con cada cambio
```

Para probar tus cambios en el navegador:

- **Userscript:** en Tampermonkey, crea un script nuevo y pega el contenido de `dist/copyversa.user.js`. Desactiva antes la versión instalada.
- **Extensión:** en `chrome://extensions`, pulsa **Cargar descomprimida**, elige `dist/extension` y pulsa el botón de recargar después de cada compilación.

## Estructura

```
src/
  core/         Captura, limpieza y conversión del contenido. No depende de la interfaz.
  ui/           Panel, resaltado y avisos, dentro de un shadow root.
  app.js        Comportamiento: selección, teclado, copia y preferencias.
  clipboard.js  Escritura en el portapapeles.
  settings.js   Preferencias y atajos.
  i18n.js       Textos en español e inglés.
  userscript.js Punto de entrada del userscript.
  extension/    Manifiesto y puntos de entrada de la extensión.
scripts/        Compilación, iconos y captura del README.
test/unit/      Pruebas del núcleo con Vitest y jsdom.
test/e2e/       Pruebas en Chromium con Playwright.
```

## Enviar cambios

1. Crea una rama desde `main`: `feat/<tema>`, `fix/<tema>` o `docs/<tema>`.
2. Añade o ajusta pruebas para lo que cambias.
3. Ejecuta `npm run check` y corrige lo que falle.
4. Escribe los commits con el formato `<tipo>(<alcance>): <descripción>`. Los tipos son `feat`, `fix`, `docs`, `style`, `refactor`, `test` y `chore`. Por ejemplo: `fix(tables): keep empty header cells`.
5. Anota el cambio en la sección **Sin publicar** de `CHANGELOG.md`.
6. Abre un pull request y completa la plantilla.

El código y sus comentarios van en inglés. Los textos de la interfaz y la documentación para usuarios van en español, con su traducción al inglés en `src/i18n.js` y `README.en.md`.

## Publicar una versión

1. Mueve las entradas de **Sin publicar** a una sección nueva `## [x.y.z] - AAAA-MM-DD` en `CHANGELOG.md` y actualiza los enlaces del final.
2. Ejecuta `npm version x.y.z --no-git-tag-version` y haz commit: `chore(release): prepare vx.y.z`.
3. Crea la etiqueta y súbela: `git tag vx.y.z && git push origin main vx.y.z`.

El flujo **Release** compila, prueba y crea la versión en GitHub con `copyversa.user.js`, `copyversa.meta.js`, `copyversa-extension.zip` y sus sumas de verificación. Los userscripts instalados se actualizan solos desde esa versión.
