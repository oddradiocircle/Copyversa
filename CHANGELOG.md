# Registro de cambios

Este archivo sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa [versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [4.0.0] - 2026-10-22

### Añadido

- Extensión para Chrome y Edge, además del userscript. Solo accede a la pestaña donde se activa.
- Formato **Texto** (texto plano limpio, tablas separadas por tabulaciones).
- Formato **Enriquecido**, para pegar en Word, Google Docs o el correo con negritas, listas y tablas.
- Copia de los valores de campos, listas desplegables y casillas de formularios.
- Conversión a formato real de las negritas, cursivas, subrayados y alineaciones aplicadas con CSS.
- Tablas sin encabezados o con celdas combinadas en Markdown y en texto.
- Marcadores de listas con letras y números romanos.
- Opción para añadir la fuente y la fecha de consulta.
- Opción para descartar imágenes.
- Opción para incluir el contenido oculto, como acordeones y pestañas cerradas.
- Flechas arriba y abajo para ampliar o reducir el bloque resaltado, y Enter para copiar.
- Shift + clic para la selección múltiple, con números que muestran el orden.
- Copia inmediata del texto seleccionado al pulsar el atajo.
- Panel movible, con modo oscuro, interfaz en español e inglés y nombres claros para cada bloque.
- Pruebas automáticas, integración continua y versiones publicadas con sus archivos de instalación.

### Cambiado

- La librería Turndown viene incluida y fijada en una versión exacta. CopyVersa ya no descarga código externo.
- La interfaz queda aislada de la página: no la afectan los estilos del sitio ni cambia la página.
- El atajo se graba pulsando la nueva combinación.
- **Markdown** usa siempre la variante de GitHub.
- En Markdown, la primera fila de una tabla solo es encabezado si la página la marca así. Las tablas de clave y valor quedan con el encabezado vacío.
- Sin icono: el panel muestra solo el nombre.
- El nuevo identificador del userscript permite actualizaciones automáticas desde GitHub. Si tenías la versión 3.0, desinstálala antes de instalar esta.

### Corregido

- Los bloques de código ya no muestran etiquetas HTML ni caracteres escapados dos veces.
- Las clases internas de CopyVersa ya no aparecen en el contenido copiado.
- Los enlaces e imágenes relativos se convierten en direcciones completas.
- Ya no se copian scripts, estilos ni contenido oculto.
- El texto con caracteres como `<` ya no se interpreta como HTML.
- CopyVersa funciona en páginas con políticas de seguridad estrictas (Trusted Types).

## [3.0] - versión anterior

Userscript distribuido fuera de este repositorio. Copiaba elementos como Markdown, Markdown de GitHub o HTML.

[Sin publicar]: https://github.com/oddradiocircle/Copyversa/compare/v4.0.0...HEAD
[4.0.0]: https://github.com/oddradiocircle/Copyversa/releases/tag/v4.0.0
