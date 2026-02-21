package com.dundermifflin.wuphfservice.infrastructure.observability

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.util.UUID

private const val TRACE_ID_ATTR = "wuphf.traceId"
private val TRACEPARENT_REGEX = Regex("^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")

@Component
class TraceHeadersFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val traceId = resolveTraceId(request)
        val requestId = request.getHeader("X-Request-Id")?.trim().orEmpty().ifBlank {
            "req_${System.currentTimeMillis()}_${randomHex(8)}"
        }
        val traceparent = resolveTraceparent(request.getHeader("traceparent"), traceId)

        request.setAttribute(TRACE_ID_ATTR, traceId)
        response.setHeader("X-Trace-Id", traceId)
        response.setHeader("X-Request-Id", requestId)
        response.setHeader("traceparent", traceparent)

        filterChain.doFilter(request, response)
    }

    private fun resolveTraceId(request: HttpServletRequest): String {
        val headerTraceId = request.getHeader("X-Trace-Id")?.trim()?.lowercase().orEmpty()
        if (headerTraceId.matches(Regex("^[0-9a-f]{32}$"))) {
            return headerTraceId
        }

        val traceparent = request.getHeader("traceparent")?.trim()?.lowercase().orEmpty()
        val traceparentMatch = TRACEPARENT_REGEX.find(traceparent)
        if (traceparentMatch != null) {
            return traceparentMatch.groupValues[1]
        }

        return randomHex(32)
    }

    private fun resolveTraceparent(raw: String?, traceId: String): String {
        val normalized = raw?.trim()?.lowercase().orEmpty()
        if (TRACEPARENT_REGEX.matches(normalized)) {
            return normalized
        }

        return "00-$traceId-${randomHex(16)}-01"
    }

    private fun randomHex(length: Int): String {
        val value = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "")
        return value.take(length)
    }
}
