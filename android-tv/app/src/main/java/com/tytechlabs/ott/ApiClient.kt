package com.tytechlabs.ott

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Minimal API client for the ott-starter-kit backend.
 * Point BASE_URL at the machine running the backend. Cleartext HTTP is
 * intentional for local development; use HTTPS in production and remove
 * the cleartext allowance from the network security config.
 */
object ApiClient {
    var baseUrl: String = "http://10.0.2.2:3000" // emulator host loopback
    private val client = OkHttpClient()
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun catalog(): List<ContentItem> = withContext(Dispatchers.IO) {
        val request = Request.Builder().url("$baseUrl/api/catalog?limit=100").build()
        client.newCall(request).execute().use { response ->
            check(response.isSuccessful) { "Catalog request failed: HTTP ${response.code}" }
            val body = response.body?.string().orEmpty()
            json.decodeFromString<CatalogResponse>(body).items
        }
    }

    fun streamUrl(contentId: Int): String = "$baseUrl/api/play/$contentId/master.m3u8"
}
