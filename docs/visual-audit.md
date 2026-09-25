# Auditoría de presentación — 25 septiembre 2026

## Patrones revisados

Hoy, Comidas, Alimentos, Progreso y Usuario comparten ScreenHeader y estilos globales.
Se revisaron también InfoDialog, ConfirmDialog, MealSnapshotEditor, formularios de
mediciones y objetivos, controles de actividad, preferencias, gráficas y el bloque
del informe semanal. No se modificaron sus flujos, cálculos, datos ni persistencia.

Inconsistencias encontradas: títulos equivalentes de 11–16 px y pesos 700/800;
mayúsculas que afectaban a unidades; select y textarea sin herencia tipográfica
global; cierre de modal de 38 px; formatos decimales mezclados; errata «d?ficit»;
abreviatura H frente a HC; padding de tarjeta de alimentos distinto al común.

## Sistema común

Se conserva Inter con las alternativas de sistema ya existentes, sin descargas.
`uiSystem.css`, cargado después de los estilos de componentes, define los roles:

| Rol | Tamaño | Peso |
| --- | --- | --- |
| Pantalla | 20 px | 700 |
| Tarjeta / modal | 16 px | 600 / 700 |
| Subtítulo | 14 px | 600 |
| Cuerpo | 14 px | 400 |
| Secundario / label | 12 px | 400 / 600 |
| Leyenda | 11 px | 400 |
| Input móvil | 16 px | 400 |

Interlineados 1,25 para títulos y 1,5 para cuerpo. Espaciados comunes de 4, 8,
12, 16 y 24 px. Se mantienen radios 16/12 px, colores de tema y estados semánticos.
Los botones principales/secundarios/destructivos conservan su jerarquía y comparten
tipografía, espaciado y altura mínima de 44 px. Los modales comparten títulos,
labels normales, controles de 16 px, foco visible y límites de altura con scroll.

`formatDisplayNumber` es solo de presentación: coma decimal, máximo una decimal,
sin ceros finales. No se usa para entradas, cálculos ni datos guardados. Se aplica
a las salidas de Alimentos, Comidas y Hoy. Los ejes de evolución también usan
formato español; no se alteran las coordenadas SVG.

## Excepciones deliberadas

- Ejes y leyendas conservan 11 px y el tema gráfico común.
- Diferencias de macros: 10 px; valores compactos: 11 px.
- Resumen de alimento en una línea: 10–11 px según ancho.
- Cifras destacadas, porcentajes e iconos conservan sus dimensiones particulares.
- Color de usuario: seis puntos en fila sin rectángulos; no se aplica estilo de tarjeta.
- Botones de actividad: 52 px normalmente, ajuste a cinco columnas de al menos 44 px
  en pantallas de 320 px. No cambian iconos ni selección.
- Botón informativo de recomendación: 36 × 44 px solo en anchos menores de 350 px,
  para mantener legible la columna derecha.
- Marca y abreviaturas P/HC/G conservan sus mayúsculas intencionadas.
- Inputs date conservan las correcciones específicas de Safari existentes.

## Validación y límites

Se comprobó en Chrome headless una muestra local de componentes con los estilos
reales a 320, 375, 390 y 430 px (cabecera, actividad, macros, historial, formulario,
botones y alimento): sin desbordamiento horizontal en la muestra. No equivale a
una prueba completa de todas las pantallas autenticadas ni a Safari en un iPhone físico.
La auditoría de las cinco pantallas restantes y sus estados se realizó sobre código.
No se accedió a Supabase para la revisión visual.
