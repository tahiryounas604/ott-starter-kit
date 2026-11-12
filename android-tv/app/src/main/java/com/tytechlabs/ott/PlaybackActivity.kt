package com.tytechlabs.ott

import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView

/** Full-screen HLS playback with ExoPlayer (Media3). */
class PlaybackActivity : FragmentActivity() {
    companion object {
        const val EXTRA_CONTENT_ID = "content_id"
        const val EXTRA_TITLE = "title"
    }

    private var player: ExoPlayer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_playback)
        val contentId = intent.getIntExtra(EXTRA_CONTENT_ID, -1)
        val playerView = findViewById<PlayerView>(R.id.player_view)
        val exoPlayer = ExoPlayer.Builder(this).build().also { player = it }
        playerView.player = exoPlayer
        exoPlayer.setMediaItem(MediaItem.fromUri(ApiClient.streamUrl(contentId)))
        exoPlayer.prepare()
        exoPlayer.play()
    }

    override fun onStop() {
        super.onStop()
        player?.release()
        player = null
    }
}
