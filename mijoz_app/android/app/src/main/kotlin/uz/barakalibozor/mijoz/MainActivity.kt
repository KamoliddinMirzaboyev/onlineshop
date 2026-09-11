package uz.barakalibozor.mijoz

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createOrdersChannel()
    }

    /**
     * Buyurtma bildirishnomalari kanali.
     *
     * Server push'ni `channel_id = "orders"` bilan yuboradi (fcm.py:
     * CUSTOMER_CHANNEL) va AndroidManifest'da shu kanal default sifatida
     * ko'rsatilgan. Kanal yaratilmasa Android 8+ bildirishnomani "Miscellaneous"
     * ostiga tashlaydi — ovozsiz va foydalanuvchi uchun tushunarsiz.
     *
     * flutter_local_notifications qo'shilmadi — bu ~10 qator kod bilan yetarli.
     */
    private fun createOrdersChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            "orders",
            "Buyurtmalar",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Buyurtma holati: qabul qilindi, yo'lda, yetkazildi"
            enableVibration(true)
        }
        getSystemService(NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }
}
