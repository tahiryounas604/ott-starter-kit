package com.tytechlabs.ott

import kotlinx.serialization.Serializable

@Serializable
data class ContentItem(
    val id: Int,
    val title: String,
    val description: String = "",
    val type: String = "movie",
    val genre: String = "",
    val year: Int? = null,
    val duration_seconds: Int? = null,
    val poster_url: String = "",
    val hls_path: String? = null,
)

@Serializable
data class CatalogResponse(
    val items: List<ContentItem>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)
