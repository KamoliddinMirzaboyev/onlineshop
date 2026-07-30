import 'package:flutter/material.dart';

import '../core/format.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../services/api.dart';
import '../services/cache.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import '../widgets/toast.dart';

/// Mirrors `pages/OrderDetailPage.tsx`.
class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});
  final int orderId;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  late final Resource<Order> _res;
  bool _updating = false;
  bool _popped = false;
  
  OrderItem? _editingItem;
  final TextEditingController _qtyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _res = Resource<Order>(
      cacheKey: 'courier_order_${widget.orderId}',
      fetchRaw: _fetch,
      parse: (json) => Order.fromJson(json as Map<String, dynamic>),
      pollMs: 15000,
      errorText: "Buyurtmani yuklab bo'lmadi. Internetni tekshiring.",
    );
  }

  // 404 → the order is truly gone, leave the screen. Other errors are kept as
  // transient (cache shows last good copy or an inline retry).
  Future<dynamic> _fetch() async {
    try {
      return await api.get('/courier/orders/${widget.orderId}');
    } on ApiException catch (e) {
      if (e.statusCode == 404 && mounted && !_popped) {
        _popped = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).maybePop();
        });
      }
      rethrow;
    }
  }

  @override
  void dispose() {
    _res.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  Future<void> _handleAdjust() async {
    final order = _res.data;
    final item = _editingItem;
    if (order == null || item == null) return;

    final qtyStr = _qtyController.text.replaceAll(',', '.');
    final qty = double.tryParse(qtyStr);
    if (qty == null || qty < 0) {
      toast.error("Noto'g'ri miqdor");
      return;
    }

    setState(() => _updating = true);
    try {
      await api.patch('/courier/orders/${order.id}/adjust', {
        'items': [
          {'order_item_id': item.id, 'quantity': qty}
        ]
      });
      toast.success("Miqdor yangilandi ✅");
      _res.refresh();
      if (mounted) setState(() => _editingItem = null);
    } catch (_) {
      toast.error("Miqdorni o'zgartirib bo'lmadi");
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _setStatus(String status) async {
    final order = _res.data;
    if (order == null) return;
    setState(() => _updating = true);
    try {
      await api.patch('/courier/orders/${order.id}', {'status': status});
      toast.success(
        status == 'accepted'
            ? 'Buyurtma qabul qilindi ✅'
            : 'Yetkazish boshlandi 🛵 — mijozga ETA yuborildi',
      );
      _res.refresh();
    } catch (_) {
      toast.error("Holatni o'zgartirib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _markDelivered() async {
    final order = _res.data;
    if (order == null) return;
    setState(() => _updating = true);
    try {
      await api.post('/courier/orders/${order.id}/delivered', {});
      toast.success('Buyurtma yetkazildi ✅');
      _res.refresh();
    } catch (_) {
      toast.error("Yakunlab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: AnimatedBuilder(
          animation: _res,
          builder: (context, _) {
            final order = _res.data;
            if (_res.loading && order == null) {
              return const OrderDetailSkeleton();
            }
            if (order == null) {
              return _RetryState(
                message: _res.error ??
                    "Buyurtmani yuklab bo'lmadi. Internetni tekshiring.",
                onRetry: _res.refresh,
              );
            }
            return Stack(
              children: [
                _content(order),
                if (_editingItem != null) _buildEditModal(),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildEditModal() {
    final item = _editingItem!;
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.4),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        child: Material(
          color: Colors.transparent,
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 380),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(color: Colors.black26, blurRadius: 20, offset: Offset(0, 10))
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Miqdorni tahrirlash',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      GestureDetector(
                        onTap: () => setState(() => _editingItem = null),
                        child: const Icon(Icons.close, color: AppColors.slate400),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: AppColors.slate100),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _ItemThumb(imageUrl: item.imageUrl),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.nameUz,
                                    style: const TextStyle(fontWeight: FontWeight.w500)),
                                const SizedBox(height: 2),
                                Text("${money(item.price)} so'm / ${item.unit ?? 'dona'}",
                                    style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text("Yangi miqdor (${item.unit ?? 'dona'})",
                          style: const TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.slate700)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _qtyController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(
                          hintText: 'Masalan: ${item.quantity}',
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.slate200),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.slate200),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.brand, width: 2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      AppButton(
                        label: _updating ? 'Saqlanmoqda...' : 'Saqlash',
                        expand: true,
                        color: AppColors.brand,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        onPressed: (_updating || _qtyController.text.isEmpty) ? null : _handleAdjust,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _content(Order order) {
    final hasNav = canNavigate(
      lat: order.lat,
      lng: order.lng,
      address: order.addressLine,
    );
    final dist = distanceLabel(order.distanceKm);
    final eta = etaLabel(order.etaMinutes);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Pressable(
          borderRadius: 8,
          onTap: () => Navigator.of(context).maybePop(),
          child: const Padding(
            padding: EdgeInsets.symmetric(vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.arrow_back, size: 16, color: AppColors.slate500),
                SizedBox(width: 6),
                Text('Orqaga',
                    style: TextStyle(fontSize: 14, color: AppColors.slate500)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (_res.error != null) ...[
          ErrorBanner(_res.error!),
          const SizedBox(height: 12),
        ],
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          runSpacing: 4,
          children: [
            Text('Buyurtma № ${order.number}',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            StatusPill(order.status),
          ],
        ),
        const SizedBox(height: 4),
        Text(formatFull(order.createdAt),
            style: const TextStyle(fontSize: 14, color: AppColors.slate400)),
        const SizedBox(height: 16),

        // Address / phone / payment / comment / distance card
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: AppColors.brand),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(order.addressLine,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                  ),
                ],
              ),
              if (order.phone != null) ...[
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.phone_outlined, size: 16, color: AppColors.brand),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => launchPhone(order.phone!),
                    child: Text(order.phone!,
                        style: const TextStyle(
                          fontSize: 14,
                          color: AppColors.brand,
                          fontWeight: FontWeight.w600,
                          decoration: TextDecoration.underline,
                        )),
                  ),
                ]),
              ],
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.credit_card, size: 16, color: AppColors.slate400),
                const SizedBox(width: 8),
                _paymentText(order),
              ]),
              if (order.comment != null && order.comment!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('💬 ${order.comment}',
                      style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
                ),
              ],
              if (dist != null || eta != null) ...[
                const SizedBox(height: 10),
                Row(children: [
                  if (dist != null) ...[
                    const Icon(Icons.navigation_outlined, size: 15, color: AppColors.slate400),
                    const SizedBox(width: 6),
                    Text(dist, style: const TextStyle(fontSize: 14, color: AppColors.slate600)),
                    const SizedBox(width: 16),
                  ],
                  if (eta != null) ...[
                    const Icon(Icons.access_time, size: 15, color: AppColors.blue600),
                    const SizedBox(width: 6),
                    Text(eta,
                        style: const TextStyle(
                            fontSize: 14, color: AppColors.blue600, fontWeight: FontWeight.w500)),
                  ],
                ]),
              ],
              if (hasNav) ...[
                const SizedBox(height: 12),
                AppButton(
                  label: 'Navigatsiya',
                  icon: Icons.navigation_outlined,
                  expand: true,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  onPressed: () => showNavigationChooser(
                    context,
                    lat: order.lat,
                    lng: order.lng,
                    address: order.addressLine,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // Items card
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('MAHSULOTLAR',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.slate500,
                      letterSpacing: 0.5)),
              const SizedBox(height: 12),
              ...order.items.map((it) => _itemRow(it, order.status)),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1, color: AppColors.slate100),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Yetkazish',
                      style: TextStyle(fontSize: 14, color: AppColors.slate500)),
                  Text("${money(order.deliveryFee)} so'm",
                      style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Jami', style: TextStyle(fontWeight: FontWeight.bold)),
                  Text("${money(order.total)} so'm",
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brand)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Action buttons
        if (_isAcceptable(order.status))
          _BigButton(
            label: _updating ? '…' : '✅  Qabul qilish',
            color: AppColors.cyan600,
            onPressed: _updating ? null : () => _setStatus('accepted'),
          ),
        if (order.status == 'accepted')
          _BigButton(
            label: _updating ? '…' : '🛵  Yetkazishni boshlash',
            color: AppColors.blue600,
            onPressed: _updating ? null : () => _setStatus('delivering'),
          ),
        if (order.status == 'delivering')
          _BigButton(
            label: _updating ? '…' : '✓  Yetkazdim',
            color: AppColors.emerald600,
            onPressed: _updating ? null : _markDelivered,
          ),
        const SizedBox(height: 8),
        GhostButton(
          label: 'Orqaga',
          expand: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          textColor: AppColors.slate600,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
      ],
    );
  }

  Widget _paymentText(Order order) {
    final spans = <TextSpan>[
      TextSpan(text: paymentLabel(order.paymentMethod)),
    ];
    if (order.paymentStatus == 'paid') {
      spans.add(const TextSpan(
        text: " · To'langan",
        style: TextStyle(color: AppColors.emerald600, fontWeight: FontWeight.w500),
      ));
    } else if (order.paymentMethod == 'cash') {
      spans.add(const TextSpan(
        text: ' · Naqd olinadi',
        style: TextStyle(color: AppColors.amber600, fontWeight: FontWeight.w500),
      ));
    }
    return Expanded(
      child: Text.rich(
        TextSpan(
          style: const TextStyle(fontSize: 14, color: AppColors.slate900),
          children: spans,
        ),
      ),
    );
  }

  Widget _itemRow(OrderItem it, String orderStatus) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ItemThumb(imageUrl: it.imageUrl),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(it.nameUz,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                const SizedBox(height: 2),
                Text('${qtyUnit(it.quantity, it.unit)} × ${money(it.price)} so\'m',
                    style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                if (it.note != null && it.note!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text('💬 ${it.note}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFFB45309))),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text("${money(it.price * it.quantity)} so'm",
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              if (_isAdjustable(orderStatus)) ...[
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _editingItem = it;
                      _qtyController.text = it.quantity.toString();
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.blue600.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.edit, size: 12, color: AppColors.blue600),
                        SizedBox(width: 4),
                        Text('Tahrirlash',
                            style: TextStyle(fontSize: 12, color: AppColors.blue600, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

const _acceptable = {'pending', 'confirmed', 'preparing', 'ready'};
bool _isAcceptable(String s) => _acceptable.contains(s);

// Backend: accepted / preparing / ready da miqdor o'zgartirish mumkin.
const _adjustable = {'accepted', 'preparing', 'ready'};
bool _isAdjustable(String s) => _adjustable.contains(s);

class _ItemThumb extends StatelessWidget {
  const _ItemThumb({this.imageUrl});
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          imageUrl!,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholder(),
        ),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() => Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: Text('🍽', style: TextStyle(fontSize: 18))),
      );
}

class _BigButton extends StatelessWidget {
  const _BigButton({required this.label, required this.color, required this.onPressed});
  final String label;
  final Color color;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: AppButton(
        label: label,
        color: color,
        expand: true,
        fontSize: 16,
        padding: const EdgeInsets.symmetric(vertical: 14),
        onPressed: onPressed,
      ),
    );
  }
}

class _RetryState extends StatelessWidget {
  const _RetryState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.slate400)),
            const SizedBox(height: 12),
            GhostButton(
              label: 'Qayta urinish',
              textColor: AppColors.slate600,
              onPressed: onRetry,
            ),
          ],
        ),
      ),
    );
  }
}
