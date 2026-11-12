package com.tytechlabs.ott

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Details screen: title, metadata, description, Play button. */
class DetailsActivity : FragmentActivity() {
    companion object { const val EXTRA_CONTENT_ID = "content_id" }

    private var content: ContentItem? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_details)
        val contentId = intent.getIntExtra(EXTRA_CONTENT_ID, -1)
        findViewById<Button>(R.id.play_button).setOnClickListener {
            startActivity(Intent(this, PlaybackActivity::class.java).apply {
                putExtra(PlaybackActivity.EXTRA_CONTENT_ID, contentId)
                putExtra(PlaybackActivity.EXTRA_TITLE, content?.title.orEmpty())
            })
        }
        CoroutineScope(Dispatchers.Main).launch {
            val item = runCatching { ApiClient.catalog().firstOrNull { it.id == contentId } }.getOrNull()
            content = item
            findViewById<TextView>(R.id.details_title).text = item?.title ?: "Title not found"
            findViewById<TextView>(R.id.details_meta).text = listOfNotNull(
                item?.type, item?.year?.toString(),
                item?.duration_seconds?.let { "${it / 60} min" },
            ).joinToString("  •  ")
            findViewById<TextView>(R.id.details_description).text = item?.description.orEmpty()
            findViewById<Button>(R.id.play_button).isEnabled = item?.hls_path != null
        }
    }
}
