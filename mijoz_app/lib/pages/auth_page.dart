import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/otp_input.dart';
import '../widgets/toast.dart';
import 'location_permission_page.dart';

enum _Step { phone, otp, name }

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _phoneController = TextEditingController(text: '+998 ')
    ..selection = const TextSelection.collapsed(offset: 5);
  final _codeController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();

  _Step _step = _Step.phone;
  bool _loading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _codeController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    final phone = _phoneController.text.trim();
    if (phone.replaceAll(RegExp(r'\D'), '').length < 12) {
      toast.error('Telefon raqamni to\'liq kiriting');
      return;
    }
    setState(() => _loading = true);
    try {
      await api.post('/auth/otp/request', {'phone': phone});
      setState(() => _step = _Step.otp);
    } catch (e) {
      toast.error('Telefon raqami noto\'g\'ri');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyCode([String? directCode]) async {
    final code = directCode ?? _codeController.text.trim();
    if (code.isEmpty) {
      toast.error('SMS kodni kiriting');
      return;
    }
    setState(() => _loading = true);
    try {
      final res = await api.post('/auth/otp/verify', {
        'phone': _phoneController.text.trim(),
        'code': code,
      });
      await api.setTokens(
        access: res['token']['access_token'] as String?,
        refresh: res['token']['refresh_token'] as String?,
      );
      final firstName = (res['user']['first_name'] as String?) ?? '';
      if (firstName.trim().isEmpty) {
        setState(() => _step = _Step.name);
      } else {
        _goToPermissions();
      }
    } catch (e) {
      toast.error('SMS kod noto\'g\'ri');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitName() async {
    final first = _firstNameController.text.trim();
    if (first.isEmpty) {
      toast.error('Ismingizni kiriting');
      return;
    }
    setState(() => _loading = true);
    try {
      await api.patch('/auth/me', {
        'first_name': first,
        if (_lastNameController.text.trim().isNotEmpty)
          'last_name': _lastNameController.text.trim(),
      });
      _goToPermissions();
    } catch (e) {
      toast.error('Xatolik yuz berdi');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _goToPermissions() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LocationPermissionPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Brend belgisi
                Container(
                  width: 80,
                  height: 80,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: const Color(0xFFF1F5F9), width: 1.2),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.brand.withValues(alpha: 0.12),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Image.asset(
                    'assets/icon/logo.png',
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.shopping_bag_rounded, size: 40, color: AppColors.brand),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Barakali Bozor',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AppColors.slate900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Tezkor va sifatli yetkazib berish',
                  style: TextStyle(fontSize: 13.5, color: AppColors.slate400, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 28),

                // Asosiy karta
                AppCard(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        switch (_step) {
                          _Step.phone => 'Xush kelibsiz 👋',
                          _Step.otp => 'Kodni tasdiqlash 🔐',
                          _Step.name => 'Tanishing 🤝',
                        },
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.slate900,
                          letterSpacing: -0.3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        switch (_step) {
                          _Step.phone => 'Davom etish uchun telefon raqamingizni kiriting',
                          _Step.otp => '${_phoneController.text} raqamiga yuborilgan 5 xonali kod',
                          _Step.name => 'Buyurtmalaringiz uchun ismingizni kiriting',
                        },
                        style: const TextStyle(fontSize: 13, color: AppColors.slate500),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      if (_step == _Step.phone) ..._phoneFields(),
                      if (_step == _Step.otp) ..._otpFields(),
                      if (_step == _Step.name) ..._nameFields(),
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

  List<Widget> _phoneFields() => [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.slate100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Text('🇺🇿', style: TextStyle(fontSize: 16)),
                    SizedBox(width: 4),
                    Text('UZ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.slate700)),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  inputFormatters: [UzPhoneFormatter()],
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.slate900, letterSpacing: 0.5),
                  decoration: const InputDecoration(
                    hintText: '+998 90 123 45 67',
                    hintStyle: TextStyle(color: AppColors.slate300, fontWeight: FontWeight.normal),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        AppButton(
          label: 'SMS kod olish',
          expand: true,
          loading: _loading,
          onPressed: _requestCode,
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            'Ro\'yxatdan o\'tish orqali siz foydalanish qoidalariga rozilik bildirasiz.',
            style: const TextStyle(fontSize: 11.5, color: AppColors.slate400),
            textAlign: TextAlign.center,
          ),
        ),
      ];

  List<Widget> _otpFields() => [
        Center(
          child: OtpBoxInput(
            length: 5,
            onChanged: (v) => _codeController.text = v,
            onCompleted: (v) => _verifyCode(v),
          ),
        ),
        const SizedBox(height: 24),
        AppButton(
          label: 'Tasdiqlash',
          expand: true,
          loading: _loading,
          onPressed: () => _verifyCode(),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton.icon(
            onPressed: () => setState(() {
              _step = _Step.phone;
              _codeController.clear();
            }),
            icon: const Icon(Icons.edit_outlined, size: 16, color: AppColors.brand),
            label: const Text('Raqamni o\'zgartirish', style: TextStyle(color: AppColors.brand, fontWeight: FontWeight.w600)),
          ),
        ),
      ];

  List<Widget> _nameFields() => [
        TextField(
          controller: _firstNameController,
          autofocus: true,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          decoration: InputDecoration(
            labelText: 'Ismingiz',
            hintText: 'Ismingizni kiriting',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.8),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _lastNameController,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          decoration: InputDecoration(
            labelText: 'Familiyangiz (ixtiyoriy)',
            hintText: 'Familiyangizni kiriting',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.8),
            ),
          ),
        ),
        const SizedBox(height: 22),
        AppButton(
          label: 'Ilovaga kirish',
          expand: true,
          loading: _loading,
          onPressed: _submitName,
        ),
      ];
}
