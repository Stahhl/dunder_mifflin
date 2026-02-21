package com.dundermifflin.gateway.infrastructure.observability

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class TraceHeadersFilter : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val traceId = resolveTraceId(request)
        val requestId = resolveRequestId(request)
        val traceparent = resolveTraceparent(request, traceId)

        request.setAttribute(TRACE_ID_ATTR, traceId)
        request.setAttribute(REQUEST_ID_ATTR, requestId)
        request.setAttribute(TRACEPARENT_ATTR, traceparent)

        response.setHeader(TRACE_ID_HEADER, traceId)
        response.setHeader(REQUEST_ID_HEADER, requestId)
        response.setHeader(TRACEPARENT_HEADER, traceparent)

        filterChain.doFilter(request, response)
    }
}
