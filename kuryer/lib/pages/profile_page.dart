import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../services/notifications.dart';
import '../state/auth.dart';
import '../widgets/common.dart';
import '../widgets/toast.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with WidgetsBindingObserver {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _oldPw = TextEditingController();
  final _newPw = TextEditingController();
  final _confirmPw = TextEditingController();

  bool _profileSaving = false;
  bool _pwSaving = false;
  bool _hydrated = false;
  ({bool ok, String text})? _pwMsg;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Admin yaratgan ism/telefonni serverdan yangilab olish.
    WidgetsBinding.instance.addPostFrameCallback((_) => _reloadMe());
  }

  Future<void> _reloadMe() async {
    try {
      await context.read<AuthState>().loadMe();
    } catch (_) {
      /* offline — cache'dagi qiymat qoladi */
    }
    if (mounted) _syncFromAuth(force: true);
  }

  void _syncFromAuth({bool force = false}) {
    final auth = context.read<AuthState>();
    final nextName = auth.name ?? '';
    final nextPhone = auth.phone ?? '';
    // Faqat bo'sh yoki force bo'lsa yozamiz — foydalanuvchi yozayotganini buzmaslik.
    if (force || !_hydrated || (_nameCtrl.text.isEmpty && nextName.isNotEmpty)) {
      _nameCtrl.text = nextName;
    }
    if (force || !_hydrated || (_phoneCtrl.text.isEmpty && nextPhone.isNotEmpty)) {
      _phoneCtrl.text = nextPhone;
    }
    _hydrated = true;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      notifications.refreshPermission();
      _reloadMe();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _oldPw.dispose();
    _newPw.dispose();
    _confirmPw.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (name.isEmpty) {
      toast.error("Ism-familiyani kiriting");
      return;
    }
    setState(() => _profileSaving = true);
    try {
      await context.read<AuthState>().updateProfile(name: name, phone: phone);
      toast.success("Profil saqlandi ✅");
      _syncFromAuth(force: true);
    } catch (e) {
      final raw = e.toString();
      toast.error(
        raw.contains('band') ? 'Bu telefon band' : "Saqlab bo'lmadi",
      );
    } finally {
      if (mounted) setState(() => _profileSaving = false);
    }
  }

  Future<void> _submitPassword() async {
    setState(() => _pwMsg = null);
    if (_newPw.text.length < 6) {
      setState(() => _pwMsg = (ok: false, text: "Yangi parol kamida 6 ta belgi"));
      return;
    }
    if (_newPw.text != _confirmPw.text) {
      setState(() => _pwMsg = (ok: false, text: 'Parollar mos kelmadi'));
      return;
    }
    setState(() => _pwSaving = true);
    try {
      await context.read<AuthState>().changePassword(_oldPw.text, _newPw.text);
      setState(() {
        _pwMsg = (ok: true, text: "Parol o'zgartirildi ✓");
        _oldPw.clear();
        _newPw.clear();
        _confirmPw.clear();
      });
    } catch (err) {
      final raw = err.toString();
      setState(() {
        _pwMsg = (
          ok: false,
          text: raw.contains('Eski parol')
              ? "Eski parol noto'g'ri"
              : raw.contains('farq qilishi')
                  ? 'Yangi parol eskisidan farq qilsin'
                  : "Parolni o'zgartirib bo'lmadi",
        );
      });
    } finally {
      if (mounted) setState(() => _pwSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    // Auth yangilanganda (login/loadMe) bo'sh maydonlarni to'ldirish.
    if (!_hydrated ||
        (_nameCtrl.text.isEmpty && (auth.name ?? '').isNotEmpty) ||
        (_phoneCtrl.text.isEmpty && (auth.phone ?? '').isNotEmpty)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _syncFromAuth();
      });
    }

    final displayName =
        (auth.name?.trim().isNotEmpty == true) ? auth.name!.trim() : (auth.username ?? 'Kuryer');
    final initial = displayName.isNotEmpty ? displayName[0].toUpperCase() : 'K';

    return Column(
      children: [
        const PageHeader(title: 'Profil'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.brandLight, AppColors.brand],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.brand.withValues(alpha: 0.25),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initial,
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.brand,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.badge_outlined,
                                  size: 14, color: Colors.white.withValues(alpha: 0.85)),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  auth.username ?? '—',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.white.withValues(alpha: 0.9),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if ((auth.phone ?? '').isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(Icons.phone_outlined,
                                    size: 14, color: Colors.white.withValues(alpha: 0.85)),
                                const SizedBox(width: 4),
                                Text(
                                  auth.phone!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.white.withValues(alpha: 0.9),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.person_outline, size: 18, color: AppColors.brand),
                        SizedBox(width: 8),
                        Text(
                          'Shaxsiy ma\'lumot',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Admin qo\'shganda kiritilgan ism va telefon shu yerda chiqadi',
                      style: TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                    const SizedBox(height: 14),
                    const Text('Ism Familiya',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate500)),
                    const SizedBox(height: 6),
                    _Field(
                      controller: _nameCtrl,
                      hint: 'Masalan: Sardor Karimov',
                      icon: Icons.badge_outlined,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 12),
                    const Text('Telefon',
                        style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate500)),
                    const SizedBox(height: 6),
                    _Field(
                      controller: _phoneCtrl,
                      hint: '+998 90 123 45 67',
                      icon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                    ),
                    const SizedBox(height: 14),
                    AppButton(
                      label: _profileSaving ? 'Saqlanmoqda…' : 'Saqlash',
                      expand: true,
                      loading: _profileSaving,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      onPressed: _profileSaving ? null : _saveProfile,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: const _NotificationTile(),
              ),
              const SizedBox(height: 12),

              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.lock_outline, size: 18, color: AppColors.slate600),
                        SizedBox(width: 8),
                        Text(
                          "Parolni o'zgartirish",
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.slate900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _Field(
                        controller: _oldPw,
                        hint: 'Eski parol',
                        icon: Icons.lock_outline,
                        obscure: true),
                    const SizedBox(height: 10),
                    _Field(
                        controller: _newPw,
                        hint: 'Yangi parol',
                        icon: Icons.lock_open,
                        obscure: true),
                    const SizedBox(height: 10),
                    _Field(
                      controller: _confirmPw,
                      hint: 'Yangi parolni takrorlang',
                      icon: Icons.lock_open,
                      obscure: true,
                    ),
                    if (_pwMsg != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _pwMsg!.ok ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          _pwMsg!.text,
                          style: TextStyle(
                            fontSize: 13,
                            color: _pwMsg!.ok ? const Color(0xFF047857) : AppColors.red600,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    AppButton(
                      label: _pwSaving ? 'Saqlanmoqda…' : 'Parolni saqlash',
                      expand: true,
                      loading: _pwSaving,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      onPressed: _pwSaving ? null : _submitPassword,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Chiqish — Material button (GestureDetector ba'zan pastki nav bilan urishadi)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await context.read<AuthState>().logout();
                  },
                  icon: const Icon(Icons.logout, size: 18, color: AppColors.red600),
                  label: const Text(
                    'Chiqish',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.red600,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0xFFFEF2F2),
                    side: const BorderSide(color: Color(0xFFFECACA)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Center(
                child: Text(
                  'BB Kuryer · v1.1.0',
                  style: TextStyle(fontSize: 12, color: AppColors.slate300),
                ),
              ),
              // Bottom nav ostida qolmasin
              const SizedBox(height: 24),
            ],
          ),
        ),
      ],
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 14),
        prefixIcon: Icon(icon, size: 18, color: AppColors.slate400),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        filled: true,
        fillColor: AppColors.slate50,
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.slate200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
        ),
      ),
    );
  }
}

class _NotificationTile extends StatefulWidget {
  const _NotificationTile();

  @override
  State<_NotificationTile> createState() => _NotificationTileState();
}

class _NotificationTileState extends State<_NotificationTile> {
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: notifications,
      builder: (context, _) {
        final on = notifications.granted;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: on ? const Color(0xFFECFDF5) : AppColors.slate50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  on ? Icons.notifications_active : Icons.notifications_off_outlined,
                  size: 20,
                  color: on ? AppColors.emerald600 : AppColors.slate400,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Bildirishnomalar',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      on ? 'Yoniq — yangi buyurtma eslatiladi' : 'O‘chiq — yoqish tavsiya etiladi',
                      style: const TextStyle(fontSize: 12, color: AppColors.slate400),
                    ),
                  ],
                ),
              ),
              if (!on)
                TextButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _busy = true);
                          await notifications.requestPermission();
                          if (mounted) setState(() => _busy = false);
                        },
                  child: Text(_busy ? '…' : 'Yoqish',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.brand)),
                )
              else
                const Icon(Icons.check_circle, color: AppColors.emerald600, size: 22),
            ],
          ),
        );
      },
    );
  }
}
