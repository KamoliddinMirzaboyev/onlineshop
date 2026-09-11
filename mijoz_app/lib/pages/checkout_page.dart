import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../services/cart.dart';
import '../services/api.dart';
import '../services/store.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import 'app_shell.dart';
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

  String _paymentMethod = 'cash';
  List<Map<String, dynamic>> _savedAddresses = [];

  @override
  void initState() {
    super.initState();
    _loadUserAndAddresses();
    _resolveLocation();
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

  Future<void> _resolveLocation() async {
    setState(() {
      _locating = true;
      _locError = null;
    });
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() => _locError = 'GPS o‘chiq. Sozlamalardan yoqing.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => _locError = 'Joylashuvga ruxsat berilmagan.');
        return;
      }

      // Avval xotiradagi oxirgi koordinatani olamiz
      try {
        final lastPos = await Geolocator.getLastKnownPosition();
        if (lastPos != null && mounted) {
          setState(() {
            _lat = lastPos.latitude;
            _lng = lastPos.longitude;
            if (_addressController.text.trim().isEmpty) {
              _addressController.text =
                  'Joriy joylashuv (${lastPos.latitude.toStringAsFixed(4)}, ${lastPos.longitude.toStringAsFixed(4)})';
            }
          });
        }
      } catch (_) {}

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );
      if (!mounted) return;
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        if (_addressController.text.trim().isEmpty) {
          _addressController.text =
              'Joriy joylashuv (${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)})';
        }
      });
    } catch (e) {
      if (mounted && _lat == null) {
        setState(() => _locError = 'Joylashuv olinmadi. Qayta urinib ko‘ring.');
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

    final cart = context.read<CartProvider>();
    final store = context.read<StoreProvider>().store;

    if (store != null && cart.totalPrice < store.minOrder) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Minimal buyurtma miqdori: ${money(store.minOrder)} so‘m'),
          backgroundColor: AppColors.rose500,
        ),
      );
      return;
    }

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
        'lat': _lat ?? 41.311081,
        'lng': _lng ?? 69.240562,
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
    final deliveryFee = store?.deliveryFee ?? 0;
    final total = cart.totalPrice + deliveryFee;

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
                          const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          _buildPaymentTile('click', 'Click orqali', 'Onlayn to\'lov', Icons.credit_card_rounded),
                          const Divider(height: 1, color: Color(0xFFF1F5F9)),
                          _buildPaymentTile('payme', 'Payme orqali', 'Onlayn to\'lov', Icons.credit_card_rounded),
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
                              Text('${money(cart.totalPrice)} so\'m', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Yetkazib berish', style: TextStyle(color: AppColors.slate500, fontSize: 13.5)),
                              Text(
                                deliveryFee == 0 ? 'Bepul' : '${money(deliveryFee)} so\'m',
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: deliveryFee == 0 ? AppColors.emerald600 : AppColors.slate900),
                              ),
                            ],
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 10),
                            child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Jami', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.slate900)),
                              Text('${money(total)} so\'m', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: AppColors.brand)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Tasdiqlash tugmasi
                    GestureDetector(
                      onTap: (_loading || storeClosed) ? null : _placeOrder,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          gradient: (_loading || storeClosed) ? null : AppColors.brandGradient,
                          color: (_loading || storeClosed) ? AppColors.slate300 : null,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: (_loading || storeClosed)
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

  Widget _buildPaymentTile(String value, String title, String subtitle, IconData icon) {
    final selected = _paymentMethod == value;
    return InkWell(
      onTap: () => setState(() => _paymentMethod = value),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            Icon(icon, size: 22, color: selected ? AppColors.brand : AppColors.slate400),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: TextStyle(fontSize: 14, fontWeight: selected ? FontWeight.w700 : FontWeight.w500, color: AppColors.slate900)),
                  Text(subtitle, style: const TextStyle(fontSize: 11.5, color: AppColors.slate400)),
                ],
              ),
            ),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected ? AppColors.brand : AppColors.slate300, width: selected ? 5 : 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
