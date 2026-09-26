import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../services/push.dart';
import '../widgets/common.dart';
import '../widgets/toast.dart';
import 'location_permission_page.dart';

enum _Step { phone, name }

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _phoneController = TextEditingController(text: '+998 ')
    ..selection = const TextSelection.collapsed(offset: 5);
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();

  _Step _step = _Step.phone;
  bool _loading = false;

  @override
  void dispose() {
    _phoneController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  /// Telefon raqami kiritilgach tasdiqlash dialogini chiqarish
  Future<void> _onPhoneSubmit() async {
    if (_loading) return;
    final tr = context.tr;
    final phone = _phoneController.text.trim();
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 12) {
      toast.error(tr.authPhoneRequiredError);
      return;
    }

    // Telefon raqamingiz sizniki ekanligiga ishonch hosil qiling dialogi
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.slate200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.brandSoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.phone_android_rounded, size: 32, color: AppColors.brand),
              ),
              const SizedBox(height: 16),
              Text(
                tr.authConfirmPhoneTitle,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate900,
                  letterSpacing: -0.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                tr.authConfirmPhoneDesc,
                style: const TextStyle(fontSize: 14, color: AppColors.slate500, height: 1.4),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.slate50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Text(
                  phone,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: AppColors.slate900,
                    letterSpacing: 0.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: GhostButton(
                      label: tr.edit,
                      textColor: AppColors.slate700,
                      borderColor: const Color(0xFFCBD5E1),
                      onPressed: () => Navigator.pop(ctx, false),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: AppButton(
                      label: tr.continueBtn,
                      onPressed: () => Navigator.pop(ctx, true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirmed == true && mounted) {
      await _loginWithPhone(phone);
    }
  }

  /// Backendga faqat telefon raqami bilan kirish so'rovi
  Future<void> _loginWithPhone(String phone) async {
    setState(() => _loading = true);
    try {
      final res = await api.post('/auth/phone', {
        'phone': phone.replaceAll(RegExp(r'\s+'), ''),
      });
      await api.setTokens(
        access: res['token']['access_token'] as String?,
        refresh: res['token']['refresh_token'] as String?,
      );
      if (!mounted) return;

      final firstName = (res['user']['first_name'] as String?)?.trim() ?? '';
      if (firstName.isEmpty) {
        // Yangi foydalanuvchi — Ism va Familiya so'raladi
        setState(() => _step = _Step.name);
      } else {
        // Mavjud foydalanuvchi — to'g'ridan-to'g'ri ruxsatlar sahifasiga
        _goToPermissions();
      }
    } catch (e) {
      if (e is ApiException) {
        toast.error(e.userFriendlyMessage);
      } else {
        toast.error(context.tr.authGeneralError);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Yangi foydalanuvchi uchun ism-familiyani saqlash
  Future<void> _submitName() async {
    if (_loading) return;
    final tr = context.tr;
    final first = _firstNameController.text.trim();
    if (first.isEmpty) {
      toast.error(tr.authNameRequiredError);
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
      toast.error(tr.authSaveProfileError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Ruxsatlar sahifasiga o'tish (Joylashuv -> Bildirishnoma -> Asosiy oyna)
  void _goToPermissions() {
    registerFcmToken();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LocationPermissionPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;
    final isRu = context.lang.isRussian;

    return Scaffold(
      backgroundColor: AppColors.slate50,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Til almashtirish tugmasi
                Align(
                  alignment: Alignment.topRight,
                  child: GestureDetector(
                    onTap: () {
                      final next = isRu ? AppLanguage.uz : AppLanguage.ru;
                      context.read<LanguageProvider>().setLanguage(next);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: const [
                          BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 1)),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(context.lang.current.flag, style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 6),
                          Text(
                            context.lang.current.displayName,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate700,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.sync_alt_rounded, size: 13, color: AppColors.slate400),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

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
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.shopping_bag_rounded,
                      size: 40,
                      color: AppColors.brand,
                    ),
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
                Text(
                  isRu ? 'Быстрая и качественная доставка' : 'Tezkor va sifatli yetkazib berish',
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: AppColors.slate400,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 24),

                // Asosiy karta
                AppCard(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        _step == _Step.phone
                            ? (isRu ? 'Добро пожаловать 👋' : 'Xush kelibsiz 👋')
                            : (isRu ? 'Давайте знакомиться 🤝' : 'Tanishing 🤝'),
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
                        _step == _Step.phone
                            ? (isRu ? 'Для продолжения введите номер телефона' : 'Davom etish uchun telefon raqamingizni kiriting')
                            : (isRu ? 'Введите имя и фамилию для ваших заказов' : 'Buyurtmalaringiz uchun ism va familiyangizni kiriting'),
                        style: const TextStyle(fontSize: 13, color: AppColors.slate500),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      if (_step == _Step.phone) ..._phoneFields(tr),
                      if (_step == _Step.name) ..._nameFields(tr),
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

  List<Widget> _phoneFields(AppStrings tr) => [
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
                    Text(
                      'UZ',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: AppColors.slate700,
                      ),
                    ),
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
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: AppColors.slate900,
                    letterSpacing: 0.5,
                  ),
                  decoration: InputDecoration(
                    hintText: tr.authPhoneHint,
                    hintStyle: const TextStyle(color: AppColors.slate300, fontWeight: FontWeight.normal),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  onSubmitted: (_) => _onPhoneSubmit(),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        AppButton(
          label: tr.authLoginBtn,
          expand: true,
          loading: _loading,
          onPressed: _onPhoneSubmit,
        ),
        const SizedBox(height: 16),
        Center(
          child: Text(
            tr.authTermsAgreement,
            style: const TextStyle(fontSize: 11.5, color: AppColors.slate400),
            textAlign: TextAlign.center,
          ),
        ),
      ];

  List<Widget> _nameFields(AppStrings tr) => [
        TextField(
          controller: _firstNameController,
          autofocus: true,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          decoration: InputDecoration(
            labelText: tr.authFirstNameLabel,
            hintText: tr.authFirstNameHint,
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
            labelText: tr.authLastNameLabel,
            hintText: tr.authLastNameHint,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.8),
            ),
          ),
          onSubmitted: (_) => _submitName(),
        ),
        const SizedBox(height: 22),
        AppButton(
          label: tr.authSaveAndContinue,
          expand: true,
          loading: _loading,
          onPressed: _submitName,
        ),
      ];
}
