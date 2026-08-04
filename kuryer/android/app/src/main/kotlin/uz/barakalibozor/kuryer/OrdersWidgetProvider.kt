package uz.barakalibozor.kuryer

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Home screen widget: faol kuryer buyurtmalari.
 * Ma'lumot Flutter [OrderWidgetSync] orqali yoziladi.
 */
class OrdersWidgetProvider : HomeWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
        widgetData: SharedPreferences,
    ) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.orders_widget).apply {
                val title = widgetData.getString("title", "BB Kuryer") ?: "BB Kuryer"
                val subtitle =
                    widgetData.getString("subtitle", "Buyurtmalar yuklanmoqda…")
                        ?: "Buyurtmalar yuklanmoqda…"
                val count = widgetData.getInt("count", 0)
                val line1 = widgetData.getString("line1", "") ?: ""
                val line2 = widgetData.getString("line2", "") ?: ""
                val line3 = widgetData.getString("line3", "") ?: ""
                val updated = widgetData.getString("updated", "") ?: ""

                setTextViewText(R.id.widget_title, title)
                setTextViewText(R.id.widget_subtitle, subtitle)
                setTextViewText(
                    R.id.widget_badge,
                    if (count > 0) count.toString() else "0",
                )

                bindLine(this, R.id.widget_line1, R.id.widget_line1_box, line1)
                bindLine(this, R.id.widget_line2, R.id.widget_line2_box, line2)
                bindLine(this, R.id.widget_line3, R.id.widget_line3_box, line3)

                if (count == 0) {
                    setViewVisibility(R.id.widget_empty, View.VISIBLE)
                    setViewVisibility(R.id.widget_lines, View.GONE)
                } else {
                    setViewVisibility(R.id.widget_empty, View.GONE)
                    setViewVisibility(R.id.widget_lines, View.VISIBLE)
                }

                setTextViewText(
                    R.id.widget_updated,
                    if (updated.isNotEmpty()) "Yangilandi $updated" else "",
                )

                val pendingIntent = HomeWidgetLaunchIntent.getActivity(
                    context,
                    MainActivity::class.java,
                )
                setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    private fun bindLine(
        views: RemoteViews,
        textId: Int,
        boxId: Int,
        text: String,
    ) {
        if (text.isBlank()) {
            views.setViewVisibility(boxId, View.GONE)
        } else {
            views.setViewVisibility(boxId, View.VISIBLE)
            views.setTextViewText(textId, text)
        }
    }
}
