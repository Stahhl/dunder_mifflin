package com.dundermifflin.wuphfservice.application.dto

data class ApiErrorEnvelope(
    val error: ApiError
)

data class ApiError(
    val code: String,
    val message: String,
    val details: List<ApiErrorDetail> = emptyList(),
    val traceId: String? = null
)

data class ApiErrorDetail(
    val field: String,
    val issue: String
)
