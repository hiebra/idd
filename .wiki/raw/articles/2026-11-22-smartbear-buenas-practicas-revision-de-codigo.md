---
title: "SmartBear: buenas prácticas de revisión de código (200-400 líneas, menos de 500 por hora, menos de 60 minutos)"
source: "https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/"
type: articles
ingested: 2026-11-22
tags: [revision-de-codigo, smartbear, verificacion, tamano-de-las-tasks]
summary: "Extracto de la página de buenas prácticas de revisión entre pares de SmartBear, basada en su estudio con un equipo de Cisco: revisar no más de 200-400 líneas de una vez, a menos de 500 líneas por hora y no más de 60 minutos seguidos. Es material del fabricante, sin el estudio original; es la base de la referencia de 8 líneas por minuto del límite de verificación de limite-de-verificacion-y-mcp-de-depuracion."
canonical_url: "https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/"
upstream_id: "smartbear.com/learn/code-review/best-practices-for-peer-code-review"
upstream_type: web-page
revision: "consultada el 2026-11-22"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl de la página HTML (sha256 e99f7e6c200a8d09…) y extracción del texto; extracto literal"
---

# SmartBear: buenas prácticas de revisión de código (extracto)

Es una página comercial de SmartBear. Las cifras vienen de un estudio propio con el equipo de MeetingPlace de Cisco; el estudio original no se ha consultado.

## Tamaño de una revisión (extracto literal)

> 1. Review fewer than 400 lines of code at a time
>
> A SmartBear study of a Cisco Systems programming team revealed that developers should review no more than 200 to 400 lines of code (LOC) at a time. The brain can only effectively process so much information at a time; beyond 400 LOC, the ability to find defects diminishes.
>
> In practice, a review of 200-400 LOC over 60 to 90 minutes should yield 70-90% defect discovery. So, if 10 defects existed in the code, a properly conducted review would find between seven and nine of them.

## Ritmo (extracto literal)

> 2. Take your time. Inspection rates should under 500 LOC per hour
>
> It can be tempting to tear through a review, assuming that someone else will catch the errors that you don't find. However, SmartBear research shows a significant drop in defect density at rates faster than 500 LOC per hour. Code reviews in reasonable quantity, at a slower pace for a limited amount of time results in the most effective code review.

## Duración (extracto literal)

> 3. Do not review for more than 60 minutes at a time
>
> Just as you shouldn't review code too quickly, you also should not review for too long in one sitting. When people engage in any activity requiring concentrated effort over a period of time, performance starts dropping off after about 60 minutes.

## Cómo se usa en el proyecto

500 líneas por hora son unas 8 por minuto: es la referencia que da la regla de `rules.tasks` del change `limite-de-verificacion-y-mcp-de-depuracion` (design D2) para estimar el tiempo de verificación de una task.
