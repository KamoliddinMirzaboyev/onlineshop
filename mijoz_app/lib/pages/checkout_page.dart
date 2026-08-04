import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import '../services/cart.dart';
import '../services/api.dart';
import '../services/store.dart';
import '../core/theme.dart';
import 'home_page.dart';

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

  @override
  void initState() {
    super.initState();
    _resolveLocation();
  }

  @override
  void dispose() {
    _addressController.dispose();
    _commentController.dispose();
    _phoneController.dispose();
    super.dispose();
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
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      if (!mounted) return;
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        if (_addressController.text.trim().isEmpty) {
          _addressController.text =
              '${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}';
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() => _locError = 'Joylashuv olinmadi. Qayta urinib ko‘ring.');
      }
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _placeOrder() async {
    final address = _addressController.text.trim();
    if (address.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Manzilni kiriting')),
      );
      return;
    }
    if (_lat == null || _lng == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Joylashuv kerak — GPS ni yoqing')),
      );
      await _resolveLocation();
      return;
    }

    final store = context.read<StoreProvider>().store;
    final restaurantId = store?.id ??
        (context.read<CartProvider>().items.isNotEmpty
            ? context.read<CartProvider>().items.first.product.restaurantId
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
      final cart = context.read<CartProvider>();
      final payload = <String, dynamic>{
        'restaurant_id': restaurantId,
        'address_line': address,
        'comment': _commentController.text.trim().isEmpty
            ? null
            : _commentController.text.trim(),
        'payment_method': 'cash',
        'lat': _lat,
        'lng': _lng,
        'items': cart.items.map((i) => i.toJson()).toList(),
      };
      if (phone.isNotEmpty) {
        payload['phone'] = phone;
      }
      await api.post('/orders', payload);
      cart.clear();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomePage()),
          (r) => false,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Buyurtma qabul qilindi')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Xatolik: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      appBar: AppBar(
        title: const Text('Rasmiylashtirish',
            style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Telefon',
                hintText: '+998 90 123 45 67',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _addressController,
              decoration: InputDecoration(
                labelText: 'Manzil (majburiy)',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  onPressed: _locating ? null : _resolveLocation,
                  icon: _locating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.my_location),
                ),
              ),
              maxLines: 2,
            ),
            if (_lat != null && _lng != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'GPS: ${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ),
            if (_locError != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  _locError!,
                  style: const TextStyle(fontSize: 12, color: Colors.red),
                ),
              ),
            const SizedBox(height: 16),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(
                labelText: 'Kuryer uchun izoh (ixtiyoriy)',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: (_loading || _locating) ? null : _placeOrder,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brand,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: _loading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text('Buyurtma berish',
                      style: TextStyle(fontSize: 18, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }
}
