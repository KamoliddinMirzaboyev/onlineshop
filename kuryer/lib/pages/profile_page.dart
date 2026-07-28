import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../services/notifications.dart';
import '../state/auth.dart';
import '../widgets/common.dart';

/// Mirrors `pages/ProfilePage.tsx`. The web `InstallButton` (PWA install) has no
/// native counterpart, so it's replaced by the notification toggle
/// (`PushButton` equivalent) driven by [NotificationService].
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with WidgetsBindingObserver {
  final _oldPw = TextEditingController();
  final _newPw = TextEditingController();
  final _confirmPw = TextEditingController();
  bool _saving = false;
  ({bool ok, String text})? _msg;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) notifications.refreshPermission();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _oldPw.dispose();
    _newPw.dispose();
    _confirmPw.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _msg = null);
    if (_newPw.text.length < 6) {
      setState(() => _msg = (ok: false, text: "Yangi parol kamida 6 ta belgi bo'lsin"));
      return;
    }
    if (_newPw.text != _confirmPw.text) {
      setState(() => _msg = (ok: false, text: 'Parollar mos kelmadi'));
      return;
    }
    setState(() => _saving = true);
    try {
      await context.read<AuthState>().changePassword(_oldPw.text, _newPw.text);
      setState(() {
        _msg = (ok: true, text: "Parol o'zgartirildi ✓");
        _oldPw.clear();
        _newPw.clear();
        _confirmPw.clear();
      });
    } catch (err) {
      final raw = err.toString();
      setState(() {
        _msg = (
          ok: false,
          text: raw.contains('Eski parol')
              ? "Eski parol noto'g'ri"
              : raw.contains('farq qilishi')
                  ? 'Yangi parol eskisidan farq qilsin'
                  : "Parolni o'zgartirib bo'lmadi",
        );
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return Column(
      children: [
        const PageHeader(title: 'Profil'),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Profile card
              AppCard(
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppColors.brand.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.person_outline, size: 26, color: AppColors.brand),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(auth.username ?? '—',
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Row(children: [
                          const Icon(Icons.verified_user_outlined, size: 13, color: AppColors.slate400),
                          const SizedBox(width: 4),
                          Text(auth.role == 'courier' ? 'Kuryer' : (auth.role ?? '—'),
                              style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                        ]),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Notification toggle
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: const _NotificationTile(),
              ),
              const SizedBox(height: 16),

              // Change password
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.vpn_key_outlined, size: 16, color: AppColors.slate600),
                      SizedBox(width: 8),
                      Text("Parolni o'zgartirish",
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate600)),
                    ]),
                    const SizedBox(height: 12),
                    _PwField(controller: _oldPw, hint: 'Eski parol'),
                    const SizedBox(height: 12),
                    _PwField(controller: _newPw, hint: 'Yangi parol'),
                    const SizedBox(height: 12),
                    _PwField(controller: _confirmPw, hint: 'Yangi parolni takrorlang'),
                    if (_msg != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: _msg!.ok ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(_msg!.text,
                            style: TextStyle(
                                fontSize: 13,
                                color: _msg!.ok ? const Color(0xFF047857) : AppColors.red600)),
                      ),
                    ],
                    const SizedBox(height: 12),
                    AppButton(
                      label: _saving ? 'Saqlanmoqda…' : 'Saqlash',
                      expand: true,
                      loading: _saving,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      onPressed: _saving ? null : _submit,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Logout
              Pressable(
                borderRadius: 16,
                onTap: () => context.read<AuthState>().logout(),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFFECACA)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.logout, size: 16, color: AppColors.red600),
                      SizedBox(width: 8),
                      Text('Chiqish',
                          style: TextStyle(
                              fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.red600)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Center(
                child: Text('Barakali Bozor Kuryer · v1.1.0',
                    style: TextStyle(fontSize: 12, color: AppColors.slate300)),
              ),
            ],
          ),
        ),
      ],
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
        if (notifications.granted) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.notifications_active_outlined, size: 16, color: AppColors.emerald600),
                SizedBox(width: 8),
                Text('Bildirishnoma yoniq',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.emerald600)),
              ],
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: GhostButton(
            label: _busy ? '...' : 'Bildirishnomani yoqish',
            icon: Icons.notifications_none,
            expand: true,
            textColor: AppColors.slate600,
            padding: const EdgeInsets.symmetric(vertical: 12),
            onPressed: _busy
                ? null
                : () async {
                    setState(() => _busy = true);
                    await notifications.requestPermission();
                    if (mounted) setState(() => _busy = false);
                  },
          ),
        );
      },
    );
  }
}

class _PwField extends StatelessWidget {
  const _PwField({required this.controller, required this.hint});
  final TextEditingController controller;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: true,
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 14),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        filled: true,
        fillColor: Colors.white,
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
