package com.dundermifflin.gateway.infrastructure.observability

import jakarta.servlet.http.HttpServletRequest
import java.util.UUID

const val TRACE_ID_HEADER = "X-Trace-Id"
const val REQUEST_ID_HEADER = "X-Request-Id"
const val TRACEPARENT_HEADER = "traceparent"

const val TRACE_ID_ATTR = "gateway.traceId"
const val REQUEST_ID_ATTR = "gateway.requestId"
const val TRACEPARENT_ATTR = "gateway.traceparent"

private val TRACEPARENT_REGEX = Regex("^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$")

fun resolveTraceId(request: HttpServletRequest): String {
    val attribute = request.getAttribute(TRACE_ID_ATTR)?.toString()?.trim().orEmpty()
    if (attribute.matches(Regex("^[0-9a-f]{32}$"))) {
        return attribute
    }

    val header = request.getHeader(TRACE_ID_HEADER)?.trim().orEmpty().lowercase()
    if (header.matches(Regex("^[0-9a-f]{32}$"))) {
        return header
    }

    val traceparent = request.getHeader(TRACEPARENT_HEADER)?.trim().orEmpty().lowercase()
    val match = TRACEPARENT_REGEX.find(traceparent)
    if (match != null) {
        return match.groupValues[1]
    }

    return randomHex(32)
}

fun resolveRequestId(request: HttpServletRequest): String {
    val attribute = request.getAttribute(REQUEST_ID_ATTR)?.toString()?.trim().orEmpty()
    if (attribute.isNotBlank()) {
        return attribute
    }

    val header = request.getHeader(REQUEST_ID_HEADER)?.trim().orEmpty()
    if (header.isNotBlank()) {
        return header
    }

    return "req_${System.currentTimeMillis()}_${randomHex(8)}"
}

fun resolveTraceparent(request: HttpServletRequest, traceId: String): String {
    val attribute = request.getAttribute(TRACEPARENT_ATTR)?.toString()?.trim().orEmpty().lowercase()
    if (TRACEPARENT_REGEX.matches(attribute)) {
        return attribute
    }

    val header = request.getHeader(TRACEPARENT_HEADER)?.trim().orEmpty().lowercase()
    if (TRACEPARENT_REGEX.matches(header)) {
        return header
    }

    return "00-$traceId-${randomHex(16)}-01"
}

private fun randomHex(length: Int): String {
    val bytes = ByteArray((length + 1) / 2)
    UUID.randomUUID().toString().replace("-", "").chunked(2).take(bytes.size).forEachIndexed { index, value ->
        bytes[index] = value.toInt(16).toByte()
    }

    return bytes.joinToString("") { "%02x".format(it) }.take(length)
}
