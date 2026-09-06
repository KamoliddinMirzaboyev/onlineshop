import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../services/api.dart';
import '../widgets/common.dart';
import '../widgets/toast.dart';
import 'location_permission_page.dart';

enum _Step { phone, otp, name }

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _phoneController = TextEditingController();
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
    if (phone.isEmpty) {
      toast.error('Telefon raqamni kiriting');
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

  Future<void> _verifyCode() async {
    final code = _codeController.text.trim();
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
      await api.setToken(res['token']['access_token']);
      final firstName = (res['user']['first_name'] as String?) ?? '';
      if (firstName.trim().isEmpty) {
        setState(() => _step = _Step.name);
      } else {
        _goToPermissions();
      }
    } catch (e) {
      toast.error('Kod noto\'g\'ri');
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
            padding: const EdgeInsets.all(24),
            child: AppCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/icon/logo.png', height: 64),
                  const SizedBox(height: 16),
                  Text(
                    switch (_step) {
                      _Step.phone => 'Kirish',
                      _Step.otp => 'SMS kodni kiriting',
                      _Step.name => 'Tanishtiring',
                    },
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.slate900,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    switch (_step) {
                      _Step.phone => 'Telefon raqamingizni kiriting — tasdiqlash kodi yuboriladi',
                      _Step.otp => '${_phoneController.text} raqamiga yuborilgan kod',
                      _Step.name => 'Ism va familiyangizni kiriting',
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
          ),
        ),
      ),
    );
  }

  List<Widget> _phoneFields() => [
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Telefon raqam',
            hintText: '+998901234567',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 24),
        AppButton(label: 'Kod olish', expand: true, loading: _loading, onPressed: _requestCode),
      ];

  List<Widget> _otpFields() => [
        TextField(
          controller: _codeController,
          keyboardType: TextInputType.number,
          autofocus: true,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 24, letterSpacing: 8),
          decoration: const InputDecoration(hintText: '• • • • •', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 24),
        AppButton(label: 'Tasdiqlash', expand: true, loading: _loading, onPressed: _verifyCode),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() {
            _step = _Step.phone;
            _codeController.clear();
          }),
          child: const Text('Raqamni o\'zgartirish', style: TextStyle(color: AppColors.brand)),
        ),
      ];

  List<Widget> _nameFields() => [
        TextField(
          controller: _firstNameController,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Ism', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _lastNameController,
          decoration: const InputDecoration(labelText: 'Familiya (ixtiyoriy)', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 24),
        AppButton(label: 'Davom etish', expand: true, loading: _loading, onPressed: _submitName),
      ];
}
