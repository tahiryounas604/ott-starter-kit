package com.tytechlabs.ott

import android.content.Intent
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.leanback.app.BrowseSupportFragment
import androidx.leanback.widget.ArrayObjectAdapter
import androidx.leanback.widget.HeaderItem
import androidx.leanback.widget.ListRow
import androidx.leanback.widget.ListRowPresenter
import androidx.leanback.widget.OnItemViewClickedListener
import androidx.leanback.widget.Presenter
import androidx.leanback.widget.Row
import androidx.leanback.widget.RowPresenter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.main_frame, BrowseFragment())
                .commitNow()
        }
    }
}

class BrowseFragment : BrowseSupportFragment() {
    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)
        title = "OTT Starter Kit"
        headersState = HEADERS_ENABLED
        onItemViewClickedListener = OnItemViewClickedListener { _, item, _, _ ->
            val content = item as? ContentItem ?: return@OnItemViewClickedListener
            startActivity(Intent(requireContext(), DetailsActivity::class.java).apply {
                putExtra(DetailsActivity.EXTRA_CONTENT_ID, content.id)
            })
        }
        loadCatalog()
    }

    private fun loadCatalog() {
        CoroutineScope(Dispatchers.Main).launch {
            val items = try {
                ApiClient.catalog()
            } catch (e: Exception) {
                // v0.1: a failed load leaves an empty grid; surface the error
                // in a real app with a badge/toast instead of crashing.
                emptyList()
            }
            val rowsAdapter = ArrayObjectAdapter(ListRowPresenter())
            items.groupBy { it.genre.ifBlank { "All Titles" } }.forEach { (genre, group) ->
                val listAdapter = ArrayObjectAdapter(CardPresenter())
                group.forEach { listAdapter.add(it) }
                rowsAdapter.add(ListRow(HeaderItem(genre), listAdapter))
            }
            adapter = rowsAdapter
        }
    }
}

class CardPresenter : Presenter() {
    override fun onCreateViewHolder(parent: android.view.ViewGroup): ViewHolder {
        val view = android.view.LayoutInflater.from(parent.context)
            .inflate(R.layout.card_content, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(viewHolder: ViewHolder, item: Any) {
        val content = item as ContentItem
        val title = viewHolder.view.findViewById<android.widget.TextView>(R.id.card_title)
        title.text = content.title
    }

    override fun onUnbindViewHolder(viewHolder: ViewHolder) = Unit
}
