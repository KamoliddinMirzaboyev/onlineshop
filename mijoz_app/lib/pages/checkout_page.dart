import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/quote.dart';
import '../services/cart.dart';
import '../services/api.dart';
import '../services/store.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'app_shell.dart';
import 'map_picker_page.dart';
import 'order_detail_page.dart';

class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key});

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  final _addressController = TextEditingController();
  final _commentController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _loading = false;
  bool _locating = false;
  double? _lat;
  double? _lng;
  String? _locError;
  /// GPS aniqligi (m). Xaritadan tanlanganda `null` — nuqta mijoz tasdiqlagan.
  double? _accuracyM;
  /// Manzil satrini GPS to'ldirganmi — mijoz qo'lda tahrirlagan matn ustiga yozilmaydi.
  bool _addressAuto = false;

  /// Bundan yomon GPS bilan buyurtma bermaymiz — xaritadan tanlash kerak.
  static const _maxSubmitAccuracyM = 200.0;

  String _paymentMethod = 'cash';
  List<Map<String, dynamic>> _savedAddresses = [];

  /// Serverdan olingan yakuniy summa. Ilova yetkazish haqini o'zi
  /// hisoblamaydi — ekrandagi va yoziladigan summa bir xil bo'lishi shart.
  OrderQuote? _quote;
  bool _quoteLoading = false;
  bool _orderBlocked = false;

  @override
  void initState() {
    super.initState();
    _loadUserAndAddresses();
    _resolveLocation();
    _refreshQuote();
  }

  /// Savat yoki koordinata o'zgarganda serverdan qayta hisoblaymiz.
  Future<void> _refreshQuote() async {
    final cart = context.read<CartProvider>();
    final store = context.read<StoreProvider>().store;
    final restaurantId = store?.id ??
        (cart.items.isNotEmpty ? cart.items.first.product.restaurantId : null);
    if (restaurantId == null || cart.items.isEmpty) return;

    setState(() => _quoteLoading = true);
    try {
      final res = await api.post('/orders/quote', {
        'restaurant_id': restaurantId,
        'items': cart.items.map((i) => i.toOrderPayload()).toList(),
        'lat': _lat,
        'lng': _lng,
      });
      if (mounted) {
        setState(() => _quote = OrderQuote.fromJson(res as Map<String, dynamic>));
      }
    } catch (_) {
      // Tarmoq xatosi — eski quote qoladi, summa "hisoblanmoqda" holatida.
    } finally {
      if (mounted) setState(() => _quoteLoading = false);
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _commentController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _loadUserAndAddresses() async {
    try {
      final me = await api.get('/auth/me');
      if (mounted && me['phone'] != null && _phoneController.text.isEmpty) {
        final formatted = UzPhoneFormatter().formatEditUpdate(
          TextEditingValue.empty,
          TextEditingValue(text: me['phone']),
        );
        setState(() => _phoneController.value = formatted);
      }
      final addrs = await api.get('/addresses');
      if (mounted && addrs is List) {
        setState(() => _savedAddresses = List<Map<String, dynamic>>.from(addrs));
      }
    } catch (_) {}
  }

  /// Koordinatadan o'qiladigan manzil (mahalla, ko'cha, uy) — serverdagi
  /// multi-manba reverse-geocode. Mijoz qo'lda tahrirlagan matn saqlanadi.
  Future<void> _fillAddressFromCoords(double lat, double lng) async {
    // Mijoz qo'lda yozgan matn ustiga yozmaymiz.
    if (_addressController.text.trim().isNotEmpty && !_addressAuto) return;
    String? label;
    try {
      final res = await api.get('/geo/reverse?lat=$lat&lng=$lng');
      final v = (res is Map ? res['label'] : null)?.toString().trim();
      if (v != null && v.isNotEmpty) label = v;
    } catch (_) {
      // Manzil aniqlanmadi — koordinata baribir yuboriladi, mijoz qo'lda yozadi.
    }
    if (!mounted) return;
    setState(() {
      _addressController.text =
          label ?? '📍 ${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      _addressAuto = true;
    });
  }

  Future<void> _applyCoords(double lat, double lng, {double? accuracyM}) async {
    if (!mounted) return;
    setState(() {
      _lat = lat;
      _lng = lng;
      _accuracyM = accuracyM;
    });
    // Masofa ma'lum bo'ldi — yetkazish haqi endi aniq hisoblanadi.
    _refreshQuote();
    await _fillAddressFromCoords(lat, lng);
  }

  Future<void> _pickOnMap() async {
    final picked = await Navigator.of(context).push<LatLng>(
      MaterialPageRoute(builder: (_) => MapPickerPage(initialLat: _lat, initialLng: _lng)),
    );
    if (picked == null || !mounted) return;
    // Xaritadan tanlangan nuqta — mijoz tasdiqlagan, aniqlik cheklovi yo'q.
    _addressAuto = true;
    setState(() => _locError = null);
    await _applyCoords(picked.latitude, picked.longitude);
  }

  Future<void> _resolveLocation() async {
    setState(() {
      _locating = true;
      _locError = null;
    });
    try {
      // Ruxsat dialogi bir necha soniya turadi \u2014 mijoz shu orada sahifadan
      // chiqib ketsa `setState` dispose'dan keyin chaqirilib, exception berardi.
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!mounted) return;
      if (!serviceEnabled) {
        setState(() => _locError = 'GPS o\u2018chiq. Sozlamalardan yoqing yoki xaritadan tanlang.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (!mounted) return;
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _locError = 'Joylashuvga ruxsat berilmagan. Xaritadan tanlashingiz mumkin.');
        return;
      }

      // Oxirgi ma'lum nuqta — yetkazish haqi darhol hisoblansin (manzil
      // matni faqat aniq GPS/xaritadan keyin yoziladi).
      if (_lat == null) {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null && mounted) {
          setState(() {
            _lat = last.latitude;
            _lng = last.longitude;
          });
          _refreshQuote();
        }
      }

      // Uy raqamigacha aniqlik kerak — eng yuqori aniqlik, uzunroq kutish.
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          timeLimit: Duration(seconds: 12),
        ),
      );
      await _applyCoords(pos.latitude, pos.longitude, accuracyM: pos.accuracy);
    } catch (e) {
      if (!mounted) return;
      // Aniq GPS ulgurmadi — mijoz xaritadan aniqlashtiradi.
      if (_lat != null) {
        await _fillAddressFromCoords(_lat!, _lng!);
        setState(() => _locError = 'Aniq joylashuv olinmadi — xaritadan tekshiring.');
      } else {
        setState(() => _locError = 'Joylashuv olinmadi. Xaritadan tanlang.');
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _placeOrder() async {
    final address = _addressController.text.trim();
    if (address.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Iltimos, yetkazib berish manzilini kiriting')),
      );
      return;
    }

    if (_accuracyM != null && _accuracyM! > _maxSubmitAccuracyM) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text(
            'Joylashuv aniqligi past. Iltimos, xaritadan aniq joyni belgilang')),
      );
      return;
    }

    final cart = context.read<CartProvider>();
    final store = context.read<StoreProvider>().store;

    // `free_delivery_from` bo'yicha blok olib tashlandi: u "bepul yetkazish
    // chegarasi", minimal buyurtma emas — server bunday cheklov qo'ymaydi.

    final restaurantId = store?.id ??
        (cart.items.isNotEmpty
            ? cart.items.first.product.restaurantId
            : null);
    if (restaurantId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Do‘kon topilmadi')),
      );
      return;
    }

    final phone = _phoneController.text.trim();

    setState(() => _loading = true);
    try {
      final payload = <String, dynamic>{
        'restaurant_id': restaurantId,
        'address_line': address,
        'comment': _commentController.text.trim().isEmpty
            ? null
            : _commentController.text.trim(),
        'payment_method': _paymentMethod,
        // Joylashuv olinmasa soxta koordinata (shahar markazi) YUBORILMAYDI —
        // aks holda masofa va yetkazish haqi noto'g'ri hisoblanardi, zona
        // tekshiruvi ham yolg'on joydan o'tardi.
        'lat': _lat,
        'lng': _lng,
        'items': cart.items.map((i) => i.toOrderPayload()).toList(),
      };
      if (phone.isNotEmpty) {
        payload['phone'] = phone;
      }
      final res = await api.post('/orders', payload);
      cart.clear();
      if (mounted) {
        final orderId = res['id'] as int;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const AppShell()),
          (r) => false,
        );
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => OrderDetailPage(orderId: orderId, justPlaced: true)),
        );
      }
    } catch (e) {
      if (mounted) {
        String msg = 'Buyurtma berib bo\'lmadi. Qayta urinib ko\'ring.';
        if (e is ApiException) {
          msg = e.userFriendlyMessage;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: AppColors.rose500,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final store = context.watch<StoreProvider>().store;
    final storeClosed = store?.isOpen == false;
    // Summani server hisoblaydi (`/orders/quote`). Avval ilova `delivery_fee`ni
    // qat'iy narx deb qo'shardi — aslida u 1 km narxi, natijada ekrandagi jami
    // haqiqiy yozilgan summadan farq qilardi.
    final quote = _quote;
    final itemsTotal = quote?.itemsTotal ?? cart.totalPrice;
    final total = quote?.total ?? cart.totalPrice;
    final blockingIssues = quote?.issues ?? const <QuoteIssue>[];
    _orderBlocked = _loading || storeClosed || blockingIssues.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          children: [
            const PageHeader(title: 'Rasmiylashtirish', back: true),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (storeClosed)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline, color: AppColors.red600, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Do\'kon hozir yopiq — buyurtma qabul qilinmaydi.',
                                style: TextStyle(color: AppColors.red600, fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Manzil bloki
                    _buildCard(
                      title: 'Yetkazib berish manzili',
                      icon: Icons.location_on_rounded,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_savedAddresses.isNotEmpty) ...[
                            Wrap(
                              spacing: 8,
                              children: _savedAddresses.map((a) {
                                final text = a['address_line'] ?? '';
                                final label = a['label'] ?? 'Manzil';
                                return ActionChip(
                                  avatar: const Icon(Icons.bookmark_border_rounded, size: 16, color: AppColors.brand),
                                  label: Text('$label: $text', style: const TextStyle(fontSize: 12)),
                                  onPressed: () => setState(() => _addressController.text = text),
                                  backgroundColor: AppColors.slate50,
                                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 10),
                          ],
                          TextField(
                            controller: _addressController,
                            maxLines: 2,
                            onChanged: (_) => _addressAuto = false,
                            decoration: InputDecoration(
                              hintText: 'Ko\'cha, uy, xonadon, mo\'ljal...',
                              hintStyle: const TextStyle(fontSize: 13, color: AppColors.slate400),
                              filled: true,
                              fillColor: AppColors.slate50,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                              suffixIcon: IconButton(
                                onPressed: _locating ? null : _resolveLocation,
                                icon: _locating
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand))
                                    : const Icon(Icons.my_location_rounded, color: AppColors.brand),
                                tooltip: 'Joriy GPS joylashuv',
                              ),
                            ),
                          ),
                          if (_locError != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(_locError!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
                            ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _pickOnMap,
                                  icon: const Icon(Icons.map_rounded, size: 18, color: AppColors.brand),
                                  label: const Text('Xaritadan tanlash',
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.brand)),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (_accuracyM != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(
                                _accuracyM! > _maxSubmitAccuracyM
                                    ? 'GPS aniqligi past (~${_accuracyM!.round()} m) — xaritadan belgilang'
                                    : 'GPS aniqligi ~${_accuracyM!.round()} m · manzilni qo\'lda tahrirlashingiz mumkin',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: _accuracyM! > _maxSubmitAccuracyM ? AppColors.red600 : AppColors.slate400,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Telefon raqami
                    _buildCard(
                      title: 'Aloqa uchun telefon',
                      icon: Icons.phone_rounded,
                      child: TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [UzPhoneFormatter()],
                        decoration: InputDecoration(
                          hintText: '+998 90 123 45 67',
                          hintStyle: const TextStyle(fontSize: 13, color: AppColors.slate400),
                          filled: true,
                          fillColor: AppColors.slate50,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // To'lov usullari
                    _buildCard(
                      title: 'To\'lov usuli',
                      icon: Icons.payments_rounded,
                      child: Column(
                        children: [
                          _buildPaymentTile('cash', 'Naqd pul orqali', 'Yetkazilganda kuryerga', Icons.money_rounded),
                          // Onlayn to'lov hali ulanmagan — integratsiya tayyor bo'lganda ochiladi.
                          // const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          // _buildPaymentTile('click', 'Click orqali', 'Onlayn to\'lov', Icons.credit_card_rounded, enabled: false),
                          // const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          // _buildPaymentTile('payme', 'Payme orqali', 'Onlayn to\'lov', Icons.credit_card_rounded, enabled: false),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Kuryer uchun izoh
                    _buildCard(
                      title: 'Kuryer uchun izoh',
                      icon: Icons.chat_bubble_outline_rounded,
                      child: TextField(
                        controller: _commentController,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'Domofon kodi, qavat, eslatmalar...',
                          hintStyle: const TextStyle(fontSize: 13, color: AppColors.slate400),
                          filled: true,
                          fillColor: AppColors.slate50,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Hisob kvitansiyasi
                    _buildCard(
                      title: 'To\'lov hisobi',
                      icon: Icons.receipt_long_rounded,
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Mahsulotlar (${cart.totalItems} ta)', style: const TextStyle(color: AppColors.slate500, fontSize: 13.5)),
                              Text('${money(itemsTotal)} so\'m', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Yetkazib berish', style: TextStyle(color: AppColors.slate500, fontSize: 13.5)),
                              if (quote == null)
                                const Text('Hisoblanmoqda…',
                                    style: TextStyle(fontSize: 13, color: AppColors.slate400))
                              else if (!quote.deliveryFeeKnown)
                                const Text('Manzilga qarab',
                                    style: TextStyle(fontSize: 13, color: AppColors.slate400))
                              else
                                Text(
                                  quote.isFreeDelivery ? 'Bepul' : '${money(quote.deliveryFee)} so\'m',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                    color: quote.isFreeDelivery ? AppColors.emerald600 : AppColors.slate900,
                                  ),
                                ),
                            ],
                          ),
                          if (quote != null && quote.deliveryFeeKnown && !quote.isFreeDelivery && quote.distanceKm != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Align(
                                alignment: Alignment.centerRight,
                                child: Text(
                                  '${quote.distanceKm!.toStringAsFixed(1)} km • ${money(quote.freeDeliveryFrom)} so\'mdan bepul',
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.slate400),
                                ),
                              ),
                            ),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Jami', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.slate900)),
                              Text(
                                _quoteLoading && quote == null
                                    ? '…'
                                    : '${money(total)} so\'m',
                                style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: AppColors.brand),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Savatdagi muammoli mahsulotlar — buyurtma berishdan OLDIN
                    // aytiladi (avval faqat checkout'da umumiy xato chiqardi).
                    if (blockingIssues.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFFCA5A5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.remove_shopping_cart_outlined, color: AppColors.red600, size: 18),
                                SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Savatni to\'g\'rilash kerak',
                                    style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.red600, fontSize: 13.5),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            for (final issue in blockingIssues)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text('• ${issue.message}',
                                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF991B1B))),
                              ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),

                    // Tasdiqlash tugmasi — savatda muammo bo'lsa ham bloklanadi.
                    GestureDetector(
                      onTap: _orderBlocked ? null : _placeOrder,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          gradient: _orderBlocked ? null : AppColors.brandGradient,
                          color: _orderBlocked ? AppColors.slate300 : null,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: _orderBlocked
                              ? null
                              : [
                                  BoxShadow(
                                    color: AppColors.brand.withValues(alpha: 0.35),
                                    blurRadius: 16,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                        ),
                        child: Center(
                          child: _loading
                              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                              : const Text(
                                  'Buyurtmani tasdiqlash',
                                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                                ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard({required String title, required IconData icon, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: const [
          BoxShadow(color: Color(0x060F172A), blurRadius: 12, offset: Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: AppColors.brand),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.slate900)),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildPaymentTile(
    String value,
    String title,
    String subtitle,
    IconData icon, {
    bool enabled = true,
  }) {
    final selected = _paymentMethod == value;
    return InkWell(
      onTap: () {
        if (!enabled) {
          ScaffoldMessenger.of(context).hideCurrentSnackBar();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$title tizimi tez orada ishga tushadi. Hozircha naqd to\'lov amal qiladi.'),
              duration: const Duration(seconds: 2),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
          return;
        }
        setState(() => _paymentMethod = value);
      },
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Icon(
              icon,
              size: 22,
              color: !enabled
                  ? AppColors.slate300
                  : selected
                      ? AppColors.brand
                      : AppColors.slate400,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          color: enabled ? AppColors.slate900 : AppColors.slate400,
                        ),
                      ),
                      if (!enabled) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'Tez kunda',
                            style: TextStyle(
                              color: Color(0xFFB45309),
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: enabled ? AppColors.slate400 : AppColors.slate300,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: !enabled
                      ? AppColors.slate200
                      : selected
                          ? AppColors.brand
                          : AppColors.slate300,
                  width: selected && enabled ? 5 : 1.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
