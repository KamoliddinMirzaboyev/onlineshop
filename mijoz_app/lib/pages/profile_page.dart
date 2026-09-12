import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../models/user.dart';
import '../models/catalog.dart';
import '../services/api.dart';
import '../services/cart.dart';
import '../services/store.dart';
import '../widgets/common.dart';
import '../widgets/skeleton.dart';
import '../widgets/toast.dart';
import 'auth_page.dart';
import 'contact_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  User? _user;
  List<Map<String, dynamic>> _addresses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await api.get('/auth/me');
      final addrs = await api.get('/addresses');
      if (!mounted) return;
      setState(() {
        _user = User.fromJson(me);
        _addresses = List<Map<String, dynamic>>.from(addrs);
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editField({
    required String title,
    required String initialValue,
    required String apiKey,
    TextInputType? keyboardType,
  }) async {
    final controller = TextEditingController(text: initialValue);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            isDense: true,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.8),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bekor qilish', style: TextStyle(color: AppColors.slate500)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brand,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Saqlash'),
          ),
        ],
      ),
    );
    // Dialog yopilgach controller bo'shatiladi — har ochilishda yangisi
    // yaratilib, eskisi xotirada qolib ketardi.
    controller.dispose();

    if (result == null || !mounted) return;

    try {
      final res = await api.patch('/auth/me', {apiKey: result});
      if (!mounted) return;
      setState(() => _user = User.fromJson(res));
      toast.success('Ma\'lumot yangilandi');
    } catch (e) {
      toast.error(apiKey == 'phone' ? 'Bu telefon raqami band bo\'lishi mumkin' : 'Saqlab bo\'lmadi');
    }
  }

  Future<void> _openAddAddressDialog() async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Yangi manzil qo\'shish', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Masalan: Chilonzor 9, 24-uy, 15-xonadon',
            hintStyle: const TextStyle(fontSize: 13, color: AppColors.slate400),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.8),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bekor qilish', style: TextStyle(color: AppColors.slate500)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.brand,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Qo\'shish'),
          ),
        ],
      ),
    );
    controller.dispose();

    if (result == null || result.isEmpty || !mounted) return;

    try {
      await api.post('/addresses', {'label': 'Uy', 'address_line': result});
      toast.success('Manzil qo\'shildi');
      _load();
    } catch (_) {
      toast.error('Manzilni saqlab bo\'lmadi');
    }
  }

  Future<void> _deleteAddress(int id) async {
    try {
      await api.delete('/addresses/$id');
      toast.success('Manzil o\'chirildi');
      _load();
    } catch (_) {
      toast.error('O\'chirib bo\'lmadi');
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hisobdan chiqish', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        content: const Text('Haqiqatan ham hisobingizdan chiqmoqchimisiz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor qilish', style: TextStyle(color: AppColors.slate500)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.red600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Chiqish'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await api.delete('/auth/fcm-token');
    } catch (_) {}
    // Token serverda ham bekor qilinsin (o'g'irlangan qurilmada ishlamasin).
    await api.logout('/auth/logout');
    await api.setToken(null);
    if (!mounted) return;
    context.read<CartProvider>().clear();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const AuthPage()),
      (r) => false,
    );
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hisobni butunlay o\'chirish', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.red600)),
        content: const Text(
          'Haqiqatan ham hisobingizni o\'chirmoqchimisiz? Barcha shaxsiy ma\'lumotlaringiz, buyurtmalar tarixi va saqlangan manzillaringiz qaytarib bo\'lmas darajada o\'chiriladi.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor qilish', style: TextStyle(color: AppColors.slate500)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.red600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('O\'chirish'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _loading = true);
    try {
      await api.delete('/auth/me');
      await api.setToken(null);
      if (!mounted) return;
      context.read<CartProvider>().clear();
      toast.success('Hisobingiz muvaffaqiyatli o\'chirildi');
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const AuthPage()),
        (r) => false,
      );
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        final msg = e is ApiException ? e.message : 'Hisobni o\'chirib bo\'lmadi';
        toast.error(msg);
      }
    }
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return 'B';
    return name.trim()[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<StoreProvider>().store;
    final fullName = [_user?.firstName, _user?.lastName]
        .where((s) => s != null && s.isNotEmpty)
        .join(' ');

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Column(
          children: [
            const PageHeader(title: 'Profil'),
            Expanded(
              child: _loading
                  ? const ProfileSkeleton()
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                      children: [
                        // Foydalanuvchi ma'lumotlari kartasi
                        AppCard(
                          padding: const EdgeInsets.all(18),
                          child: Row(
                            children: [
                              Container(
                                width: 62,
                                height: 62,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF22C55E), Color(0xFF15803D)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.brand.withValues(alpha: 0.25),
                                      blurRadius: 14,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  _initials(_user?.firstName),
                                  style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      fullName.isNotEmpty ? fullName : 'Foydalanuvchi',
                                      style: const TextStyle(
                                        fontSize: 17,
                                        fontWeight: FontWeight.w800,
                                        color: AppColors.slate900,
                                        letterSpacing: -0.2,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.verified_rounded, size: 15, color: AppColors.emerald500),
                                        const SizedBox(width: 5),
                                        Text(
                                          _user?.phone ?? '',
                                          style: const TextStyle(
                                            color: AppColors.slate500,
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // TMA uslubidagi Buyurtma bo'yicha adminga bog'lanish kartasi
                        _buildAdminContactCard(context, store),
                        const SizedBox(height: 20),

                        // Shaxsiy ma'lumotlar bo'limi
                        _SectionTitle(title: 'Shaxsiy ma\'lumotlar'),
                        AppCard(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              _ProfileItemRow(
                                icon: Icons.badge_outlined,
                                label: 'Ism',
                                value: _user?.firstName ?? 'Kiritilmagan',
                                onTap: () => _editField(
                                  title: 'Ismingizni o\'zgartirish',
                                  initialValue: _user?.firstName ?? '',
                                  apiKey: 'first_name',
                                ),
                              ),
                              const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 52),
                              _ProfileItemRow(
                                icon: Icons.person_outline_rounded,
                                label: 'Familiya',
                                value: (_user?.lastName?.isNotEmpty ?? false) ? _user!.lastName! : 'Kiritilmagan',
                                onTap: () => _editField(
                                  title: 'Familiyangizni o\'zgartirish',
                                  initialValue: _user?.lastName ?? '',
                                  apiKey: 'last_name',
                                ),
                              ),
                              const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 52),
                              _ProfileItemRow(
                                icon: Icons.phone_outlined,
                                label: 'Telefon raqam',
                                value: _user?.phone ?? '—',
                                onTap: () => _editField(
                                  title: 'Telefon raqamini o\'zgartirish',
                                  initialValue: _user?.phone ?? '',
                                  apiKey: 'phone',
                                  keyboardType: TextInputType.phone,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Saqlangan manzillar bo'limi
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const _SectionTitle(title: 'Saqlangan manzillar', bottomPadding: 0),
                            GestureDetector(
                              onTap: _openAddAddressDialog,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.brandSoft,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.add_rounded, size: 16, color: AppColors.brand),
                                    SizedBox(width: 4),
                                    Text(
                                      'Qo\'shish',
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brand),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        AppCard(
                          padding: _addresses.isEmpty ? const EdgeInsets.all(20) : EdgeInsets.zero,
                          child: _addresses.isEmpty
                              ? const Center(
                                  child: Text(
                                    'Saqlangan manzillar yo\'q',
                                    style: TextStyle(color: AppColors.slate400, fontSize: 13.5),
                                  ),
                                )
                              : Column(
                                  children: [
                                    for (int i = 0; i < _addresses.length; i++) ...[
                                      Padding(
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                        child: Row(
                                          children: [
                                            Container(
                                              width: 36,
                                              height: 36,
                                              decoration: BoxDecoration(
                                                color: AppColors.slate100,
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: const Icon(Icons.location_on_rounded, size: 18, color: AppColors.brand),
                                            ),
                                            const SizedBox(width: 12),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    _addresses[i]['label'] ?? 'Manzil',
                                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.slate900),
                                                  ),
                                                  const SizedBox(height: 2),
                                                  Text(
                                                    _addresses[i]['address_line'] ?? '',
                                                    style: const TextStyle(fontSize: 12.5, color: AppColors.slate500),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.slate400),
                                              onPressed: () => _deleteAddress(_addresses[i]['id'] as int),
                                            ),
                                          ],
                                        ),
                                      ),
                                      if (i < _addresses.length - 1)
                                        const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 60),
                                    ],
                                  ],
                                ),
                        ),
                        const SizedBox(height: 16),

                        // Yordam va qonuniy ma'lumotlar
                        _SectionTitle(title: 'Qo\'llab-quvvatlash va ilova'),
                        AppCard(
                          padding: EdgeInsets.zero,
                          child: Column(
                            children: [
                              _ActionItemRow(
                                icon: Icons.headset_mic_rounded,
                                label: 'Texnik qo\'llab-quvvatlash',
                                trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.slate400),
                                onTap: () => Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const ContactPage()),
                                ),
                              ),
                              const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 52),
                              _ActionItemRow(
                                icon: Icons.privacy_tip_outlined,
                                label: 'Maxfiylik siyosati',
                                trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.slate400),
                                onTap: () => launchExternal('https://www.barakali-bozor.uz/privacy'),
                              ),
                              const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 52),
                              _ActionItemRow(
                                icon: Icons.description_outlined,
                                label: 'Ommaviy oferta',
                                trailing: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.slate400),
                                onTap: () => launchExternal('https://www.barakali-bozor.uz/terms'),
                              ),
                              const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 52),
                              const _ActionItemRow(
                                icon: Icons.info_outline_rounded,
                                label: 'Ilova versiyasi',
                                trailing: Text('v1.0.0', style: TextStyle(color: AppColors.slate400, fontSize: 13, fontWeight: FontWeight.w600)),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Chiqish va hisobni o'chirish
                        GhostButton(
                          label: 'Hisobdan chiqish',
                          icon: Icons.logout_rounded,
                          expand: true,
                          textColor: AppColors.slate700,
                          onPressed: _logout,
                        ),
                        const SizedBox(height: 12),
                        Center(
                          child: TextButton.icon(
                            icon: const Icon(Icons.delete_forever_rounded, size: 18, color: AppColors.red600),
                            label: const Text(
                              'Hisobni o\'chirish',
                              style: TextStyle(color: AppColors.red600, fontSize: 13.5, fontWeight: FontWeight.w600),
                            ),
                            onPressed: _confirmDeleteAccount,
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdminContactCard(BuildContext context, RestaurantDetail? store) {
    final phones = (store?.phones ?? []).take(2).toList();
    final telegram = store?.socials['telegram']?.replaceFirst('@', '');
    final hasContacts = phones.isNotEmpty || (telegram != null && telegram.isNotEmpty);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
          BoxShadow(
            color: Color(0x040F172A),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Yashil sarlavha paneli (TMA uslubida)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.headset_mic_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Buyurtma bo\'yicha adminga bog\'lanish',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Telefon va Telegram kontaktlar ro'yxati
          if (!hasContacts)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
              child: Center(
                child: Text(
                  'Bog\'lanish ma\'lumoti kiritilmagan',
                  style: TextStyle(
                    color: AppColors.slate400,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            )
          else ...[
            for (int i = 0; i < phones.length; i++) ...[
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => launchPhone(phones[i]),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.phone_rounded, color: AppColors.brand, size: 18),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Qo\'ng\'iroq',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.slate800,
                            ),
                          ),
                        ),
                        Text(
                          phones[i],
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.slate500,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.slate300),
                      ],
                    ),
                  ),
                ),
              ),
              if (i < phones.length - 1 || (telegram != null && telegram.isNotEmpty))
                const Divider(height: 1, color: Color(0xFFF1F5F9), indent: 64),
            ],

            if (telegram != null && telegram.isNotEmpty)
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => launchExternal('https://t.me/$telegram'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE0F2FE),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.send_rounded, color: Color(0xFF0284C7), size: 17),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Telegram',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.slate800,
                            ),
                          ),
                        ),
                        Text(
                          '@$telegram',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0284C7),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.slate300),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}


class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.bottomPadding = 8});
  final String title;
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 4, bottom: bottomPadding),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: AppColors.slate400,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _ProfileItemRow extends StatelessWidget {
  const _ProfileItemRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.slate400),
            const SizedBox(width: 14),
            Text(label, style: const TextStyle(fontSize: 14, color: AppColors.slate800, fontWeight: FontWeight.w500)),
            const Spacer(),
            Text(
              value,
              style: const TextStyle(fontSize: 14, color: AppColors.slate500, fontWeight: FontWeight.w600),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.edit_outlined, size: 16, color: AppColors.slate400),
          ],
        ),
      ),
    );
  }
}

class _ActionItemRow extends StatelessWidget {
  const _ActionItemRow({
    required this.icon,
    required this.label,
    required this.trailing,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final Widget trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.slate400),
            const SizedBox(width: 14),
            Text(label, style: const TextStyle(fontSize: 14, color: AppColors.slate800, fontWeight: FontWeight.w500)),
            const Spacer(),
            trailing,
          ],
        ),
      ),
    );
  }
}
